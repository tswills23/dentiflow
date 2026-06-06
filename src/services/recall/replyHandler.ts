// Recall Reply Handler
// Phase 5: Main orchestrator for patient replies to recall SMS
//
// Flow: inbound SMS → classify intent → state machine transition →
//       execute action → generate reply → send SMS → update sequence

import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { logAutomation } from '../execution/metricsTracker';
import { classifyIntent, classifyCriticalIntent, parsePreferences, extractSlotNumber, parseDeferTimeframe } from './intentClassifier';
import { getTransition } from './bookingStateMachine';
import { getAvailableSlots, getDefaultSlots, slotsToDisplayList, getSlotByNumber } from './slotSelector';
import { generateRecallReply, type RecallAIDecision } from './recallReplyAI';
import { insertRecallAudit } from './recallReplyAudit';
import { assignVoice, calculateSegment } from './voiceAssignment';
import type {
  RecallSequence,
  RecallStage,
  RecallVoice,
  ReplyHandlerResult,
  AvailableSlot,
  TimePreferences,
} from '../../types/recall';
import { notifyEscalation } from '../execution/staffNotifier';
import type { Practice, Patient } from '../../types/database';

// Actions whose reply text MUST come from the deterministic template path,
// even when Claude generated something usable. Slot strings, opt-out
// confirmations, emergency escalations, and slot-data-dependent replies
// cannot be invented by AI.
//
// NOTE: send_booking_link is NOT in this set. Claude writes the empathy/
// acknowledgment text; we post-process to ensure the booking URL is included.
// If Claude's reply omits the URL, we append it. This lets Claude respond
// with emotional intelligence while guaranteeing the link is present.
const DETERMINISTIC_ACTIONS = new Set([
  'show_balanced_slots',
  'show_default_slots',
  'confirm_slot',
  'book_first_slot',
  'complete_booking',
  'reshow_slots',
  'opt_out_silent',
  'handoff_urgent',
  'handoff_wrong_number',
  'handoff_general',
  'acknowledge_moved',
  'acknowledge_already_seen',
  'defer_to_timeframe',
]);

// Actions that need the booking URL appended to Claude's reply if missing.
const BOOKING_LINK_ACTIONS = new Set(['send_booking_link']);

// Any outgoing reply that PROMISES a human follow-up must put the patient on the
// office call list — regardless of how the reply was produced. The handoff_general
// action already logs a callback, but an LLM conversational reply can promise a
// callback ("someone from the office will reach out") without routing through it.
// This regex is the text-level backstop that catches those. Bias toward
// over-capture: a spurious call-list row is cheap; a missed promise is not.
const HANDOFF_PROMISE_REGEX =
  /\b(someone|somebody|the office|our office|the front desk|the team|our team|we|i)\b[^.!?]{0,45}\b(will|'ll|can|going to|gonna)\b[^.!?]{0,45}\b(call you|give you a (?:call|ring)|reach out|reach back|be in touch|get back to you|contact you|follow up with you)\b/i;

// =============================================================================
// Main Entry Point
// =============================================================================

export async function handleRecallReply(
  sequenceId: string,
  patientPhone: string,
  messageBody: string,
  practiceId: string
): Promise<ReplyHandlerResult> {
  // 1. Load sequence, patient, practice
  const { data: seq, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('id', sequenceId)
    .single();

  if (seqErr || !seq) {
    return errorResult(sequenceId, 'unknown', `Sequence not found: ${sequenceId}`);
  }

  const sequence = seq as RecallSequence;

  // GUARD: Do not respond to replies on terminal sequences. A completed/exited
  // sequence should never trigger automation, even if the patient replies.
  if (['completed', 'exited'].includes(sequence.sequence_status)) {
    await logAutomation({
      practiceId,
      patientId: sequence.patient_id,
      automationType: 'recall',
      action: 'blocked_terminal',
      result: 'skipped',
      metadata: { sequenceId, sequence_status: sequence.sequence_status, exit_reason: sequence.exit_reason },
    });
    return errorResult(sequenceId, sequence.patient_id, `Sequence is ${sequence.sequence_status}, not responding`);
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', sequence.patient_id)
    .single();

  if (!patient) {
    return errorResult(sequenceId, sequence.patient_id, 'Patient not found');
  }

  const typedPatient = patient as unknown as Patient;

  if (typedPatient.recall_opt_out) {
    await logAutomation({
      practiceId,
      patientId: patient.id,
      automationType: 'recall',
      action: 'blocked_opt_out',
      result: 'skipped',
      metadata: { sequenceId, reason: 'patient opted out' },
    });
    return errorResult(sequenceId, patient.id, 'Patient has opted out of recall');
  }

  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (!practice) {
    return errorResult(sequenceId, sequence.patient_id, 'Practice not found');
  }

  const typedPractice = practice as unknown as Practice;

  // 2. Log inbound message
  await saveMessage({
    practiceId,
    patientId: patient.id,
    channel: 'sms',
    direction: 'inbound',
    messageBody,
    automationType: 'recall',
    metadata: { sequenceId, bookingStage: sequence.booking_stage },
  });

  // 2b. DEBOUNCE: If we sent an outbound to this patient in the last 8 seconds,
  // skip this reply — the patient is likely sending a follow-up message before
  // reading our response. Prevents rapid-fire double-sends from race conditions.
  const eightSecondsAgo = new Date(Date.now() - 8000).toISOString();
  const { data: recentOutbound } = await supabase
    .from('conversations')
    .select('id')
    .eq('patient_id', patient.id)
    .eq('direction', 'outbound')
    .eq('automation_type', 'recall')
    .gte('created_at', eightSecondsAgo)
    .limit(1);

  if (recentOutbound && recentOutbound.length > 0) {
    await logAutomation({
      practiceId,
      patientId: patient.id,
      automationType: 'recall',
      action: 'debounced',
      result: 'skipped',
      metadata: { sequenceId, reason: 'outbound sent within last 8s' },
    });
    return errorResult(sequenceId, patient.id, 'Debounced — recent outbound');
  }

  // 3. Increment reply count + replies metric (fire-and-forget — these
  // are observability writes, not load-bearing. Don't block the response.)
  supabase
    .from('recall_sequences')
    .update({ reply_count: (sequence.reply_count || 0) + 1 })
    .eq('id', sequenceId)
    .then(({ error }) => { if (error) console.error('[replyHandler] reply_count update failed:', error.message); });

  supabase.rpc('increment_recall_metric', {
    p_practice_id: practiceId,
    p_date: new Date().toISOString().split('T')[0],
    p_field: 'recall_replies',
  }).then(({ error }) => { if (error) console.error('[replyHandler] replies metric rpc failed:', error.message); });

  // 4. Three-branch routing:
  //    (a) Critical intent (opt_out / urgent / wrong_number / S4 slot) → keyword path UNCHANGED.
  //    (b) Else if Claude path enabled → call Claude, validate, fall back on any failure.
  //    (c) Else → keyword path (current behavior).
  // State transitions ALWAYS come from getTransition(). Claude is text-only.
  let aiDecision: RecallAIDecision | null = null;
  const critical = classifyCriticalIntent(messageBody, sequence.booking_stage as RecallStage);

  if (!critical) {
    // Compute voice tier from sequence (or recompute if missing)
    const voiceTier: RecallVoice = (sequence.assigned_voice as RecallVoice) ||
      (sequence.segment_overdue ? assignVoice(sequence.segment_overdue) : 'office');
    const monthsOverdue = sequence.months_overdue || 0;

    // Build last-6-message conversation history for context
    const { data: recentMessages } = await supabase
      .from('conversations')
      .select('direction, message_body')
      .eq('patient_id', patient.id)
      .eq('automation_type', 'recall')
      .order('created_at', { ascending: false })
      .limit(6);

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((m) => ({
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.message_body || '',
      }))
      .filter((m) => m.content.length > 0);

    const bookingLinkUrl = sequence.booking_link_token
      ? `${process.env.BACKEND_URL}/r/${sequence.booking_link_token}`
      : null;

    aiDecision = await generateRecallReply({
      practice: typedPractice,
      patient: typedPatient,
      sequence,
      inboundMessage: messageBody,
      bookingStage: sequence.booking_stage as RecallStage,
      conversationHistory,
      bookingLinkUrl,
      monthsOverdue,
      voiceTier,
    });
  }

  // 5. Resolve final intent + transition + action + reply text
  let classification: ReturnType<typeof classifyIntent>;
  let transition: ReturnType<typeof getTransition>;
  let replyText: string;
  let updatedFields: Record<string, unknown>;
  const usedLLM = !!(aiDecision && !aiDecision.fellBackToTemplate);

  if (usedLLM && aiDecision) {
    // Claude succeeded
    classification = {
      intent: aiDecision.intent!,
      confidence: aiDecision.confidence! >= 0.85 ? 'high' :
                  aiDecision.confidence! >= 0.7  ? 'medium' : 'low',
      matchedKeywords: ['llm'],
      rawText: messageBody,
    };
    transition = getTransition(sequence.booking_stage as RecallStage, aiDecision.intent!);

    if (DETERMINISTIC_ACTIONS.has(transition.action)) {
      // Critical / slot actions — text MUST come from template, ignore Claude's reply
      const result = await executeAction(transition.action, sequence, typedPatient, typedPractice, messageBody, classification);
      replyText = result.replyText;
      updatedFields = result.updatedFields;
    } else if (BOOKING_LINK_ACTIONS.has(transition.action)) {
      // Use Claude's empathetic text but GUARANTEE the booking URL is present.
      // Claude writes the acknowledgment / drive-to-book line; we ensure the link
      // is appended. This protects against Claude inventing a fake URL while
      // preserving emotional intelligence.
      const bookingLinkUrl = sequence.booking_link_token
        ? `${process.env.BACKEND_URL}/r/${sequence.booking_link_token}`
        : null;

      if (bookingLinkUrl) {
        // Strip any URLs Claude may have invented; keep only the real one.
        const cleanedClaudeReply = aiDecision.replyText!.replace(/https?:\/\/\S+/gi, '').trim();
        replyText = `${cleanedClaudeReply} ${bookingLinkUrl}`;
        updatedFields = {};
      } else {
        // No link available — fall back to template
        const result = await executeAction(transition.action, sequence, typedPatient, typedPractice, messageBody, classification);
        replyText = result.replyText;
        updatedFields = result.updatedFields;
      }
    } else {
      // Conversational action — use Claude's text directly
      replyText = aiDecision.replyText!;
      updatedFields = {};
    }
  } else {
    // Critical intent OR Claude fell back / disabled — use existing keyword path
    classification = classifyIntent(messageBody, sequence.booking_stage as RecallStage);
    transition = getTransition(sequence.booking_stage as RecallStage, classification.intent);
    const result = await executeAction(transition.action, sequence, typedPatient, typedPractice, messageBody, classification);
    replyText = result.replyText;
    updatedFields = result.updatedFields;
  }

  // 6b. Backstop: if the final reply promises a human follow-up, make sure the
  // patient lands on the office call list — covers LLM conversational replies that
  // promise a callback without routing through the handoff_general action.
  await ensureCallbackFromReplyText(typedPractice, typedPatient, replyText, messageBody, transition.action);

  // 7. Update sequence in DB
  const updatePayload: Record<string, unknown> = {
    booking_stage: transition.nextStage,
    ...updatedFields,
  };

  if (transition.isTerminal) {
    updatePayload.sequence_status = transition.nextStage === 'S6_COMPLETED' ? 'completed' : 'exited';
    // Respect an action-provided exit_reason (e.g. 'moved', 'already_current');
    // otherwise derive it from the terminal stage.
    if (updatePayload.exit_reason === undefined) {
      updatePayload.exit_reason = getExitReason(transition.nextStage);
    }
    updatePayload.next_send_at = null;
  }

  await supabase
    .from('recall_sequences')
    .update(updatePayload)
    .eq('id', sequenceId);

  // 8. Send reply SMS
  let smsSent = false;
  if (replyText && practice.twilio_phone) {
    const sendResult = await sendSMS(patientPhone, replyText, practice.twilio_phone);
    smsSent = sendResult.success;

    if (sendResult.success) {
      await saveMessage({
        practiceId,
        patientId: patient.id,
        channel: 'sms',
        direction: 'outbound',
        messageBody: replyText,
        aiGenerated: true,
        automationType: 'recall',
        twilioSid: sendResult.sid,
        metadata: {
          sequenceId,
          action: transition.action,
          intent: classification.intent,
          stage: transition.nextStage,
        },
      });
    }
  }

  // 9. Handle terminal-specific side effects
  if (transition.nextStage === 'S7_HANDOFF' && transition.action === 'handoff_urgent') {
    await notifyEscalation(
      typedPractice,
      typedPatient,
      'Emergency detected during recall',
      messageBody
    );
  }

  if (transition.nextStage === 'EXIT_OPT_OUT') {
    await supabase
      .from('patients')
      .update({ recall_opt_out: true, recall_eligible: false })
      .eq('id', patient.id);

    await supabase.rpc('increment_recall_metric', {
      p_practice_id: practiceId,
      p_date: new Date().toISOString().split('T')[0],
      p_field: 'recall_opt_outs',
    });
  }

  if (transition.nextStage === 'S6_COMPLETED') {
    await supabase.rpc('increment_recall_metric', {
      p_practice_id: practiceId,
      p_date: new Date().toISOString().split('T')[0],
      p_field: 'recall_booked',
    });
  }

  // 10. Log automation
  await logAutomation({
    practiceId,
    patientId: patient.id,
    automationType: 'recall',
    action: transition.action,
    result: smsSent ? 'sent' : 'triggered',
    messageBody: replyText,
    metadata: {
      sequenceId,
      intent: classification.intent,
      confidence: classification.confidence,
      previousStage: transition.currentStage,
      nextStage: transition.nextStage,
      matchedKeywords: classification.matchedKeywords,
    },
  });

  // 11. Fire-and-forget audit insert. NEVER awaited — audit failures must
  // never crash the request handler or delay reply delivery.
  insertRecallAudit({
    sequence_id: sequenceId,
    practice_id: practiceId,
    patient_id: patient.id,
    inbound_message: messageBody,
    intent: classification.intent,
    confidence_score: aiDecision?.confidence ?? null,
    state_before: transition.currentStage,
    state_after: transition.nextStage,
    action: transition.action,
    reply_text: replyText,
    used_llm: usedLLM,
    llm_latency_ms: aiDecision?.claudeLatencyMs ?? null,
    llm_reasoning: aiDecision?.reasoning ?? null,
    raw_claude_content: aiDecision?.rawClaudeContent ?? null,
    validator_pass: !(aiDecision?.fallbackReason === 'validator_blocked'),
    validator_block_reason: aiDecision?.validatorBlockReason ?? null,
    fallback_reason: aiDecision?.fallbackReason ?? null,
    transition_overridden: aiDecision?.transitionOverridden ?? false,
    llm_suggested_state: aiDecision?.llmSuggestedState ?? null,
    input_tokens: aiDecision?.inputTokens ?? null,
    output_tokens: aiDecision?.outputTokens ?? null,
    cache_read_tokens: aiDecision?.cacheReadTokens ?? null,
  }).catch((err) => console.error('[replyHandler] audit insert error:', err));

  return {
    sequenceId,
    patientId: patient.id,
    intent: classification.intent,
    previousStage: transition.currentStage,
    nextStage: transition.nextStage,
    action: transition.action,
    replyText: replyText || '',
    smsSent,
  };
}

// =============================================================================
// Action Executor
// =============================================================================

async function executeAction(
  action: string,
  sequence: RecallSequence,
  patient: Patient,
  practice: Practice,
  messageBody: string,
  classification: ReturnType<typeof classifyIntent>
): Promise<{ replyText: string; updatedFields: Record<string, unknown> }> {
  const firstName = patient.first_name || 'there';
  const practiceName = patient.location
    ? (patient.location.toLowerCase().includes(practice.name.toLowerCase())
        ? patient.location
        : `${practice.name} ${patient.location}`)
    : practice.name;
  const updatedFields: Record<string, unknown> = {};

  // Build booking link for this sequence if available
  const bookingLinkUrl = sequence.booking_link_token
    ? `${process.env.BACKEND_URL}/r/${sequence.booking_link_token}`
    : null;

  switch (action) {
    case 'explain_reason': {
      const months = Math.round(sequence.months_overdue || 0);
      const timePhrase =
        months >= 18 ? 'over a year and a half' :
        months >= 12 ? 'over a year' :
        months >= 9 ? 'almost a year' :
        months >= 6 ? `about ${months} months` :
        months >= 3 ? 'a few months' :
        'a bit';
      return {
        replyText: `It's been ${timePhrase} since your last cleaning — wanted to make sure we got you back in before too much longer. Want me to get you on the books?`,
        updatedFields,
      };
    }

    case 'send_booking_link': {
      if (bookingLinkUrl) {
        const phone = practice.phone || null;
        const callLine = phone
          ? ` Give us a call at ${phone} if you need help booking.`
          : ` Give us a call if you need help booking.`;
        return {
          replyText: `Here's a link to our schedule — grab a day and time that works for you: ${bookingLinkUrl}${callLine}`,
          updatedFields,
        };
      }
      return {
        replyText: `Mornings or afternoons work better?`,
        updatedFields,
      };
    }

    case 'confirm_external_booking':
      return {
        replyText: `Perfect, see you then. Give us a call if anything changes.`,
        updatedFields,
      };

    case 'ask_preferences':
      return {
        replyText: `Mornings or afternoons work better, or any particular days?`,
        updatedFields,
      };

    case 'show_balanced_slots':
    case 'show_default_slots': {
      let slots: AvailableSlot[];

      if (action === 'show_balanced_slots' && classification.intent === 'preferences') {
        const prefs = parsePreferences(messageBody);
        slots = getAvailableSlots(prefs);
        updatedFields.patient_preferences = prefs;
      } else {
        slots = getDefaultSlots();
      }

      if (slots.length === 0) {
        return {
          replyText: `nothing matching that right now — would different days or times work?`,
          updatedFields,
        };
      }

      updatedFields.offered_slots = slots;
      const slotList = slotsToDisplayList(slots);

      return {
        replyText: `here's what we've got:\n\n${slotList}\n\nreply with 1, 2, or 3`,
        updatedFields,
      };
    }

    case 'confirm_slot': {
      const slotNum = extractSlotNumber(messageBody);
      const offeredSlots = sequence.offered_slots || [];

      if (slotNum && offeredSlots.length > 0) {
        const selectedSlot = getSlotByNumber(offeredSlots, slotNum);

        if (selectedSlot) {
          updatedFields.selected_slot = selectedSlot;

          return {
            replyText: `got it — ${selectedSlot.fullDisplay}. does that work? reply yes to confirm`,
            updatedFields,
          };
        }
      }

      const slotList = slotsToDisplayList(offeredSlots);
      return {
        replyText: `just reply with 1, 2, or 3:\n\n${slotList}`,
        updatedFields,
      };
    }

    case 'book_first_slot': {
      const offeredSlots = sequence.offered_slots || [];
      if (offeredSlots.length > 0) {
        const slot = offeredSlots[0];
        updatedFields.selected_slot = slot;
        return {
          replyText: `you're all set for ${slot.fullDisplay} — see you then!`,
          updatedFields,
        };
      }
      return {
        replyText: `do mornings or afternoons work better for you?`,
        updatedFields,
      };
    }

    case 'complete_booking': {
      const slot = sequence.selected_slot;
      if (slot) {
        return {
          replyText: `confirmed — ${slot.fullDisplay}. see you then!`,
          updatedFields,
        };
      }
      return {
        replyText: `you're all set, see you soon!`,
        updatedFields,
      };
    }

    case 'reshow_slots': {
      const offeredSlots = sequence.offered_slots || [];
      if (offeredSlots.length > 0) {
        const slotList = slotsToDisplayList(offeredSlots);
        return {
          replyText: `here are those times again:\n\n${slotList}\n\nreply with 1, 2, or 3`,
          updatedFields,
        };
      }
      return {
        replyText: `do mornings or afternoons work better, or any particular days?`,
        updatedFields,
      };
    }

    case 'opt_out_silent':
      updatedFields.opt_out = true;
      return {
        replyText: `Got it, you're off the list. If you ever need us, just give us a call.`,
        updatedFields,
      };

    case 'defer_60_days':
      updatedFields.defer_until = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      updatedFields.exit_reason = 'deferred';
      return {
        replyText: `No worries. Is it a timing thing, or did you end up finding somewhere else?`,
        updatedFields,
      };

    case 'defer_to_timeframe': {
      // Patient gave a real timeframe ("back in July", "out of town", "in a few months").
      // Park the sequence until that date so the re-entry cron reaches back out exactly
      // when they asked — and log them to the office follow-up list for oversight.
      // No either/or question: they already told us the reason.
      const reengage = parseDeferTimeframe(messageBody) ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      updatedFields.defer_until = reengage.toISOString();
      updatedFields.exit_reason = 'deferred';

      const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = MONTH_NAMES[reengage.getMonth()];

      // Office follow-up log — best-effort, never block the reply.
      try {
        await supabase.from('callback_requests').insert({
          practice_id: practice.id,
          patient_id: patient.id,
          patient_name: [patient.first_name, patient.last_name].filter(Boolean).join(' ') || null,
          phone: patient.phone || null,
          request_type: 'deferred_followup',
          message: `[re-engage ~${reengage.toISOString().slice(0, 10)}] ${messageBody}`,
        });
      } catch (e) {
        console.error('[replyHandler] deferred_followup insert failed:', e instanceof Error ? e.message : e);
      }

      return {
        replyText: `No problem at all — we'll reach back out around ${monthLabel} when the timing's better. Take care.`,
        updatedFields,
      };
    }

    case 'acknowledge_decline':
      return {
        replyText: `No worries. Is it a timing thing, or did you end up finding somewhere else?`,
        updatedFields,
      };

    case 'handoff_urgent':
      return {
        replyText: practice.phone
          ? `I'm so sorry to hear that — give us a call at ${practice.phone} and we'll get you taken care of ASAP.`
          : `I'm so sorry to hear that — hang on, someone will reach out right away to get you in.`,
        updatedFields,
      };

    case 'handoff_cost':
      return {
        replyText: `Good question — really depends on your insurance and what you need. We'll verify before you come in so there are no surprises. Mornings or afternoons work better?`,
        updatedFields,
      };

    case 'handoff_wrong_number':
      return {
        replyText: `So sorry about that — looks like we may have the wrong number. I'll take you off the list. Have a good one.`,
        updatedFields,
      };

    case 'handoff_general': {
      // Patient wants a human (callback or records/admin). Log to the office's
      // call list so someone follows up. Best-effort — never block the reply.
      const context = await buildCallbackContext(practice.id, patient.id, messageBody);
      await logCallbackRequest(practice, patient, context);
      return {
        replyText: practice.phone
          ? `Got it — someone from the office will reach out to you. If it's easier, you can also reach us at ${practice.phone}.`
          : `Got it — someone from the office will reach out to you shortly.`,
        updatedFields,
      };
    }

    case 'acknowledge_moved':
      updatedFields.exit_reason = 'moved';
      return {
        replyText: `Totally understand — thanks for letting us know, and best of luck with the move. We'll close out your reminders here. Take care.`,
        updatedFields,
      };

    case 'acknowledge_already_seen':
      updatedFields.exit_reason = 'already_current';
      return {
        replyText: `Perfect — sounds like you're all set. We'll catch you at your next visit. Take care.`,
        updatedFields,
      };

    case 'identify_practice':
      return {
        replyText: `This is ${practiceName} — Dr. Philip's office. We were reaching out to get you back in for a visit. Want me to find you a time?`,
        updatedFields,
      };

    case 'clarify_intent':
      return {
        replyText: `Happy to help — did you want to get in for a visit, or are you all set for now?`,
        updatedFields,
      };

    case 'cancel_booking':
      return {
        replyText: `Got it, cancelled. Let us know if you want to find another time.`,
        updatedFields,
      };

    case 'no_action_terminal':
      // Terminal stage — do NOT send any reply
      return {
        replyText: '',
        updatedFields,
      };

    case 'stay_in_stage':
    default:
      return {
        replyText: `Happy to help — want me to find you a time to come in, or are you all set?`,
        updatedFields,
      };
  }
}

// =============================================================================
// Helpers
// =============================================================================

// Build the office-facing context string for a callback row: ALL of the patient's
// recall inbound replies joined (not just the triggering one), so the office sees
// the full thread — e.g. "Yes, I need a Saturday | It's saying I'm a new patient".
async function buildCallbackContext(practiceId: string, patientId: string, fallbackMsg: string): Promise<string> {
  let context = fallbackMsg;
  try {
    const { data: inbound } = await supabase
      .from('conversations')
      .select('message_body')
      .eq('practice_id', practiceId)
      .eq('patient_id', patientId)
      .eq('automation_type', 'recall')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: true })
      .limit(10);
    const parts = (inbound || []).map(m => (m.message_body || '').trim()).filter(Boolean);
    if (!parts.some(p => p === fallbackMsg.trim())) parts.push(fallbackMsg.trim());
    if (parts.length) context = parts.join(' | ');
  } catch { /* fall back to single message */ }
  return context;
}

// Insert a callback_requests row. /record|chart/ language routes it to the records
// queue; everything else is a plain callback. Best-effort — never blocks the reply.
async function logCallbackRequest(practice: Practice, patient: Patient, context: string): Promise<void> {
  const requestType = /record|chart/.test(context.toLowerCase()) ? 'records' : 'callback';
  try {
    await supabase.from('callback_requests').insert({
      practice_id: practice.id,
      patient_id: patient.id,
      patient_name: [patient.first_name, patient.last_name].filter(Boolean).join(' ') || null,
      phone: patient.phone || null,
      request_type: requestType,
      message: context,
    });
  } catch (e) {
    console.error('[replyHandler] callback_requests insert failed:', e instanceof Error ? e.message : e);
  }
}

// Text-level backstop: if the outgoing reply promises a human follow-up, guarantee
// the patient is on the office call list — even when the LLM produced a conversational
// reply that never routed through the handoff_general action. handoff_general already
// logs its own row, so skip it here. Dedupe against an existing OPEN row so a patient
// isn't listed twice. Best-effort — never blocks the reply.
async function ensureCallbackFromReplyText(
  practice: Practice,
  patient: Patient,
  replyText: string,
  messageBody: string,
  action: string
): Promise<void> {
  if (action === 'handoff_general') return; // already logged by executeAction
  if (!replyText || !HANDOFF_PROMISE_REGEX.test(replyText)) return;
  try {
    const { data: existing } = await supabase
      .from('callback_requests')
      .select('id')
      .eq('practice_id', practice.id)
      .eq('patient_id', patient.id)
      .eq('status', 'open')
      .limit(1);
    if (existing && existing.length) return;
  } catch { /* if the dedupe check fails, fall through and insert */ }
  const context = await buildCallbackContext(practice.id, patient.id, messageBody);
  await logCallbackRequest(practice, patient, context);
}

function getExitReason(stage: RecallStage): string {
  switch (stage) {
    case 'EXIT_OPT_OUT': return 'opt_out';
    case 'EXIT_DEFERRED': return 'deferred';
    case 'EXIT_DECLINED': return 'declined';
    case 'EXIT_CANCELLED': return 'cancelled';
    case 'S7_HANDOFF': return 'handoff';
    case 'S6_COMPLETED': return 'completed';
    default: return 'unknown';
  }
}

function errorResult(sequenceId: string, patientId: string, error: string): ReplyHandlerResult {
  return {
    sequenceId,
    patientId,
    intent: 'unclear',
    previousStage: 'S0_OPENING',
    nextStage: 'S0_OPENING',
    action: 'error',
    replyText: '',
    smsSent: false,
    error,
  };
}

// =============================================================================
// Lookup: Find active sequence by patient phone
// =============================================================================

export async function findActiveSequenceByPhone(
  practiceId: string,
  phone: string
): Promise<RecallSequence | null> {
  // Find patient by phone
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('phone', phone)
    .limit(1)
    .single();

  if (!patient) return null;

  // Find active sequence
  const { data: seq } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('patient_id', patient.id)
    .eq('sequence_status', 'active')
    .limit(1)
    .single();

  return (seq as RecallSequence) || null;
}

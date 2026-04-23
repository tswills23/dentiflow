// Recall Reply Handler
// Phase 5: Main orchestrator for patient replies to recall SMS
//
// Flow: inbound SMS → classify intent → state machine transition →
//       execute action → generate reply → send SMS → update sequence

import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { logAutomation } from '../execution/metricsTracker';
import { classifyIntent, parsePreferences, extractSlotNumber } from './intentClassifier';
import { getTransition } from './bookingStateMachine';
import { getAvailableSlots, getDefaultSlots, slotsToDisplayList, getSlotByNumber } from './slotSelector';
import type {
  RecallSequence,
  RecallStage,
  ReplyHandlerResult,
  AvailableSlot,
  TimePreferences,
} from '../../types/recall';
import { notifyEscalation } from '../execution/staffNotifier';
import type { Practice, Patient } from '../../types/database';

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

  // 3. Increment reply count
  await supabase
    .from('recall_sequences')
    .update({ reply_count: (sequence.reply_count || 0) + 1 })
    .eq('id', sequenceId);

  // Increment recall_replies metric
  await supabase.rpc('increment_recall_metric', {
    p_practice_id: practiceId,
    p_date: new Date().toISOString().split('T')[0],
    p_field: 'recall_replies',
  });

  // 4. Classify intent
  const classification = classifyIntent(messageBody, sequence.booking_stage as RecallStage);

  // 5. Get state machine transition
  const transition = getTransition(
    sequence.booking_stage as RecallStage,
    classification.intent
  );

  // 6. Execute action and generate reply
  const { replyText, updatedFields } = await executeAction(
    transition.action,
    sequence,
    typedPatient,
    typedPractice,
    messageBody,
    classification
  );

  // 7. Update sequence in DB
  const updatePayload: Record<string, unknown> = {
    booking_stage: transition.nextStage,
    ...updatedFields,
  };

  if (transition.isTerminal) {
    updatePayload.sequence_status = transition.nextStage === 'S6_COMPLETED' ? 'completed' : 'exited';
    updatePayload.exit_reason = getExitReason(transition.nextStage);
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

    case 'handoff_general':
      return {
        replyText: practice.phone
          ? `Someone from our team will reach out — or give us a call at ${practice.phone}.`
          : `Someone from our team will reach out shortly.`,
        updatedFields,
      };

    case 'clarify_intent':
      return {
        replyText: `Just to make sure — were you looking to come in for a cleaning?`,
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
        replyText: `Just to make sure — were you looking to come in for a cleaning?`,
        updatedFields,
      };
  }
}

// =============================================================================
// Helpers
// =============================================================================

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

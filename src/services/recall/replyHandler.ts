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

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', sequence.patient_id)
    .single();

  if (!patient) {
    return errorResult(sequenceId, sequence.patient_id, 'Patient not found');
  }

  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (!practice) {
    return errorResult(sequenceId, sequence.patient_id, 'Practice not found');
  }

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
    patient,
    practice,
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
  const practiceName = practice.name;
  const updatedFields: Record<string, unknown> = {};

  switch (action) {
    case 'ask_preferences':
      return {
        replyText: `That's great, ${firstName}! Do you have a preference for days or times? For example, mornings or afternoons, or specific days of the week?`,
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
          replyText: `Thanks ${firstName}! I don't have openings matching those preferences right now. Would different days or times work for you?`,
          updatedFields,
        };
      }

      updatedFields.offered_slots = slots;
      const slotList = slotsToDisplayList(slots);

      return {
        replyText: `Here are some times that work at ${practiceName}:\n\n${slotList}\n\nJust reply with a number to pick one, or let me know if you'd like different options.`,
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
            replyText: `Got it! Just to confirm - you'd like ${selectedSlot.fullDisplay} at ${practiceName}. Does that work? Reply "yes" to confirm.`,
            updatedFields,
          };
        }
      }

      // Invalid slot selection
      const slotList = slotsToDisplayList(offeredSlots);
      return {
        replyText: `I didn't catch which slot you'd like. Here are the options again:\n\n${slotList}\n\nJust reply with 1, 2, or 3.`,
        updatedFields,
      };
    }

    case 'book_first_slot': {
      const offeredSlots = sequence.offered_slots || [];
      if (offeredSlots.length > 0) {
        const slot = offeredSlots[0];
        updatedFields.selected_slot = slot;
        return {
          replyText: `You're all set, ${firstName}! Your appointment at ${practiceName} is booked for ${slot.fullDisplay}. We'll see you then!`,
          updatedFields,
        };
      }
      return {
        replyText: `Thanks ${firstName}! Let me find some available times for you. Do you prefer mornings or afternoons?`,
        updatedFields,
      };
    }

    case 'complete_booking': {
      const slot = sequence.selected_slot;
      if (slot) {
        return {
          replyText: `You're all set, ${firstName}! Your appointment at ${practiceName} is confirmed for ${slot.fullDisplay}. We look forward to seeing you!`,
          updatedFields,
        };
      }
      return {
        replyText: `You're all set, ${firstName}! Your appointment at ${practiceName} is confirmed. We'll see you soon!`,
        updatedFields,
      };
    }

    case 'reshow_slots': {
      const offeredSlots = sequence.offered_slots || [];
      if (offeredSlots.length > 0) {
        const slotList = slotsToDisplayList(offeredSlots);
        return {
          replyText: `No problem! Here are those times again:\n\n${slotList}\n\nJust reply with a number, or let me know if you'd like different options.`,
          updatedFields,
        };
      }
      return {
        replyText: `Would you like me to show you some available times? Just let me know your preferred days or times.`,
        updatedFields,
      };
    }

    case 'opt_out_silent':
      updatedFields.opt_out = true;
      return {
        replyText: `You've been removed from our recall list. You won't receive further messages from ${practiceName}. If you ever want to schedule, just give us a call.`,
        updatedFields,
      };

    case 'defer_60_days':
      updatedFields.defer_until = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      updatedFields.exit_reason = 'deferred';
      return {
        replyText: `No problem at all, ${firstName}! We'll check back in a couple of months. Take care!`,
        updatedFields,
      };

    case 'acknowledge_decline':
      return {
        replyText: `Understood, ${firstName}. If you ever need to schedule a visit, we're here for you at ${practiceName}. Take care!`,
        updatedFields,
      };

    case 'handoff_urgent':
      return {
        replyText: `I'm sorry to hear that, ${firstName}. Please call us right away at ${practice.phone || 'our office'} so we can help you as soon as possible.`,
        updatedFields,
      };

    case 'handoff_cost':
      return {
        replyText: `Great question, ${firstName}! For specific pricing and insurance questions, please give us a call at ${practice.phone || 'our office'} and our team will be happy to help.`,
        updatedFields,
      };

    case 'handoff_wrong_number':
    case 'handoff_general':
      return {
        replyText: `I'll have someone from our team reach out to you directly. You can also call us at ${practice.phone || 'our office'}.`,
        updatedFields,
      };

    case 'clarify_intent':
      return {
        replyText: `Hi ${firstName}! I wasn't sure what you meant. Would you like to schedule a visit at ${practiceName}? Just reply "yes" to get started or let me know how I can help.`,
        updatedFields,
      };

    case 'cancel_booking':
      return {
        replyText: `No problem, ${firstName}. Your appointment has been cancelled. If you'd like to reschedule in the future, just let us know.`,
        updatedFields,
      };

    case 'no_action_terminal':
    case 'stay_in_stage':
    default:
      return {
        replyText: `Thanks for your message, ${firstName}! Would you like to schedule a visit at ${practiceName}? Just reply "yes" to get started.`,
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

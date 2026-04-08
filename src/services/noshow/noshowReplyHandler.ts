// No-Show Reply Handler
// Routes patient replies to the booking state machine at S3_TIME_PREF
//
// Key differences from recall reply handler:
// - Enters booking flow at S3_TIME_PREF (skip opening/intent — they already intended to book)
// - Defer period is 14 days (not 60)
// - Concern/fear replies route to S7_HANDOFF for staff follow-up
// - Office voice only

import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { logAutomation } from '../execution/metricsTracker';
import { classifyIntent, parsePreferences, extractSlotNumber } from '../recall/intentClassifier';
import { getTransition } from '../recall/bookingStateMachine';
import { getAvailableSlots, getDefaultSlots, slotsToDisplayList, getSlotByNumber } from '../recall/slotSelector';
import { notifyEscalation } from '../execution/staffNotifier';
import type {
  NoshowSequence,
  NoshowReplyResult,
  RecallStage,
  AvailableSlot,
} from '../../types/recall';
import type { Practice, Patient } from '../../types/database';

// Concern keywords that route to staff handoff
const CONCERN_PATTERNS = [
  /\b(scared|afraid|nervous|anxious|anxiety|fear|phobia)\b/i,
  /\b(can'?t afford|too expensive|no insurance|cost too much)\b/i,
  /\b(bad experience|hurt|pain|didn'?t like)\b/i,
];

function isConcernReply(text: string): boolean {
  return CONCERN_PATTERNS.some(p => p.test(text));
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function handleNoshowReply(
  sequenceId: string,
  patientPhone: string,
  messageBody: string,
  practiceId: string
): Promise<NoshowReplyResult> {
  // 1. Load sequence, patient, practice
  const { data: seq, error: seqErr } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('id', sequenceId)
    .single();

  if (seqErr || !seq) {
    return errorResult(sequenceId, 'unknown', `Sequence not found: ${sequenceId}`);
  }

  const sequence = seq as NoshowSequence;

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', sequence.patient_id)
    .single();

  if (!patient) {
    return errorResult(sequenceId, sequence.patient_id, 'Patient not found');
  }

  const typedPatient = patient as unknown as Patient;

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
    patientId: typedPatient.id,
    channel: 'sms',
    direction: 'inbound',
    messageBody,
    automationType: 'recall',
    metadata: { noshowSequenceId: sequenceId, bookingStage: sequence.booking_stage },
  });

  // 3. Increment reply count
  await supabase
    .from('noshow_sequences')
    .update({
      reply_count: (sequence.reply_count || 0) + 1,
      status: 'replied',
    })
    .eq('id', sequenceId);

  // 4. Check for concern/fear replies first — route to staff handoff
  if (isConcernReply(messageBody)) {
    return await handleConcernReply(sequence, typedPatient, typedPractice, messageBody);
  }

  // 5. Classify intent using existing classifier
  const currentStage = sequence.booking_stage as RecallStage;
  const classification = classifyIntent(messageBody, currentStage);

  // 6. Get state machine transition
  const transition = getTransition(currentStage, classification.intent);

  // 7. Execute action and generate reply (override defer to 14 days)
  const { replyText, updatedFields } = await executeNoshowAction(
    transition.action,
    sequence,
    typedPatient,
    typedPractice,
    messageBody,
    classification
  );

  // 8. Update sequence
  const updatePayload: Record<string, unknown> = {
    booking_stage: transition.nextStage,
    ...updatedFields,
  };

  if (transition.isTerminal) {
    updatePayload.status = mapTerminalToNoshowStatus(transition.nextStage);
    updatePayload.next_send_at = null;
  }

  await supabase
    .from('noshow_sequences')
    .update(updatePayload)
    .eq('id', sequenceId);

  // 9. Send reply SMS
  let smsSent = false;
  if (replyText && typedPractice.twilio_phone) {
    const sendResult = await sendSMS(patientPhone, replyText, typedPractice.twilio_phone);
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
          noshowSequenceId: sequenceId,
          action: transition.action,
          intent: classification.intent,
          stage: transition.nextStage,
        },
      });
    }
  }

  // 10. Handle terminal side effects
  if (transition.nextStage === 'S7_HANDOFF' && transition.action === 'handoff_urgent') {
    await notifyEscalation(typedPractice, typedPatient, 'Emergency detected during no-show recovery', messageBody);
  }

  if (transition.nextStage === 'EXIT_OPT_OUT') {
    await supabase
      .from('patients')
      .update({ recall_opt_out: true, recall_eligible: false })
      .eq('id', patient.id);
  }

  if (transition.nextStage === 'S6_COMPLETED') {
    await supabase
      .from('noshow_sequences')
      .update({ status: 'rebooked' })
      .eq('id', sequenceId);

    await supabase.rpc('increment_noshow_metric', {
      p_practice_id: practiceId,
      p_date: new Date().toISOString().split('T')[0],
      p_field: 'noshow_recovered',
    });
  }

  // 11. Log automation
  await logAutomation({
    practiceId,
    patientId: patient.id,
    automationType: 'noshow_recovery',
    action: transition.action,
    result: smsSent ? 'sent' : 'triggered',
    messageBody: replyText,
    metadata: {
      noshowSequenceId: sequenceId,
      intent: classification.intent,
      confidence: classification.confidence,
      previousStage: transition.currentStage,
      nextStage: transition.nextStage,
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
// Concern Reply → Staff Handoff
// =============================================================================

async function handleConcernReply(
  sequence: NoshowSequence,
  patient: Patient,
  practice: Practice,
  messageBody: string
): Promise<NoshowReplyResult> {
  const firstName = patient.first_name || 'there';

  const replyText = `I completely understand, ${firstName}. I'll have someone from our team reach out to you personally. You can also call us at ${practice.phone || 'our office'} anytime.`;

  // Update sequence to handoff
  await supabase
    .from('noshow_sequences')
    .update({
      status: 'declined', // concern = needs human, exit the automation
      booking_stage: 'S7_HANDOFF',
      next_send_at: null,
    })
    .eq('id', sequence.id);

  // Send reply
  let smsSent = false;
  if (practice.twilio_phone && patient.phone) {
    const sendResult = await sendSMS(patient.phone, replyText, practice.twilio_phone);
    smsSent = sendResult.success;

    if (sendResult.success) {
      await saveMessage({
        practiceId: practice.id,
        patientId: patient.id,
        channel: 'sms',
        direction: 'outbound',
        messageBody: replyText,
        aiGenerated: true,
        automationType: 'recall',
        twilioSid: sendResult.sid,
        metadata: { noshowSequenceId: sequence.id, action: 'concern_handoff' },
      });
    }
  }

  // Notify staff
  await notifyEscalation(
    practice,
    patient,
    'Patient expressed concern during no-show recovery',
    messageBody
  );

  await logAutomation({
    practiceId: practice.id,
    patientId: patient.id,
    automationType: 'noshow_recovery',
    action: 'concern_handoff',
    result: smsSent ? 'sent' : 'triggered',
    messageBody: replyText,
    metadata: { noshowSequenceId: sequence.id, concern: true },
  });

  return {
    sequenceId: sequence.id,
    patientId: patient.id,
    intent: 'decline',
    previousStage: sequence.booking_stage as RecallStage,
    nextStage: 'S7_HANDOFF',
    action: 'concern_handoff',
    replyText,
    smsSent,
  };
}

// =============================================================================
// Action Executor (same as recall but with 14-day defer)
// =============================================================================

async function executeNoshowAction(
  action: string,
  sequence: NoshowSequence,
  patient: Patient,
  practice: Practice,
  messageBody: string,
  classification: ReturnType<typeof classifyIntent>
): Promise<{ replyText: string; updatedFields: Record<string, unknown> }> {
  const firstName = patient.first_name || 'there';
  const practiceName = patient.location
    ? `${practice.name} ${patient.location}`
    : practice.name;
  const updatedFields: Record<string, unknown> = {};

  switch (action) {
    case 'ask_preferences':
      return {
        replyText: `Great, ${firstName}! Do you have a preference for days or times? For example, mornings or afternoons, or specific days of the week?`,
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
          replyText: `You're all set, ${firstName}! Your appointment at ${practiceName} is rebooked for ${slot.fullDisplay}. We'll see you then!`,
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
      return {
        replyText: `You've been removed from our list. You won't receive further messages from ${practiceName}. If you ever want to schedule, just give us a call.`,
        updatedFields,
      };

    case 'defer_60_days':
      // Override: no-shows get 14-day defer, not 60
      updatedFields.defer_until = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      return {
        replyText: `No problem at all, ${firstName}! We'll check back in a couple of weeks. Take care!`,
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
        replyText: `Hi ${firstName}! Would you like to reschedule your appointment at ${practiceName}? Just reply "yes" to get started or let me know how I can help.`,
        updatedFields,
      };

    case 'cancel_booking':
      return {
        replyText: `No problem, ${firstName}. If you'd like to reschedule in the future, just let us know.`,
        updatedFields,
      };

    default:
      return {
        replyText: `Thanks for your message, ${firstName}! Would you like to reschedule your appointment at ${practiceName}? Just reply "yes" to get started.`,
        updatedFields,
      };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function mapTerminalToNoshowStatus(stage: RecallStage): string {
  switch (stage) {
    case 'S6_COMPLETED': return 'rebooked';
    case 'EXIT_OPT_OUT': return 'opted_out';
    case 'EXIT_DEFERRED': return 'deferred';
    case 'EXIT_DECLINED': return 'declined';
    case 'EXIT_CANCELLED': return 'declined';
    case 'S7_HANDOFF': return 'declined';
    default: return 'no_response';
  }
}

function errorResult(sequenceId: string, patientId: string, error: string): NoshowReplyResult {
  return {
    sequenceId,
    patientId,
    intent: 'unclear',
    previousStage: 'S3_TIME_PREF',
    nextStage: 'S3_TIME_PREF',
    action: 'error',
    replyText: '',
    smsSent: false,
    error,
  };
}

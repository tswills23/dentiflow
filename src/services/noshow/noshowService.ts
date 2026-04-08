// No-Show Recovery Service
// Creates noshow sequences, sends Message 1/2, finds active sequences by phone
//
// Trigger: appointment status → 'no_show'
// Message 1: 1 hour after no-show recorded
// Message 2: 24 hours after Message 1 if no reply

import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { logAutomation } from '../execution/metricsTracker';
import { selectNoshowTemplate, renderTemplate, getNoshowTemplateId } from '../recall/templates';
import type { NoshowSequence } from '../../types/recall';
import type { Practice, Patient } from '../../types/database';
import type { NoshowDay } from '../recall/templates';

// =============================================================================
// Create No-Show Sequence
// =============================================================================

export async function createNoshowSequence(params: {
  practiceId: string;
  patientId: string;
  appointmentId: string;
}): Promise<NoshowSequence> {
  // Check for existing active sequence for this appointment
  const { data: existing } = await supabase
    .from('noshow_sequences')
    .select('id')
    .eq('appointment_id', params.appointmentId)
    .not('status', 'in', '("no_response","declined","opted_out")')
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`Active noshow sequence already exists for appointment ${params.appointmentId}`);
  }

  // Schedule Message 1 for 1 hour from now
  const sendAt = new Date(Date.now() + 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('noshow_sequences')
    .insert({
      practice_id: params.practiceId,
      patient_id: params.patientId,
      appointment_id: params.appointmentId,
      status: 'message_1_pending',
      booking_stage: 'S3_TIME_PREF',
      next_send_at: sendAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create noshow sequence: ${error.message}`);
  }

  // Increment noshow_total metric
  await supabase.rpc('increment_noshow_metric', {
    p_practice_id: params.practiceId,
    p_date: new Date().toISOString().split('T')[0],
    p_field: 'noshow_total',
  });

  await logAutomation({
    practiceId: params.practiceId,
    patientId: params.patientId,
    automationType: 'noshow_recovery',
    action: 'sequence_created',
    result: 'triggered',
    metadata: { appointmentId: params.appointmentId, scheduledSendAt: sendAt.toISOString() },
  });

  console.log(`[noshowService] Created sequence ${data.id} for patient ${params.patientId}, Message 1 at ${sendAt.toISOString()}`);
  return data as NoshowSequence;
}

// =============================================================================
// Send No-Show Message
// =============================================================================

export async function sendNoshowMessage(
  sequenceId: string,
  practiceId: string,
  messageDay: NoshowDay
): Promise<{ success: boolean; error?: string }> {
  const { data: seq, error: seqErr } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('id', sequenceId)
    .single();

  if (seqErr || !seq) {
    return { success: false, error: `Sequence not found: ${sequenceId}` };
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', seq.patient_id)
    .single();

  if (!patient || !patient.phone) {
    return { success: false, error: `Patient or phone not found: ${seq.patient_id}` };
  }

  if (patient.recall_opt_out) {
    return { success: false, error: 'Patient opted out' };
  }

  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (!practice || !practice.twilio_phone) {
    return { success: false, error: 'Practice or Twilio phone not found' };
  }

  // Select and render template
  const template = selectNoshowTemplate(messageDay, patient.phone);
  const templateId = getNoshowTemplateId(messageDay, patient.phone);

  const practiceName = patient.location
    ? `${practice.name} ${patient.location}`
    : practice.name;

  const messageBody = renderTemplate(
    template,
    patient.first_name || 'there',
    practiceName,
    '', // no doctor name for noshow (office voice only)
    ''  // no hygienist name
  );

  // Send SMS
  const sendResult = await sendSMS(patient.phone, messageBody, practice.twilio_phone);

  if (!sendResult.success) {
    await logAutomation({
      practiceId,
      patientId: patient.id,
      automationType: 'noshow_recovery',
      action: `noshow_message_${messageDay}`,
      result: 'failed',
      errorMessage: sendResult.error,
    });
    return { success: false, error: sendResult.error };
  }

  // Log outbound message
  await saveMessage({
    practiceId,
    patientId: patient.id,
    channel: 'sms',
    direction: 'outbound',
    messageBody,
    automationType: 'recall', // uses recall automation type for conversation log consistency
    twilioSid: sendResult.sid,
    metadata: { templateId, noshowDay: messageDay, sequenceId },
  });

  // Update sequence status
  const now = new Date().toISOString();
  const newStatus = messageDay === 1 ? 'message_1_sent' : 'message_2_sent';
  const nextSendAt = messageDay === 1
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Message 2 in 24h
    : null; // No more messages after Message 2

  await supabase
    .from('noshow_sequences')
    .update({
      status: newStatus,
      message_count: (seq.message_count || 0) + 1,
      last_sent_at: now,
      next_send_at: nextSendAt,
    })
    .eq('id', sequenceId);

  await logAutomation({
    practiceId,
    patientId: patient.id,
    automationType: 'noshow_recovery',
    action: `noshow_message_${messageDay}`,
    result: 'sent',
    messageBody,
    metadata: { templateId, sequenceId, simulated: sendResult.simulated },
  });

  console.log(`[noshowService] Sent Message ${messageDay} for sequence ${sequenceId}`);
  return { success: true };
}

// =============================================================================
// Find Active No-Show Sequence by Phone
// =============================================================================

const ACTIVE_NOSHOW_STATUSES = [
  'message_1_pending',
  'message_1_sent',
  'message_2_sent',
  'replied',
];

export async function findActiveNoshowSequenceByPhone(
  practiceId: string,
  phone: string
): Promise<NoshowSequence | null> {
  // Find patient by phone
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('phone', phone)
    .limit(1)
    .single();

  if (!patient) return null;

  // Find active noshow sequence
  const { data: seq } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('patient_id', patient.id)
    .in('status', ACTIVE_NOSHOW_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return (seq as NoshowSequence) || null;
}

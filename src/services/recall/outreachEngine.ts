// Recall Outreach Engine
// Phase 3: Day 0 SMS sending via existing smsService
//
// Picks up all active sequences at Day 0 with no last_sent_at,
// selects + renders template, sends SMS, logs everything.

import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { logAutomation } from '../execution/metricsTracker';
import { selectTemplate, renderTemplate, getTemplateId } from './templates';
import type { RecallSequence, OutreachResult, SequenceDay } from '../../types/recall';
import type { Practice, Patient } from '../../types/database';

export async function runDay0Outreach(practiceId: string): Promise<OutreachResult> {
  const result: OutreachResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  // 1. Get practice info
  const { data: practice, error: practiceErr } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (practiceErr || !practice) {
    result.errors.push(`Practice not found: ${practiceId}`);
    return result;
  }

  // 2. Get all Day 0 sequences that haven't been sent yet
  const { data: sequences, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .eq('sequence_day', 0)
    .is('last_sent_at', null);

  if (seqErr || !sequences?.length) {
    console.log('[outreachEngine] No Day 0 sequences to send');
    return result;
  }

  console.log(`[outreachEngine] Processing ${sequences.length} Day 0 sequences`);

  // 3. Process each sequence
  for (const seq of sequences as RecallSequence[]) {
    try {
      await sendOutreachSMS(seq, practice, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Sequence ${seq.id}: ${msg}`);
      result.failed++;
    }
  }

  console.log(
    `[outreachEngine] Day 0 complete: sent=${result.sent}, skipped=${result.skipped}, failed=${result.failed}`
  );

  return result;
}

export async function sendSequenceSMS(
  sequenceId: string,
  practiceId: string
): Promise<{ success: boolean; error?: string }> {
  // Get sequence
  const { data: seq, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('id', sequenceId)
    .single();

  if (seqErr || !seq) {
    return { success: false, error: `Sequence not found: ${sequenceId}` };
  }

  // Get practice
  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (!practice) {
    return { success: false, error: `Practice not found: ${practiceId}` };
  }

  const result: OutreachResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  await sendOutreachSMS(seq as RecallSequence, practice, result);

  if (result.sent > 0) return { success: true };
  return { success: false, error: result.errors[0] || 'Unknown error' };
}

async function sendOutreachSMS(
  seq: RecallSequence,
  practice: Practice,
  result: OutreachResult
): Promise<void> {
  // Get patient
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', seq.patient_id)
    .single();

  if (!patient) {
    result.errors.push(`Patient not found: ${seq.patient_id}`);
    result.skipped++;
    return;
  }

  if (!patient.phone) {
    result.errors.push(`No phone for patient: ${seq.patient_id}`);
    result.skipped++;
    return;
  }

  if (patient.recall_opt_out) {
    result.skipped++;
    return;
  }

  if (!practice.twilio_phone) {
    result.errors.push('Practice has no Twilio phone number');
    result.failed++;
    return;
  }

  // Select and render template
  const template = selectTemplate(
    seq.assigned_voice,
    seq.sequence_day as SequenceDay,
    patient.phone
  );
  const templateId = getTemplateId(
    seq.assigned_voice,
    seq.sequence_day as SequenceDay,
    patient.phone
  );
  const messageBody = renderTemplate(
    template,
    patient.first_name || 'there',
    practice.name,
    seq.months_overdue
  );

  // Send SMS
  const sendResult = await sendSMS(patient.phone, messageBody, practice.twilio_phone);

  if (!sendResult.success) {
    result.errors.push(`SMS failed for ${patient.phone}: ${sendResult.error}`);
    result.failed++;

    await logAutomation({
      practiceId: practice.id,
      patientId: patient.id,
      automationType: 'recall',
      action: `outreach_day${seq.sequence_day}`,
      result: 'failed',
      errorMessage: sendResult.error,
    });
    return;
  }

  // Log outbound message
  await saveMessage({
    practiceId: practice.id,
    patientId: patient.id,
    channel: 'sms',
    direction: 'outbound',
    messageBody,
    automationType: 'recall',
    twilioSid: sendResult.sid,
    metadata: { templateId, sequenceDay: seq.sequence_day, voice: seq.assigned_voice },
  });

  // Update sequence
  const now = new Date().toISOString();
  const nextSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +24h for Day 1

  await supabase
    .from('recall_sequences')
    .update({
      last_sent_at: now,
      template_id: templateId,
      next_send_at: seq.sequence_day < 3 ? nextSendAt : null,
    })
    .eq('id', seq.id);

  // Increment recall_sent metric
  await supabase.rpc('increment_recall_metric', {
    p_practice_id: practice.id,
    p_date: new Date().toISOString().split('T')[0],
    p_field: 'recall_sent',
  });

  await logAutomation({
    practiceId: practice.id,
    patientId: patient.id,
    automationType: 'recall',
    action: `outreach_day${seq.sequence_day}`,
    result: 'sent',
    messageBody,
    metadata: { templateId, simulated: sendResult.simulated },
  });

  result.sent++;
}

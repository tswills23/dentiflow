// Recall Outreach Engine
// Phase 3: Day 0 SMS sending via existing smsService
//
// Picks up all active sequences at Day 0 with no last_sent_at,
// selects + renders template, sends SMS, logs everything.

import { randomUUID } from 'crypto';
import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { logAutomation } from '../execution/metricsTracker';
import { selectTemplate, renderTemplate, getTemplateId } from './templates';
import { OFFER_DAY0, OFFER_TEMPLATE_ID } from './offerTemplates';
import { day3DeadlineTestEnabled, isDay3DeadlineArm, computeOfferDeadline } from './offerDeadline';
import type { RecallSequence, OutreachResult, SequenceDay } from '../../types/recall';
import type { Practice, Patient, Provider } from '../../types/database';

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error('BACKEND_URL env var is required — recall booking links will be malformed without it.');
}

// Extract doctor/hygienist display names from practice_config.providers
export function extractProviderNames(practice: Practice): { doctorName: string; hygienistName: string } {
  const providers = practice.practice_config?.providers || [];

  const doctor = providers.find((p: Provider) =>
    /dentist|doctor|dds|dmd/i.test(p.title)
  );
  const hygienist = providers.find((p: Provider) =>
    /hygienist|rdh/i.test(p.title)
  );

  // Strip any existing "Dr." prefix so templates that add it don't double it
  const rawDoctorName = doctor?.name || practice.owner_name || 'your dentist';
  const doctorName = rawDoctorName.replace(/^Dr\.?\s+/i, '').trim();
  const hygienistName = hygienist?.name || 'your hygiene team';

  return { doctorName, hygienistName };
}

export async function runDay0Outreach(
  practiceId: string,
  options?: { location?: string }
): Promise<OutreachResult> {
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

  const typedPractice = practice as unknown as Practice;

  // 2. Get Day 0 sequences scoped to location if provided
  // Join patients!inner so we can filter by patient.location without a separate query.
  // This prevents cross-location sends when multiple locations are loaded in the same practice.
  let query = supabase
    .from('recall_sequences')
    .select('*, patients!inner(location)')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .eq('sequence_day', 0)
    .is('last_sent_at', null);

  if (options?.location) {
    query = query.ilike('patients.location', `%${options.location}%`);
  }

  const { data: sequences, error: seqErr } = await query;

  if (seqErr || !sequences?.length) {
    console.log('[outreachEngine] No Day 0 sequences to send');
    return result;
  }

  const locationLabel = options?.location ? ` for "${options.location}"` : '';
  console.log(`[outreachEngine] Processing ${sequences.length} Day 0 sequences${locationLabel}`);

  // 3. Process each sequence — hard rate limit: 1 msg/sec
  // Burst sends triggered Twilio account suspension on 2026-04-08. No exceptions.
  for (const seq of sequences as RecallSequence[]) {
    try {
      await sendOutreachSMS(seq, typedPractice, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Sequence ${seq.id}: ${msg}`);
      result.failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
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
  await sendOutreachSMS(seq as RecallSequence, practice as unknown as Practice, result);

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

  // Generate booking link token (once per sequence, reused across days)
  let bookingLinkToken = seq.booking_link_token;
  if (!bookingLinkToken) {
    bookingLinkToken = randomUUID();
    await supabase
      .from('recall_sequences')
      .update({ booking_link_token: bookingLinkToken })
      .eq('id', seq.id);
  }
  const bookingLink = `${BACKEND_URL}/r/${bookingLinkToken}`;

  // Day 3 "30% off" deadline A/B (gated by practice_config.day3_deadline_test).
  // When on, ~half the patients (deterministic phone hash) get the deadline copy
  // with {{Offer Deadline}} = send date + 5 days (skipping closed days).
  const useDeadlineOffer =
    seq.sequence_day === 3 &&
    day3DeadlineTestEnabled(practice) &&
    isDay3DeadlineArm(patient.phone);
  const offerDeadline = useDeadlineOffer
    ? computeOfferDeadline(new Date().toISOString(), practice, 5)
    : undefined;

  // Select and render template — Arm B (offer_only) uses fixed offer copy on Day 0,
  // Arm A (control_voice) and non-experiment sequences use the partner-locked template bank.
  const isOfferArm = seq.experiment_arm === 'offer_only';
  const template = isOfferArm
    ? OFFER_DAY0
    : selectTemplate(
        seq.assigned_voice,
        seq.sequence_day as SequenceDay,
        patient.phone,
        seq.experiment_arm,
        useDeadlineOffer
      );
  const templateId = isOfferArm
    ? OFFER_TEMPLATE_ID
    : getTemplateId(
        seq.assigned_voice,
        seq.sequence_day as SequenceDay,
        patient.phone,
        seq.experiment_arm,
        useDeadlineOffer
      );
  // Use patient location as display name when available, otherwise practice name
  const displayName = patient.location || practice.name;

  const { doctorName, hygienistName } = extractProviderNames(practice);

  const messageBody = renderTemplate(
    template,
    patient.first_name || 'there',
    displayName,
    doctorName,
    hygienistName,
    bookingLink,
    offerDeadline
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

  // Update sequence.
  // Arm B (offer_only) is single-send: no follow-up scheduled, defer_until set so
  // the sweeper auto-exits after 7 days if no reply (reply handler still works during the window).
  const now = new Date().toISOString();
  const nextSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +24h for Day 1
  const deferUntil7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('recall_sequences')
    .update({
      last_sent_at: now,
      template_id: templateId,
      next_send_at: isOfferArm ? null : (seq.sequence_day < 3 ? nextSendAt : null),
      defer_until: isOfferArm ? deferUntil7d : seq.defer_until,
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

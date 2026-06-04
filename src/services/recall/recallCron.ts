// Recall Cron — Hourly sequence orchestrator
// Queries all practices with active recall sequences, runs orchestrator for each

import cron, { type ScheduledTask } from 'node-cron';
import { supabase } from '../../lib/supabase';
import { runSequenceOrchestrator } from './sequenceOrchestrator';
import { logAutomation } from '../execution/metricsTracker';
import { attributeReactivationBookings } from './bookingAttribution';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';

let cronTask: ScheduledTask | null = null;

export async function runOrchestratorForAllPractices(): Promise<{
  practicesProcessed: number;
  results: Record<string, { advanced: number; autoExited: number; reEntered: number; errors: string[] }>;
  errors: string[];
}> {
  const summary = {
    practicesProcessed: 0,
    results: {} as Record<string, { advanced: number; autoExited: number; reEntered: number; errors: string[] }>,
    errors: [] as string[],
  };

  // Get all practices with active recall sequences
  const { data: rows, error } = await supabase
    .from('recall_sequences')
    .select('practice_id')
    .eq('sequence_status', 'active');

  if (error) {
    summary.errors.push(`Failed to query active sequences: ${error.message}`);
    console.error('[recallCron] Query error:', error.message);
    return summary;
  }

  // Deduplicate practice IDs
  const practiceIds = [...new Set((rows || []).map((r: { practice_id: string }) => r.practice_id))];

  if (practiceIds.length === 0) {
    console.log('[recallCron] No practices with active recall sequences');
    return summary;
  }

  console.log(`[recallCron] Running orchestrator for ${practiceIds.length} practice(s)`);

  // Optional location filter — set RECALL_LOCATION_FILTER env var to restrict cron to one location
  const locationFilter = process.env.RECALL_LOCATION_FILTER || undefined;
  if (locationFilter) {
    console.log(`[recallCron] Location filter active: "${locationFilter}"`);
  }

  for (const practiceId of practiceIds) {
    try {
      const result = await runSequenceOrchestrator(practiceId, locationFilter ? { location: locationFilter } : undefined);
      summary.results[practiceId] = result;
      summary.practicesProcessed++;

      if (result.advanced > 0 || result.autoExited > 0 || result.reEntered > 0) {
        console.log(
          `[recallCron] Practice ${practiceId}: advanced=${result.advanced}, exited=${result.autoExited}, reEntered=${result.reEntered}`
        );
      }

      // Run booking attribution (cross-reference appointments)
      try {
        const attrResult = await attributeReactivationBookings(practiceId);
        if (attrResult.attributed > 0) {
          console.log(`[recallCron] Practice ${practiceId}: attributed ${attrResult.attributed} bookings`);
        }
      } catch (attrErr) {
        console.error(`[recallCron] Attribution error for ${practiceId}:`, attrErr);
      }

      // Send link-click follow-ups: Stage 1 at +1h, Stage 2 at +24h if no reply
      try {
        await sendLinkFollowups(practiceId);
      } catch (fuErr) {
        console.error(`[recallCron] Follow-up error for ${practiceId}:`, fuErr);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Practice ${practiceId}: ${msg}`);
      console.error(`[recallCron] Error for practice ${practiceId}:`, msg);
    }
  }

  await logAutomation({
    practiceId: 'system',
    automationType: 'recall',
    action: 'cron_orchestrate',
    result: 'sent',
    metadata: {
      practicesProcessed: summary.practicesProcessed,
      totalErrors: summary.errors.length,
    },
  });

  return summary;
}

/**
 * Two-stage link-click follow-up for patients who clicked the booking link
 * but haven't been marked as booked yet.
 *   Stage 1 (link_followup_count 0 → 1): ~3h after the click. Skipped if the
 *     patient already replied since clicking (a live conversation is handling it).
 *     Widened from 1h → 3h (Jeffrey Wilson incident 2026-06-04): a 1h nudge hit
 *     patients who were still mid-booking and read as spam.
 *   Stage 2 (link_followup_count 1 → 2): ~24h after Stage 1, only if the patient
 *     never replied to the Stage 1 text.
 * Booked patients are excluded automatically — booking attribution flips their
 * sequence_status to 'completed', and both queries filter on 'active'.
 */
async function sendLinkFollowups(practiceId: string): Promise<void> {
  const now = Date.now();
  const stage1Cutoff = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // clicked ≥3h ago
  const stage2Cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString(); // Stage 1 sent ≥24h ago

  // Stage 1 candidates: clicked the link, no follow-up sent yet.
  const { data: stage1 } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, link_clicked_at')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .eq('link_followup_count', 0)
    .not('link_clicked_at', 'is', null)
    .lte('link_clicked_at', stage1Cutoff);

  // Stage 2 candidates: Stage 1 sent ≥24h ago, still active.
  const { data: stage2 } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, link_followup_last_sent_at')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .eq('link_followup_count', 1)
    .not('link_followup_last_sent_at', 'is', null)
    .lte('link_followup_last_sent_at', stage2Cutoff);

  if (!stage1?.length && !stage2?.length) return;

  const { data: practice } = await supabase
    .from('practices')
    .select('name, twilio_phone')
    .eq('id', practiceId)
    .single();

  if (!practice?.twilio_phone) return;
  const practiceName = practice.name;
  const twilioPhone = practice.twilio_phone;

  // Stage 1: send the first nudge unless they've already replied since clicking.
  for (const seq of stage1 || []) {
    if (await hasInboundSince(practiceId, seq.patient_id, seq.link_clicked_at)) continue;
    await sendFollowup(practiceId, practiceName, twilioPhone, seq.id, seq.patient_id, 1);
  }

  // Stage 2: send the second nudge only if they never replied to Stage 1.
  for (const seq of stage2 || []) {
    if (await hasInboundSince(practiceId, seq.patient_id, seq.link_followup_last_sent_at)) continue;
    await sendFollowup(practiceId, practiceName, twilioPhone, seq.id, seq.patient_id, 2);
  }
}

/** True if the patient has any inbound message after the given timestamp. */
async function hasInboundSince(
  practiceId: string,
  patientId: string,
  sinceIso: string | null
): Promise<boolean> {
  if (!sinceIso) return false;
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('patient_id', patientId)
    .eq('direction', 'inbound')
    .gt('created_at', sinceIso)
    .limit(1);
  return !!data?.length;
}

/** Send a single follow-up touch and advance the cadence counter. */
async function sendFollowup(
  practiceId: string,
  practiceName: string,
  twilioPhone: string,
  sequenceId: string,
  patientId: string,
  stage: 1 | 2
): Promise<void> {
  const { data: patient } = await supabase
    .from('patients')
    .select('first_name, phone, location')
    .eq('id', patientId)
    .single();

  if (!patient?.phone) return;

  const firstName = patient.first_name || 'there';
  const displayName = patient.location || practiceName;

  const followupText =
    stage === 1
      ? `Hey ${firstName}, were you able to grab a time at ${displayName}? Reply YES if you're all set — or let me know if anything got in the way.`
      : `Hey ${firstName}, just circling back — still happy to help you find a time at ${displayName} if you didn't get a chance. Want me to text you a couple of openings?`;

  const sendResult = await sendSMS(patient.phone, followupText, twilioPhone);

  if (sendResult.success) {
    await saveMessage({
      practiceId,
      patientId,
      channel: 'sms',
      direction: 'outbound',
      messageBody: followupText,
      automationType: 'recall',
      twilioSid: sendResult.sid,
      metadata: { sequenceId, action: 'link_followup', stage },
    });
  }

  // Advance the cadence counter regardless of delivery so we don't loop.
  await supabase
    .from('recall_sequences')
    .update({
      link_followup_count: stage,
      link_followup_last_sent_at: new Date().toISOString(),
      link_followup_sent: true,
    })
    .eq('id', sequenceId);

  await logAutomation({
    practiceId,
    patientId,
    automationType: 'recall',
    action: 'link_followup',
    result: sendResult.success ? 'sent' : 'failed',
    messageBody: followupText,
    metadata: { sequenceId, stage },
  });

  console.log(`[recallCron] Link follow-up Stage ${stage} sent for sequence ${sequenceId}`);
}

export function startRecallCron(): void {
  if (cronTask) {
    console.warn('[recallCron] Cron already running, skipping duplicate start');
    return;
  }

  cronTask = cron.schedule('0 * * * *', async () => {
    console.log(`[recallCron] Hourly tick at ${new Date().toISOString()}`);
    try {
      const result = await runOrchestratorForAllPractices();
      console.log(
        `[recallCron] Complete: ${result.practicesProcessed} practices, ${result.errors.length} errors`
      );
    } catch (err) {
      console.error('[recallCron] Unhandled error:', err);
    }
  });

  console.log('[recallCron] Hourly recall orchestrator cron started (0 * * * *)');
}

export function stopRecallCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[recallCron] Cron stopped');
  }
}

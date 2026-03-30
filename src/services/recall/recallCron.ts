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

  for (const practiceId of practiceIds) {
    try {
      const result = await runSequenceOrchestrator(practiceId);
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

      // Send follow-up SMS to patients who clicked the link 24h+ ago but haven't booked
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
 * Send follow-up SMS to patients who clicked the booking link 24h+ ago
 * but haven't been marked as booked yet. Asks them to confirm.
 */
async function sendLinkFollowups(practiceId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sequences } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, link_clicked_at')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .eq('link_followup_sent', false)
    .not('link_clicked_at', 'is', null)
    .lte('link_clicked_at', cutoff);

  if (!sequences?.length) return;

  const { data: practice } = await supabase
    .from('practices')
    .select('name, twilio_phone')
    .eq('id', practiceId)
    .single();

  if (!practice?.twilio_phone) return;

  for (const seq of sequences) {
    const { data: patient } = await supabase
      .from('patients')
      .select('first_name, phone, location')
      .eq('id', seq.patient_id)
      .single();

    if (!patient?.phone) continue;

    const firstName = patient.first_name || 'there';
    const displayName = patient.location
      ? `${practice.name} ${patient.location}`
      : practice.name;

    const followupText = `Hey ${firstName}, were you able to grab a time at ${displayName}? Reply YES if you're all set, or let us know if you need help!`;

    const sendResult = await sendSMS(patient.phone, followupText, practice.twilio_phone);

    if (sendResult.success) {
      await saveMessage({
        practiceId,
        patientId: seq.patient_id,
        channel: 'sms',
        direction: 'outbound',
        messageBody: followupText,
        automationType: 'recall',
        twilioSid: sendResult.sid,
        metadata: { sequenceId: seq.id, action: 'link_followup' },
      });
    }

    // Mark followup as sent regardless of delivery
    await supabase
      .from('recall_sequences')
      .update({ link_followup_sent: true })
      .eq('id', seq.id);

    await logAutomation({
      practiceId,
      patientId: seq.patient_id,
      automationType: 'recall',
      action: 'link_followup',
      result: sendResult.success ? 'sent' : 'failed',
      messageBody: followupText,
      metadata: { sequenceId: seq.id },
    });

    console.log(`[recallCron] Follow-up sent for sequence ${seq.id}`);
  }
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

// No-Show Recovery Cron — Hourly orchestrator
//
// Checks for noshow_sequences that need action:
// 1. message_1_pending with next_send_at passed → send Message 1
// 2. message_1_sent for 24h+ with no reply → send Message 2
// 3. message_2_sent for 24h+ with no reply → close as no_response
// 4. deferred sequences with defer_until passed → re-enter at Message 1

import cron, { type ScheduledTask } from 'node-cron';
import { supabase } from '../../lib/supabase';
import { sendNoshowMessage } from './noshowService';
import { logAutomation } from '../execution/metricsTracker';
import type { NoshowSequence } from '../../types/recall';

let cronTask: ScheduledTask | null = null;

export interface NoshowCronResult {
  practicesProcessed: number;
  message1Sent: number;
  message2Sent: number;
  autoExited: number;
  reEntered: number;
  errors: string[];
}

export async function runNoshowOrchestrator(): Promise<NoshowCronResult> {
  const result: NoshowCronResult = {
    practicesProcessed: 0,
    message1Sent: 0,
    message2Sent: 0,
    autoExited: 0,
    reEntered: 0,
    errors: [],
  };

  const now = new Date();

  // 1. Send pending Message 1s (scheduled 1h after no-show)
  await sendPendingMessage1s(now, result);

  // 2. Advance Message 1 → Message 2 (24h after Message 1, no reply)
  await advanceToMessage2(now, result);

  // 3. Auto-close Message 2 sequences (24h after Message 2, no reply)
  await autoCloseNoResponse(now, result);

  // 4. Re-enter deferred sequences (14 days after deferral)
  await reEnterDeferred(now, result);

  if (result.message1Sent > 0 || result.message2Sent > 0 || result.autoExited > 0 || result.reEntered > 0) {
    console.log(
      `[noshowCron] Done: msg1=${result.message1Sent}, msg2=${result.message2Sent}, exited=${result.autoExited}, reEntered=${result.reEntered}`
    );
  }

  return result;
}

// =============================================================================
// Step 1: Send pending Message 1s
// =============================================================================

async function sendPendingMessage1s(now: Date, result: NoshowCronResult): Promise<void> {
  const { data: sequences, error } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('status', 'message_1_pending')
    .not('next_send_at', 'is', null)
    .lte('next_send_at', now.toISOString());

  if (error || !sequences?.length) return;

  for (const seq of sequences as NoshowSequence[]) {
    try {
      const sendResult = await sendNoshowMessage(seq.id, seq.practice_id, 1);
      if (sendResult.success) {
        result.message1Sent++;
      } else {
        result.errors.push(`Message 1 failed for ${seq.id}: ${sendResult.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error sending Message 1 for ${seq.id}: ${msg}`);
    }
  }
}

// =============================================================================
// Step 2: Message 1 → Message 2 (24h after Message 1)
// =============================================================================

async function advanceToMessage2(now: Date, result: NoshowCronResult): Promise<void> {
  const { data: sequences, error } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('status', 'message_1_sent')
    .eq('reply_count', 0)
    .not('next_send_at', 'is', null)
    .lte('next_send_at', now.toISOString());

  if (error || !sequences?.length) return;

  for (const seq of sequences as NoshowSequence[]) {
    try {
      const sendResult = await sendNoshowMessage(seq.id, seq.practice_id, 2);
      if (sendResult.success) {
        result.message2Sent++;
      } else {
        result.errors.push(`Message 2 failed for ${seq.id}: ${sendResult.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error sending Message 2 for ${seq.id}: ${msg}`);
    }
  }
}

// =============================================================================
// Step 3: Auto-close no_response (24h after Message 2)
// =============================================================================

async function autoCloseNoResponse(now: Date, result: NoshowCronResult): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

  const { data: sequences, error } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('status', 'message_2_sent')
    .eq('reply_count', 0)
    .not('last_sent_at', 'is', null)
    .lte('last_sent_at', cutoff.toISOString());

  if (error || !sequences?.length) return;

  for (const seq of sequences as NoshowSequence[]) {
    await supabase
      .from('noshow_sequences')
      .update({
        status: 'no_response',
        next_send_at: null,
      })
      .eq('id', seq.id);

    await logAutomation({
      practiceId: seq.practice_id,
      patientId: seq.patient_id,
      automationType: 'noshow_recovery',
      action: 'auto_exit',
      result: 'sent',
      metadata: { reason: 'no_response_after_message2' },
    });

    result.autoExited++;
  }
}

// =============================================================================
// Step 4: Re-enter deferred (14 days after deferral)
// =============================================================================

async function reEnterDeferred(now: Date, result: NoshowCronResult): Promise<void> {
  const { data: sequences, error } = await supabase
    .from('noshow_sequences')
    .select('*')
    .eq('status', 'deferred')
    .not('defer_until', 'is', null)
    .lte('defer_until', now.toISOString());

  if (error || !sequences?.length) return;

  for (const seq of sequences as NoshowSequence[]) {
    // Reset to Message 1 pending (will be picked up by step 1 next tick)
    const sendAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await supabase
      .from('noshow_sequences')
      .update({
        status: 'message_1_pending',
        message_count: 0,
        booking_stage: 'S3_TIME_PREF',
        reply_count: 0,
        next_send_at: sendAt.toISOString(),
        last_sent_at: null,
        defer_until: null,
        offered_slots: null,
        selected_slot: null,
        patient_preferences: null,
      })
      .eq('id', seq.id);

    await logAutomation({
      practiceId: seq.practice_id,
      patientId: seq.patient_id,
      automationType: 'noshow_recovery',
      action: 're_enter_deferred',
      result: 'sent',
    });

    result.reEntered++;
  }
}

// =============================================================================
// Cron Lifecycle
// =============================================================================

export function startNoshowCron(): void {
  if (cronTask) {
    console.warn('[noshowCron] Cron already running, skipping duplicate start');
    return;
  }

  // Run at minute 5 of every hour (offset from recall cron at minute 0)
  cronTask = cron.schedule('5 * * * *', async () => {
    console.log(`[noshowCron] Hourly tick at ${new Date().toISOString()}`);
    try {
      const result = await runNoshowOrchestrator();
      if (result.errors.length > 0) {
        console.error(`[noshowCron] ${result.errors.length} errors:`, result.errors.slice(0, 3));
      }
    } catch (err) {
      console.error('[noshowCron] Unhandled error:', err);
    }
  });

  console.log('[noshowCron] Hourly no-show recovery cron started (5 * * * *)');
}

export function stopNoshowCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[noshowCron] Cron stopped');
  }
}

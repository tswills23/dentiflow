// Recall Reply Monitor — every 15 min, scans audit table for last window.
//
// Auto-disables LLM path on validator_block (sets practices.recall_llm_enabled=false).
// SMS-alerts ALERT_PHONE_NUMBER on validator_blocks, fallback rate spikes,
// or p95 latency spikes.
//
// Detection cadence is the most important safety surface added by this rollout.
// Without this, bad LLM behavior could go unnoticed for hours.

import cron, { type ScheduledTask } from 'node-cron';
import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
// Types generated pre-migration. See memory/supabase-types-debugging.md.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

let monitorTask: ScheduledTask | null = null;

interface MonitorWindow {
  practice_id: string;
  practice_name: string;
  total: number;
  llm_replies: number;
  fallbacks: number;
  validator_blocks: number;
  p95_latency_ms: number | null;
  validator_block_reasons: string[];
}

const FALLBACK_RATE_THRESHOLD = 0.25;
const P95_LATENCY_MS_THRESHOLD = 5000;

export async function runMonitorTick(): Promise<void> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Pull all audit rows from the last window
  const { data: rows, error } = await db
    .from('recall_reply_audit')
    .select('practice_id, used_llm, fallback_reason, validator_block_reason, llm_latency_ms')
    .gte('created_at', fifteenMinAgo);

  if (error) {
    console.error('[recallReplyMonitor] query error:', error.message);
    return;
  }
  if (!rows || rows.length === 0) {
    return; // nothing to do
  }

  // Group by practice_id
  const byPractice = new Map<string, MonitorWindow>();
  for (const row of rows as Array<{
    practice_id: string;
    used_llm: boolean;
    fallback_reason: string | null;
    validator_block_reason: string | null;
    llm_latency_ms: number | null;
  }>) {
    const window = byPractice.get(row.practice_id) ?? {
      practice_id: row.practice_id,
      practice_name: '',
      total: 0,
      llm_replies: 0,
      fallbacks: 0,
      validator_blocks: 0,
      p95_latency_ms: null,
      validator_block_reasons: [] as string[],
    };
    window.total++;
    if (row.used_llm) window.llm_replies++;
    if (row.fallback_reason) window.fallbacks++;
    if (row.validator_block_reason) {
      window.validator_blocks++;
      window.validator_block_reasons.push(row.validator_block_reason);
    }
    byPractice.set(row.practice_id, window);
  }

  // Compute p95 per practice
  for (const window of byPractice.values()) {
    const latencies = (rows as Array<{ practice_id: string; llm_latency_ms: number | null }>)
      .filter((r) => r.practice_id === window.practice_id && typeof r.llm_latency_ms === 'number')
      .map((r) => r.llm_latency_ms as number)
      .sort((a, b) => a - b);
    if (latencies.length > 0) {
      const idx = Math.floor(latencies.length * 0.95);
      window.p95_latency_ms = latencies[Math.min(idx, latencies.length - 1)];
    }
  }

  // Look up practice names
  const practiceIds = Array.from(byPractice.keys());
  if (practiceIds.length > 0) {
    const { data: practices } = await supabase
      .from('practices')
      .select('id, name')
      .in('id', practiceIds);
    for (const p of (practices || []) as Array<{ id: string; name: string }>) {
      const window = byPractice.get(p.id);
      if (window) window.practice_name = p.name;
    }
  }

  // Evaluate thresholds and act
  for (const window of byPractice.values()) {
    await evaluateWindow(window);
  }
}

async function evaluateWindow(window: MonitorWindow): Promise<void> {
  const alertPhone = process.env.ALERT_PHONE_NUMBER;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  // Threshold 1 — validator block: AUTO-DISABLE LLM for this practice
  if (window.validator_blocks >= 1) {
    console.error(
      `[recallReplyMonitor] CRITICAL: ${window.validator_blocks} validator block(s) at ${window.practice_name} — auto-disabling LLM`
    );
    const { error: disableErr } = await db
      .from('practices')
      .update({ recall_llm_enabled: false })
      .eq('id', window.practice_id);
    if (disableErr) {
      console.error('[recallReplyMonitor] auto-disable failed:', disableErr.message);
    }

    if (alertPhone && twilioFrom) {
      const reasons = [...new Set(window.validator_block_reasons)].join(', ');
      await sendSMS(
        alertPhone,
        `[ALERT] Recall LLM auto-disabled at ${window.practice_name}. ${window.validator_blocks} validator block(s) in last 15min. Reasons: ${reasons}. Check audit table.`,
        twilioFrom
      ).catch((e) => console.error('[recallReplyMonitor] alert SMS failed:', e));
    }
    return; // don't double-alert below
  }

  // Threshold 2 — high fallback rate (warning, no auto-disable)
  if (window.llm_replies > 0) {
    const fallbackRate = window.fallbacks / window.total;
    if (fallbackRate > FALLBACK_RATE_THRESHOLD) {
      console.warn(
        `[recallReplyMonitor] WARN: ${window.practice_name} fallback rate ${(fallbackRate * 100).toFixed(0)}% (${window.fallbacks}/${window.total})`
      );
      if (alertPhone && twilioFrom) {
        await sendSMS(
          alertPhone,
          `[WARN] Recall fallback rate ${(fallbackRate * 100).toFixed(0)}% at ${window.practice_name} (${window.fallbacks}/${window.total} in 15min).`,
          twilioFrom
        ).catch((e) => console.error('[recallReplyMonitor] warn SMS failed:', e));
      }
    }
  }

  // Threshold 3 — slow p95 latency
  if (window.p95_latency_ms !== null && window.p95_latency_ms > P95_LATENCY_MS_THRESHOLD) {
    console.warn(
      `[recallReplyMonitor] WARN: ${window.practice_name} p95 latency ${window.p95_latency_ms}ms`
    );
    if (alertPhone && twilioFrom) {
      await sendSMS(
        alertPhone,
        `[WARN] Recall LLM p95 latency ${window.p95_latency_ms}ms at ${window.practice_name}.`,
        twilioFrom
      ).catch((e) => console.error('[recallReplyMonitor] latency SMS failed:', e));
    }
  }
}

export function startRecallReplyMonitor(): void {
  if (monitorTask) {
    console.warn('[recallReplyMonitor] Cron already running, skipping duplicate start');
    return;
  }
  // Every 15 minutes
  monitorTask = cron.schedule('*/15 * * * *', async () => {
    try {
      await runMonitorTick();
    } catch (err) {
      console.error('[recallReplyMonitor] tick error:', err);
    }
  });
  console.log('[recallReplyMonitor] 15-min monitor cron started');
}

export function stopRecallReplyMonitor(): void {
  if (monitorTask) {
    monitorTask.stop();
    monitorTask = null;
    console.log('[recallReplyMonitor] Cron stopped');
  }
}

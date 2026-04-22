// Sequence Orchestrator
// Phase 4: Day 1/3 follow-ups, auto-exit, deferred re-entry
//
// Cadence: Day 0 → Day 1 (+24h) → Day 3 (+48h) → auto-exit (+48h)
// Runs on a schedule (cron or manual trigger)

import { supabase } from '../../lib/supabase';
import { logAutomation } from '../execution/metricsTracker';
import { sendSequenceSMS } from './outreachEngine';
import type { RecallSequence, SequenceDay } from '../../types/recall';

const NEXT_DAY_MAP: Record<number, SequenceDay | null> = {
  0: 1,   // Day 0 → Day 1
  1: 3,   // Day 1 → Day 3
  3: null, // Day 3 → done (auto-exit after 48h if no reply)
};

const HOURS_BETWEEN_SENDS: Record<number, number> = {
  0: 24, // Day 0 → Day 1: 24h
  1: 48, // Day 1 → Day 3: 48h
  3: 48, // Day 3 → auto-exit: 48h
};

export interface OrchestrateResult {
  advanced: number;
  autoExited: number;
  reEntered: number;
  errors: string[];
}

export async function runSequenceOrchestrator(
  practiceId: string,
  options?: { location?: string }
): Promise<OrchestrateResult> {
  const result: OrchestrateResult = {
    advanced: 0,
    autoExited: 0,
    reEntered: 0,
    errors: [],
  };

  const now = new Date();

  const locationLabel = options?.location ? ` [location: ${options.location}]` : '';
  console.log(`[sequenceOrchestrator] Starting${locationLabel}`);

  // 1. Process sequences ready for next send
  await processReadySequences(practiceId, now, result, options?.location);

  // 2. Auto-exit Day 3 sequences that have timed out
  await autoExitTimedOut(practiceId, now, result, options?.location);

  // 3. Re-enter deferred sequences whose defer_until has passed
  await reEnterDeferred(practiceId, now, result, options?.location);

  console.log(
    `[sequenceOrchestrator] Done: advanced=${result.advanced}, autoExited=${result.autoExited}, reEntered=${result.reEntered}`
  );

  return result;
}

async function processReadySequences(
  practiceId: string,
  now: Date,
  result: OrchestrateResult,
  location?: string
): Promise<void> {
  // Find active sequences whose next_send_at has passed
  let query = supabase
    .from('recall_sequences')
    .select('*, patients!inner(location)')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .not('next_send_at', 'is', null)
    .lte('next_send_at', now.toISOString())
    .not('last_sent_at', 'is', null); // Must have sent Day 0 already

  if (location) {
    query = query.ilike('patients.location', `%${location}%`);
  }

  const { data: sequences, error } = await query;

  if (error || !sequences?.length) return;

  for (const seq of sequences as RecallSequence[]) {
    try {
      const nextDay = NEXT_DAY_MAP[seq.sequence_day];

      if (nextDay === null || nextDay === undefined) {
        // No more days — this shouldn't normally happen here
        continue;
      }

      // Advance to next day
      await supabase
        .from('recall_sequences')
        .update({
          sequence_day: nextDay,
          last_sent_at: null, // Reset so outreach engine picks it up
          next_send_at: null, // Will be set after send
        })
        .eq('id', seq.id);

      // Send the SMS for the new day
      const sendResult = await sendSequenceSMS(seq.id, practiceId);

      if (sendResult.success) {
        result.advanced++;
      } else {
        result.errors.push(`Failed to send Day ${nextDay} for ${seq.id}: ${sendResult.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error advancing ${seq.id}: ${msg}`);
    }
  }
}

async function autoExitTimedOut(
  practiceId: string,
  now: Date,
  result: OrchestrateResult,
  location?: string
): Promise<void> {
  // Find Day 3 sequences that were sent > 48h ago with no reply
  const cutoff = new Date(now.getTime() - HOURS_BETWEEN_SENDS[3] * 60 * 60 * 1000);

  let query = supabase
    .from('recall_sequences')
    .select('*, patients!inner(location)')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active')
    .eq('sequence_day', 3)
    .not('last_sent_at', 'is', null)
    .lte('last_sent_at', cutoff.toISOString())
    .eq('reply_count', 0); // No replies received

  if (location) {
    query = query.ilike('patients.location', `%${location}%`);
  }

  const { data: sequences, error } = await query;

  if (error || !sequences?.length) return;

  for (const seq of sequences as RecallSequence[]) {
    await supabase
      .from('recall_sequences')
      .update({
        sequence_status: 'exited',
        exit_reason: 'no_response_auto_exit',
        next_send_at: null,
      })
      .eq('id', seq.id);

    await logAutomation({
      practiceId,
      patientId: seq.patient_id,
      automationType: 'recall',
      action: 'auto_exit',
      result: 'sent',
      metadata: { reason: 'no_response_after_day3' },
    });

    result.autoExited++;
  }
}

async function reEnterDeferred(
  practiceId: string,
  now: Date,
  result: OrchestrateResult,
  location?: string
): Promise<void> {
  // Find exited sequences with defer_until that has passed
  let query = supabase
    .from('recall_sequences')
    .select('*, patients!inner(location)')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'exited')
    .eq('exit_reason', 'deferred')
    .not('defer_until', 'is', null)
    .lte('defer_until', now.toISOString());

  if (location) {
    query = query.ilike('patients.location', `%${location}%`);
  }

  const { data: sequences, error } = await query;

  if (error || !sequences?.length) return;

  for (const seq of sequences as RecallSequence[]) {
    // Reset sequence to Day 0
    await supabase
      .from('recall_sequences')
      .update({
        sequence_status: 'active',
        sequence_day: 0,
        booking_stage: 'S0_OPENING',
        last_sent_at: null,
        next_send_at: now.toISOString(),
        exit_reason: null,
        defer_until: null,
        reply_count: 0,
        offered_slots: null,
        selected_slot: null,
        patient_preferences: null,
      })
      .eq('id', seq.id);

    await logAutomation({
      practiceId,
      patientId: seq.patient_id,
      automationType: 'recall',
      action: 're_enter_deferred',
      result: 'sent',
    });

    result.reEntered++;
  }
}

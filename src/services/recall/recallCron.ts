// Recall Cron — Hourly sequence orchestrator
// Queries all practices with active recall sequences, runs orchestrator for each

import cron, { type ScheduledTask } from 'node-cron';
import { supabase } from '../../lib/supabase';
import { runSequenceOrchestrator } from './sequenceOrchestrator';
import { logAutomation } from '../execution/metricsTracker';

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

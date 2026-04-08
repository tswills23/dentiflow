// PMS Sync Cron — Polling fallback for PMS systems that don't support webhooks
//
// Runs at minute :10 of every hour (offset from recall :00, noshow :05)
// For each practice with polling_enabled=true, calls the PMS adapter's
// fetchRecentChanges() and processes each event.

import cron, { type ScheduledTask } from 'node-cron';
import { supabase } from '../../lib/supabase';
import { getPmsAdapter } from './adapterRegistry';
import { processPmsEvent } from './pmsEventProcessor';
import type { PmsIntegration, PmsType, PmsSyncResult } from '../../types/pms';

let cronTask: ScheduledTask | null = null;

export async function runPmsSyncForAllPractices(): Promise<PmsSyncResult> {
  const result: PmsSyncResult = {
    practicesProcessed: 0,
    eventsProcessed: 0,
    noshowSequencesCreated: 0,
    reviewSequencesCreated: 0,
    appointmentsSynced: 0,
    patientsCreated: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  // Find all active integrations with polling enabled
  const { data: integrations, error } = await supabase
    .from('pms_integrations')
    .select('*')
    .eq('active', true)
    .eq('polling_enabled', true);

  if (error || !integrations?.length) return result;

  for (const row of integrations) {
    const integration = row as unknown as PmsIntegration;
    const now = new Date();

    // Check if enough time has passed since last sync
    if (integration.last_synced_at) {
      const lastSync = new Date(integration.last_synced_at);
      const intervalMs = (integration.polling_interval_minutes || 10) * 60 * 1000;
      if (now.getTime() - lastSync.getTime() < intervalMs) {
        continue;
      }
    }

    try {
      const adapter = getPmsAdapter(integration.pms_type as PmsType);
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at)
        : new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: last 24h

      const events = await adapter.fetchRecentChanges(integration, since);

      for (const event of events) {
        try {
          const eventResult = await processPmsEvent(
            integration.practice_id,
            event,
            'polling',
            integration
          );

          result.eventsProcessed++;

          if (eventResult.action === 'noshow_sequence_created') result.noshowSequencesCreated++;
          else if (eventResult.action === 'review_sequence_created') result.reviewSequencesCreated++;
          else if (eventResult.action === 'skipped_duplicate') result.skippedDuplicate++;
          else if (eventResult.action === 'appointment_synced') result.appointmentsSynced++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Event ${event.pmsEventId}: ${msg}`);
        }
      }

      // Update last_synced_at
      await supabase
        .from('pms_integrations')
        .update({ last_synced_at: now.toISOString(), error_count: 0, last_error: null })
        .eq('id', integration.id);

      result.practicesProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Practice ${integration.practice_id}: ${msg}`);

      // Increment error count
      const newCount = (integration.error_count || 0) + 1;
      await supabase
        .from('pms_integrations')
        .update({
          error_count: newCount,
          last_error: msg,
          ...(newCount >= 10 ? { active: false } : {}),
        })
        .eq('id', integration.id);
    }
  }

  if (result.eventsProcessed > 0 || result.errors.length > 0) {
    console.log(
      `[pmsSyncCron] Done: ${result.eventsProcessed} events, ${result.noshowSequencesCreated} noshow, ${result.reviewSequencesCreated} review, ${result.errors.length} errors`
    );
  }

  return result;
}

// =============================================================================
// Cron Lifecycle
// =============================================================================

export function startPmsSyncCron(): void {
  if (cronTask) {
    console.warn('[pmsSyncCron] Cron already running, skipping duplicate start');
    return;
  }

  // Run at minute 10 of every hour (offset from recall :00, noshow :05)
  cronTask = cron.schedule('10 * * * *', async () => {
    console.log(`[pmsSyncCron] Hourly tick at ${new Date().toISOString()}`);
    try {
      const result = await runPmsSyncForAllPractices();
      if (result.errors.length > 0) {
        console.error(`[pmsSyncCron] ${result.errors.length} errors:`, result.errors.slice(0, 3));
      }
    } catch (err) {
      console.error('[pmsSyncCron] Unhandled error:', err);
    }
  });

  console.log('[pmsSyncCron] PMS sync cron started (10 * * * *)');
}

export function stopPmsSyncCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[pmsSyncCron] Cron stopped');
  }
}

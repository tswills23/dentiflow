// Review Cron Scheduler — wraps reviewCron in node-cron
// Runs hourly alongside the recall cron

import cron, { type ScheduledTask } from 'node-cron';
import { runReviewCronForAllPractices } from './reviewCron';

let cronTask: ScheduledTask | null = null;

export function startReviewCron(): void {
  if (cronTask) {
    console.warn('[reviewCron] Cron already running, skipping duplicate start');
    return;
  }

  // Run at minute 5 of every hour (offset from recall cron at minute 0)
  cronTask = cron.schedule('5 * * * *', async () => {
    console.log(`[reviewCron] Hourly tick at ${new Date().toISOString()}`);
    try {
      const result = await runReviewCronForAllPractices();
      console.log(
        `[reviewCron] Complete: ${result.practicesProcessed} practices, ` +
        `reminders=${result.remindersSent}, closed=${result.noResponseClosed}, ` +
        `referrals=${result.referralsSent}, errors=${result.errors.length}`
      );
    } catch (err) {
      console.error('[reviewCron] Unhandled error:', err);
    }
  });

  console.log('[reviewCron] Hourly review orchestrator cron started (5 * * * *)');
}

export function stopReviewCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[reviewCron] Cron stopped');
  }
}

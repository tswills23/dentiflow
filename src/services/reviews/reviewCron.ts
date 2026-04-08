// Review Cron — Hourly review sequence orchestrator
// Handles: survey reminders, no-response auto-close, referral triggers

import { supabase } from '../../lib/supabase';
import {
  sendSurvey,
  sendSurveyReminder,
  sendReferralMessage,
  getReviewConfig,
} from './reviewSequenceService';
import { createReferral } from './referralService';
import { logAutomation } from '../execution/metricsTracker';
import type { Practice, Patient } from '../../types/database';
import type { ReviewSequence } from '../../types/review';

interface ReviewCronResult {
  practicesProcessed: number;
  surveysSent: number;
  remindersSent: number;
  noResponseClosed: number;
  referralsSent: number;
  errors: string[];
}

export async function runReviewCronForAllPractices(): Promise<ReviewCronResult> {
  const result: ReviewCronResult = {
    practicesProcessed: 0,
    surveysSent: 0,
    remindersSent: 0,
    noResponseClosed: 0,
    referralsSent: 0,
    errors: [],
  };

  // Get all practices with active review sequences
  const { data: rows, error } = await supabase
    .from('review_sequences')
    .select('practice_id')
    .in('status', ['survey_sent', 'survey_reminded', 'review_requested']);

  if (error) {
    result.errors.push(`Failed to query active review sequences: ${error.message}`);
    return result;
  }

  const practiceIds = [...new Set((rows || []).map((r: { practice_id: string }) => r.practice_id))];

  if (practiceIds.length === 0) {
    console.log('[reviewCron] No practices with active review sequences');
    return result;
  }

  console.log(`[reviewCron] Processing ${practiceIds.length} practice(s)`);

  for (const practiceId of practiceIds) {
    try {
      const practiceResult = await runReviewCronForPractice(practiceId);
      result.practicesProcessed++;
      result.surveysSent += practiceResult.surveysSent;
      result.remindersSent += practiceResult.remindersSent;
      result.noResponseClosed += practiceResult.noResponseClosed;
      result.referralsSent += practiceResult.referralsSent;
      result.errors.push(...practiceResult.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Practice ${practiceId}: ${msg}`);
      console.error(`[reviewCron] Error for practice ${practiceId}:`, msg);
    }
  }

  await logAutomation({
    practiceId: 'system',
    automationType: 'review',
    action: 'cron_review',
    result: 'sent',
    metadata: {
      practicesProcessed: result.practicesProcessed,
      surveysSent: result.surveysSent,
      remindersSent: result.remindersSent,
      noResponseClosed: result.noResponseClosed,
      referralsSent: result.referralsSent,
    },
  });

  return result;
}

async function runReviewCronForPractice(practiceId: string): Promise<{
  surveysSent: number;
  remindersSent: number;
  noResponseClosed: number;
  referralsSent: number;
  errors: string[];
}> {
  const result = { surveysSent: 0, remindersSent: 0, noResponseClosed: 0, referralsSent: 0, errors: [] as string[] };
  const now = new Date();

  // Fetch practice
  const { data: practice } = await supabase.from('practices').select('*').eq('id', practiceId).single();
  if (!practice) {
    result.errors.push('Practice not found');
    return result;
  }

  const reviewConfig = getReviewConfig(practice as unknown as Practice);

  // ── 1. Send surveys that are due (survey_send_at has passed) ──
  const { data: pendingSurveys } = await supabase
    .from('review_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('status', 'survey_sent')
    .not('survey_send_at', 'is', null)
    .lte('survey_send_at', now.toISOString())
    // Only pick up surveys where reminder hasn't been sent yet
    // (survey_send_at is set at creation, we use it as the "when to actually send" time)
    .is('reminder_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  // Note: The initial survey is actually sent immediately in the webhook handler.
  // This cron handles sequences that might have been created but not yet sent
  // (e.g., if the server restarted during the delay window).

  // ── 2. Send reminders: survey_sent for >24h with no score ──
  const reminderCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: needsReminder } = await supabase
    .from('review_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('status', 'survey_sent')
    .is('satisfaction_score', null)
    .is('reminder_sent_at', null)
    .lte('created_at', reminderCutoff.toISOString())
    .limit(50);

  for (const seq of (needsReminder || []) as ReviewSequence[]) {
    try {
      const { data: patient } = await supabase.from('patients').select('*').eq('id', seq.patient_id).single();
      if (!patient?.phone) continue;

      const sent = await sendSurveyReminder(seq, patient as unknown as Patient, practice as unknown as Practice);
      if (sent) result.remindersSent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Reminder for seq ${seq.id}: ${msg}`);
    }
  }

  // ── 3. Auto-close: survey_reminded for >24h (48h total) with no score ──
  const closeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: needsClose } = await supabase
    .from('review_sequences')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('status', 'survey_reminded')
    .is('satisfaction_score', null)
    .lte('reminder_sent_at', closeCutoff.toISOString())
    .limit(100);

  if (needsClose && needsClose.length > 0) {
    const ids = needsClose.map((s: { id: string }) => s.id);
    await supabase
      .from('review_sequences')
      .update({ status: 'no_response' })
      .in('id', ids);
    result.noResponseClosed = ids.length;
    console.log(`[reviewCron] Closed ${ids.length} no-response sequences for practice ${practiceId}`);
  }

  // ── 4. Send referral links: review_requested for >48h ──
  const referralCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const { data: needsReferral } = await supabase
    .from('review_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('status', 'review_requested')
    .eq('referral_sent', false)
    .lte('review_requested_at', referralCutoff.toISOString())
    .limit(50);

  for (const seq of (needsReferral || []) as ReviewSequence[]) {
    try {
      const { data: patient } = await supabase.from('patients').select('*').eq('id', seq.patient_id).single();
      if (!patient?.phone) continue;

      // Create referral record with unique hash
      const referral = await createReferral(practiceId, seq.patient_id);

      const sent = await sendReferralMessage(
        seq,
        patient as unknown as Patient,
        practice as unknown as Practice,
        reviewConfig,
        referral.referral_link_hash
      );
      if (sent) result.referralsSent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Referral for seq ${seq.id}: ${msg}`);
    }
  }

  if (result.remindersSent > 0 || result.noResponseClosed > 0 || result.referralsSent > 0) {
    console.log(
      `[reviewCron] Practice ${practiceId}: reminders=${result.remindersSent}, closed=${result.noResponseClosed}, referrals=${result.referralsSent}`
    );
  }

  return result;
}

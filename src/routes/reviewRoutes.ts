// Review & Referral API Routes
// POST /api/reviews/appointment-complete — Trigger review sequence
// POST /api/reviews/referral-submit — Handle referral form submission
// GET  /api/reviews/referral/:hash — Get referral landing page data
// GET  /api/reviews/feedback — List unacknowledged feedback
// PATCH /api/reviews/feedback/:id/acknowledge — Mark feedback as acknowledged

import { Router } from 'express';
import { supabase } from '../lib/supabase';
import {
  createReviewSequence,
  sendSurvey,
  getReviewConfig,
} from '../services/reviews/reviewSequenceService';
import { findReferralByHash, handleReferralSubmission } from '../services/reviews/referralService';
import { handleInboundMessage } from '../services/orchestration/stlOrchestrator';
import type { Practice, Patient } from '../types/database';

const router = Router();

// POST /api/reviews/appointment-complete
// Body: { practiceId, patientId, appointmentId?, providerName? }
router.post('/appointment-complete', async (req, res) => {
  try {
    const { practiceId, patientId, appointmentId, providerName } = req.body;

    if (!practiceId || !patientId) {
      res.status(400).json({ error: 'Missing practiceId or patientId' });
      return;
    }

    // Validate practice exists
    const { data: practice } = await supabase
      .from('practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (!practice) {
      res.status(404).json({ error: 'Practice not found' });
      return;
    }

    // Validate patient exists
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('practice_id', practiceId)
      .single();

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    if (!patient.phone) {
      res.status(400).json({ error: 'Patient has no phone number' });
      return;
    }

    // Check for existing active review sequence (prevent duplicates)
    const { data: existing } = await supabase
      .from('review_sequences')
      .select('id, status')
      .eq('practice_id', practiceId)
      .eq('patient_id', patientId)
      .in('status', ['survey_sent', 'survey_reminded', 'score_received', 'review_requested'])
      .limit(1)
      .single();

    if (existing) {
      res.status(409).json({ error: 'Active review sequence already exists', sequenceId: existing.id });
      return;
    }

    const reviewConfig = getReviewConfig(practice as unknown as Practice);
    const delayHours = reviewConfig.review_survey_delay_hours || 2;

    // Create the sequence
    const sequence = await createReviewSequence({
      practiceId,
      patientId,
      appointmentId,
      delayHours,
    });

    // If delay is 0, send immediately. Otherwise cron will pick it up.
    // For now, we send immediately and use the delay as a "minimum wait" for the cron.
    // In practice, most offices want the survey shortly after visit.
    if (delayHours === 0) {
      await sendSurvey(sequence, patient as unknown as Patient, practice as unknown as Practice);
    }

    res.json({
      success: true,
      sequenceId: sequence.id,
      status: sequence.status,
      scheduledAt: sequence.survey_send_at,
      delayHours,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reviewRoutes] Appointment complete error:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/reviews/send-pending
// Body: { practiceId } — Send all pending surveys that are past their delay
router.post('/send-pending', async (req, res) => {
  try {
    const { practiceId } = req.body;
    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    const now = new Date().toISOString();

    // Find sequences ready to send
    const { data: pending } = await supabase
      .from('review_sequences')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('status', 'survey_sent')
      .lte('survey_send_at', now)
      .is('reminder_sent_at', null)
      .limit(50);

    const { data: practice } = await supabase
      .from('practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (!practice) {
      res.status(404).json({ error: 'Practice not found' });
      return;
    }

    let sent = 0;
    for (const seq of pending || []) {
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', seq.patient_id)
        .single();

      if (patient?.phone) {
        const success = await sendSurvey(seq as any, patient as unknown as Patient, practice as unknown as Practice);
        if (success) sent++;
      }
    }

    res.json({ success: true, sent, total: (pending || []).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reviewRoutes] Send pending error:', msg);
    res.status(500).json({ error: msg });
  }
});

// GET /api/reviews/referral/:hash — Get referral landing page data (public)
router.get('/referral/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const lookup = await findReferralByHash(hash);

    if (!lookup) {
      res.status(404).json({ error: 'Referral link not found' });
      return;
    }

    const { practice, referringPatient } = lookup;
    const referrerName = [referringPatient.first_name, referringPatient.last_name].filter(Boolean).join(' ');
    const reviewConfig = getReviewConfig(practice as unknown as Practice);

    res.json({
      practiceName: practice.name,
      referralOffer: reviewConfig.referral_offer || 'a complimentary exam',
      referrerFirstName: referringPatient.first_name || 'A friend',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reviewRoutes] Referral lookup error:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/reviews/referral-submit — Handle referral form submission (public)
router.post('/referral-submit', async (req, res) => {
  try {
    const { hash, name, phone } = req.body;

    if (!hash || !name || !phone) {
      res.status(400).json({ error: 'Missing hash, name, or phone' });
      return;
    }

    const result = await handleReferralSubmission({
      referralHash: hash,
      referredName: name,
      referredPhone: phone,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Fire STL pipeline for the new referred patient
    if (result.newPatientId && result.practiceId) {
      handleInboundMessage({
        practiceId: result.practiceId,
        phone,
        message: `Hi, I was referred by a friend. I'd like to schedule an appointment.`,
        firstName: name.split(/\s+/)[0],
        source: 'referral',
        channel: 'web_form',
      }).catch((err) => {
        console.error('[reviewRoutes] STL pipeline for referral failed:', err);
      });
    }

    res.json({
      success: true,
      practiceName: result.practiceName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reviewRoutes] Referral submit error:', msg);
    res.status(500).json({ error: msg });
  }
});

// GET /api/reviews/feedback?practiceId=xxx&unacknowledgedOnly=true
router.get('/feedback', async (req, res) => {
  try {
    const { practiceId, unacknowledgedOnly } = req.query;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    let query = supabase
      .from('review_feedback')
      .select('*, patients!inner(first_name, last_name, phone)')
      .eq('practice_id', practiceId as string)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unacknowledgedOnly === 'true') {
      query = query.eq('acknowledged', false);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ feedback: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// PATCH /api/reviews/feedback/:id/acknowledge
router.patch('/feedback/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('review_feedback')
      .update({ acknowledged: true })
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/reviews/metrics?practiceId=xxx
router.get('/metrics', async (req, res) => {
  try {
    const { practiceId } = req.query;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    // Get this month's date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Aggregate metrics for the month
    const { data: metrics } = await supabase
      .from('metrics_daily')
      .select('review_surveys_sent, review_scores_received, review_links_sent, referrals_generated, referrals_converted')
      .eq('practice_id', practiceId as string)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    const totals = (metrics || []).reduce(
      (acc, row) => ({
        surveysSent: acc.surveysSent + (row.review_surveys_sent || 0),
        scoresReceived: acc.scoresReceived + (row.review_scores_received || 0),
        reviewLinksSent: acc.reviewLinksSent + (row.review_links_sent || 0),
        referralsGenerated: acc.referralsGenerated + (row.referrals_generated || 0),
        referralsConverted: acc.referralsConverted + (row.referrals_converted || 0),
      }),
      { surveysSent: 0, scoresReceived: 0, reviewLinksSent: 0, referralsGenerated: 0, referralsConverted: 0 }
    );

    // Average satisfaction score this month
    const { data: scores } = await supabase
      .from('review_sequences')
      .select('satisfaction_score')
      .eq('practice_id', practiceId as string)
      .not('satisfaction_score', 'is', null)
      .gte('created_at', `${startOfMonth}T00:00:00Z`);

    const avgScore = scores && scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.satisfaction_score || 0), 0) / scores.length
      : 0;

    const responseRate = totals.surveysSent > 0
      ? Math.round((totals.scoresReceived / totals.surveysSent) * 100)
      : 0;

    const referralConversionRate = totals.referralsGenerated > 0
      ? Math.round((totals.referralsConverted / totals.referralsGenerated) * 100)
      : 0;

    res.json({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      surveysSent: totals.surveysSent,
      responseRate,
      avgSatisfactionScore: Math.round(avgScore * 10) / 10,
      reviewLinksSent: totals.reviewLinksSent,
      referralsGenerated: totals.referralsGenerated,
      referralConversionRate,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;

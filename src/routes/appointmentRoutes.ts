// Appointment API Routes
//
// POST /api/appointments/complete — Mark appointment complete + auto-trigger review sequence
// This endpoint doubles as a PMS webhook (Dentrix Ascend, etc.)

import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import {
  createReviewSequence,
  sendSurvey,
  getReviewConfig,
} from '../services/reviews/reviewSequenceService';
import type { Practice, Patient } from '../types/database';

const router = Router();

// POST /api/appointments/complete
// Body: { practiceId, appointmentId }
// Also accepts PMS-style: { practiceId, patientId } (without appointmentId)
router.post('/complete', async (req: Request, res: Response) => {
  const { practiceId, appointmentId, patientId: directPatientId } = req.body;

  if (!practiceId || (!appointmentId && !directPatientId)) {
    res.status(400).json({ error: 'Missing practiceId and either appointmentId or patientId' });
    return;
  }

  try {
    let resolvedPatientId = directPatientId;

    // If appointmentId provided, look up appointment and update it
    if (appointmentId) {
      const { data: appointment, error: aptErr } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('practice_id', practiceId)
        .single();

      if (aptErr || !appointment) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }

      if (appointment.status === 'completed') {
        res.status(409).json({ error: 'Appointment already marked as completed' });
        return;
      }

      // Update appointment status
      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId);

      resolvedPatientId = appointment.patient_id;
    }

    // Update patient status
    await supabase
      .from('patients')
      .update({ status: 'completed' })
      .eq('id', resolvedPatientId);

    // Fetch practice for review config
    const { data: practice } = await supabase
      .from('practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (!practice) {
      res.status(404).json({ error: 'Practice not found' });
      return;
    }

    // Fetch patient for phone number
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', resolvedPatientId)
      .eq('practice_id', practiceId)
      .single();

    if (!patient || !patient.phone) {
      // Appointment marked complete, but can't send review (no phone)
      res.json({
        success: true,
        appointmentCompleted: true,
        reviewTriggered: false,
        reason: 'Patient has no phone number',
      });
      return;
    }

    // Check for existing active review sequence (prevent duplicates)
    const { data: existing } = await supabase
      .from('review_sequences')
      .select('id, status')
      .eq('practice_id', practiceId)
      .eq('patient_id', resolvedPatientId)
      .in('status', ['survey_sent', 'survey_reminded', 'score_received', 'review_requested'])
      .limit(1)
      .single();

    if (existing) {
      res.json({
        success: true,
        appointmentCompleted: true,
        reviewTriggered: false,
        reason: 'Active review sequence already exists',
        existingSequenceId: existing.id,
      });
      return;
    }

    // Create review sequence
    const reviewConfig = getReviewConfig(practice as unknown as Practice);
    const delayHours = reviewConfig.review_survey_delay_hours ?? 2;

    const sequence = await createReviewSequence({
      practiceId,
      patientId: resolvedPatientId,
      appointmentId: appointmentId || undefined,
      delayHours,
    });

    // Send immediately if delay is 0
    if (delayHours === 0) {
      await sendSurvey(sequence, patient as unknown as Patient, practice as unknown as Practice);
    }

    console.log(`[appointmentRoutes] Appointment completed → review sequence created. Patient: ${patient.first_name} ${patient.last_name}, delay: ${delayHours}h`);

    res.json({
      success: true,
      appointmentCompleted: true,
      reviewTriggered: true,
      sequenceId: sequence.id,
      scheduledAt: sequence.survey_send_at,
      delayHours,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[appointmentRoutes] Complete error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;

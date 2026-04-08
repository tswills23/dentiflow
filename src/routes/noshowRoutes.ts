// No-Show Recovery API Routes
//
// POST /api/noshow/mark          — Mark appointment as no-show + create sequence
// GET  /api/noshow/sequences     — List noshow sequences for practice
// POST /api/noshow/run-cron      — Manual cron trigger (dev/testing)

import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { createNoshowSequence } from '../services/noshow/noshowService';
import { runNoshowOrchestrator } from '../services/noshow/noshowCron';

const router = Router();

// POST /api/noshow/mark — Mark an appointment as no-show and create recovery sequence
router.post('/mark', async (req: Request, res: Response) => {
  const { practiceId, appointmentId } = req.body;

  if (!practiceId || !appointmentId) {
    res.status(400).json({ error: 'Missing practiceId or appointmentId' });
    return;
  }

  try {
    // 1. Verify appointment exists and belongs to practice
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

    if (appointment.status === 'no_show') {
      res.status(409).json({ error: 'Appointment already marked as no-show' });
      return;
    }

    // 2. Update appointment status to no_show
    await supabase
      .from('appointments')
      .update({ status: 'no_show' })
      .eq('id', appointmentId);

    // 3. Update patient status
    await supabase
      .from('patients')
      .update({ status: 'no_show' })
      .eq('id', appointment.patient_id);

    // 4. Create noshow recovery sequence
    const sequence = await createNoshowSequence({
      practiceId,
      patientId: appointment.patient_id,
      appointmentId,
    });

    res.json({
      success: true,
      sequenceId: sequence.id,
      scheduledAt: sequence.next_send_at,
      message: 'No-show recorded. Message 1 scheduled for 1 hour from now.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[noshowRoutes] Mark no-show error:', msg);
    res.status(500).json({ error: msg });
  }
});

// GET /api/noshow/sequences — List noshow sequences for a practice
router.get('/sequences', async (req: Request, res: Response) => {
  const practiceId = req.query.practiceId as string;

  if (!practiceId) {
    res.status(400).json({ error: 'Missing practiceId' });
    return;
  }

  const { data, error } = await supabase
    .from('noshow_sequences')
    .select('*, patients(first_name, last_name, phone)')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ sequences: data });
});

// POST /api/noshow/run-cron — Manual cron trigger (dev/testing)
router.post('/run-cron', async (_req: Request, res: Response) => {
  try {
    const result = await runNoshowOrchestrator();
    res.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;

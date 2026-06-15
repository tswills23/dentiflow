// Conversation API Routes
//
// POST /api/conversations/send — staff-composed manual SMS to a patient.
// Runs the same validate → send → log pipeline as the AI paths so manual
// messages can never bypass the response validator (HIPAA gate) or Twilio.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { sendSMS } from '../services/execution/smsService';
import { validateResponse } from '../services/execution/responseValidator';
import { saveMessage } from '../services/execution/conversationStore';
import type { Practice } from '../types/database';

const router = Router();

// POST /api/conversations/send
// Body: { practiceId, patientId, messageBody }
router.post('/send', async (req: Request, res: Response) => {
  const { practiceId, patientId, messageBody } = req.body;

  if (!practiceId || !patientId || !messageBody?.trim()) {
    res.status(400).json({ error: 'Missing practiceId, patientId, or messageBody' });
    return;
  }

  try {
    const { data: practice } = await supabase
      .from('practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (!practice) {
      res.status(404).json({ error: 'Practice not found' });
      return;
    }
    if (!practice.twilio_phone) {
      res.status(409).json({ error: 'Practice has no Twilio number configured' });
      return;
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('practice_id', practiceId)
      .single();

    if (!patient || !patient.phone) {
      res.status(409).json({ error: 'Patient not found or has no phone number' });
      return;
    }

    // Validate before send — manual staff text must clear the same gate as AI.
    const validation = validateResponse(messageBody.trim(), 'staff_message', practice as unknown as Practice);
    if (validation.blocked) {
      res.status(422).json({ error: `Message blocked by validator: ${validation.blockReason}`, blockReason: validation.blockReason });
      return;
    }

    const sendResult = await sendSMS(patient.phone, validation.response, practice.twilio_phone);
    if (!sendResult.success) {
      res.status(502).json({ error: `Send failed: ${sendResult.error}` });
      return;
    }

    const saved = await saveMessage({
      practiceId,
      patientId,
      channel: 'sms',
      direction: 'outbound',
      messageBody: validation.response,
      aiGenerated: false,
      twilioSid: sendResult.sid,
      metadata: { source: 'staff_manual' },
    });

    res.json({ success: true, simulated: sendResult.simulated, conversationId: saved.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[conversationRoutes] Send error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;

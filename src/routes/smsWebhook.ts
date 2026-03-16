import type { Request, Response } from 'express';
import { handleInboundMessage } from '../services/orchestration/stlOrchestrator';
import { findActiveSequenceByPhone, handleRecallReply } from '../services/recall/replyHandler';
import { supabase } from '../lib/supabase';

// Twilio sends form-encoded POST with From, To, Body
export async function smsWebhook(req: Request, res: Response): Promise<void> {
  const { From: from, To: to, Body: body } = req.body;

  if (!from || !body) {
    res.status(400).json({ error: 'Missing From or Body' });
    return;
  }

  // Look up practice by Twilio phone number
  const { data: practice } = await supabase
    .from('practices')
    .select('id')
    .eq('twilio_phone', to)
    .single();

  if (!practice) {
    console.error(`[smsWebhook] No practice found for Twilio number: ${to}`);
    // Still respond to Twilio to prevent retries
    res.type('text/xml').send('<Response></Response>');
    return;
  }

  // Respond to Twilio immediately (must be < 15 seconds)
  res.type('text/xml').send('<Response></Response>');

  // Phase 8: Check for active recall sequence FIRST
  // If this phone has an active recall sequence, route to recall handler
  const activeRecallSeq = await findActiveSequenceByPhone(practice.id, from);

  if (activeRecallSeq) {
    console.log(`[smsWebhook] Routing to recall handler: sequence ${activeRecallSeq.id}`);
    handleRecallReply(activeRecallSeq.id, from, body, practice.id).catch((err) => {
      console.error('[smsWebhook] Recall reply processing failed:', err);
    });
    return;
  }

  // No active recall sequence — route to STL pipeline
  handleInboundMessage({
    practiceId: practice.id,
    phone: from,
    message: body,
    source: 'sms',
    channel: 'sms',
  }).catch((err) => {
    console.error('[smsWebhook] Async processing failed:', err);
  });
}

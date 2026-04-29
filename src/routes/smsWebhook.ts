import type { Request, Response } from 'express';
import { handleInboundMessage } from '../services/orchestration/stlOrchestrator';
import { findActiveSequenceByPhone, handleRecallReply } from '../services/recall/replyHandler';
import { findActiveReviewSequenceByPhone } from '../services/reviews/reviewSequenceService';
import { handleReviewReply } from '../services/reviews/reviewReplyHandler';
import { findActiveNoshowSequenceByPhone } from '../services/noshow/noshowService';
import { handleNoshowReply } from '../services/noshow/noshowReplyHandler';
import { supabase } from '../lib/supabase';
import type { Practice } from '../types/database';

// Twilio sends form-encoded POST with From, To, Body, MessageSid
export async function smsWebhook(req: Request, res: Response): Promise<void> {
  const { From: from, To: to, Body: body, MessageSid: messageSid } = req.body;

  if (!from || !body) {
    res.status(400).json({ error: 'Missing From or Body' });
    return;
  }

  // Look up practice by Twilio phone number
  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('twilio_phone', to as string)
    .single() as { data: Practice | null };

  if (!practice) {
    console.error(`[smsWebhook] No practice found for Twilio number: ${to}`);
    // Still respond to Twilio to prevent retries
    res.type('text/xml').send('<Response></Response>');
    return;
  }

  // Twilio MessageSid dedupe — prevents double-processing on webhook retry.
  // Insert with PRIMARY KEY constraint; 23505 (unique violation) means retry.
  if (messageSid) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { error: dedupeError } = await db
      .from('processed_inbound_sms')
      .insert({
        twilio_message_sid: messageSid,
        practice_id: practice.id,
        from_phone: from as string,
      });

    if (dedupeError && (dedupeError.code === '23505' || dedupeError.message.includes('duplicate'))) {
      console.log(`[smsWebhook] DEDUPE: skipping retry of MessageSid ${messageSid}`);
      res.type('text/xml').send('<Response></Response>');
      return;
    }
    // Non-dedupe errors (DB hiccup) — log and continue. Better to risk a duplicate
    // than to silently drop legitimate inbounds.
    if (dedupeError) {
      console.error('[smsWebhook] dedupe insert non-23505 error (continuing):', dedupeError.message);
    }
  }

  // Respond to Twilio immediately (must be < 15 seconds)
  res.type('text/xml').send('<Response></Response>');

  // Priority 1: Check for active review survey sequence
  // Review survey replies are short (1-5 or keywords) and time-sensitive
  const activeReviewSeq = await findActiveReviewSequenceByPhone(practice.id, from);

  if (activeReviewSeq) {
    console.log(`[smsWebhook] Routing to review handler: sequence ${activeReviewSeq.id} (status: ${activeReviewSeq.status})`);
    handleReviewReply(activeReviewSeq, body, practice.id).catch((err) => {
      console.error('[smsWebhook] Review reply processing failed:', err);
    });
    return;
  }

  // Priority 2: Check for active no-show recovery sequence
  const activeNoshowSeq = await findActiveNoshowSequenceByPhone(practice.id, from);

  if (activeNoshowSeq) {
    console.log(`[smsWebhook] Routing to noshow handler: sequence ${activeNoshowSeq.id} (status: ${activeNoshowSeq.status})`);
    handleNoshowReply(activeNoshowSeq.id, from, body, practice.id).catch((err) => {
      console.error('[smsWebhook] Noshow reply processing failed:', err);
    });
    return;
  }

  // Priority 3: Check for active recall sequence
  const activeRecallSeq = await findActiveSequenceByPhone(practice.id, from);

  if (activeRecallSeq) {
    console.log(`[smsWebhook] Routing to recall handler: sequence ${activeRecallSeq.id}`);
    handleRecallReply(activeRecallSeq.id, from, body, practice.id).catch((err) => {
      console.error('[smsWebhook] Recall reply processing failed:', err);
    });
    return;
  }

  // Priority 4: No active sequence — route to STL pipeline
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

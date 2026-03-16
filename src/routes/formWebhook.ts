import type { Request, Response } from 'express';
import { handleInboundMessage } from '../services/orchestration/stlOrchestrator';

export async function formWebhook(req: Request, res: Response): Promise<void> {
  const {
    practice_id,
    first_name,
    last_name,
    phone,
    email,
    message,
    source,
  } = req.body;

  if (!practice_id || !phone || !message) {
    res.status(400).json({ error: 'Missing practice_id, phone, or message' });
    return;
  }

  // Respond immediately
  res.json({ status: 'received', message: 'Processing your inquiry' });

  // Process asynchronously
  handleInboundMessage({
    practiceId: practice_id,
    phone,
    message,
    firstName: first_name,
    lastName: last_name,
    email,
    source: source || 'web_form',
    channel: 'web_form',
  }).catch((err) => {
    console.error('[formWebhook] Async processing failed:', err);
  });
}

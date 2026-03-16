import type { Request, Response } from 'express';
import { handleInboundMessage } from '../services/orchestration/stlOrchestrator';

export async function missedCallWebhook(req: Request, res: Response): Promise<void> {
  const { practice_id, phone, caller_name } = req.body;

  if (!practice_id || !phone) {
    res.status(400).json({ error: 'Missing practice_id or phone' });
    return;
  }

  // Respond immediately
  res.json({ status: 'received', message: 'Missed call follow-up queued' });

  // Auto-generate a message for missed call follow-up
  const autoMessage = 'I just tried calling your office';

  handleInboundMessage({
    practiceId: practice_id,
    phone,
    message: autoMessage,
    firstName: caller_name,
    source: 'missed_call',
    channel: 'phone',
  }).catch((err) => {
    console.error('[missedCallWebhook] Async processing failed:', err);
  });
}

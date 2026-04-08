// PMS Webhook Routes
//
// POST /webhooks/pms — Receives appointment status changes from external PMS systems
// Practice identified by ?practiceId= query param, X-Practice-ID header, or X-API-Key lookup

import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getPmsAdapter } from '../services/pms/adapterRegistry';
import { processPmsEvent } from '../services/pms/pmsEventProcessor';
import type { PmsIntegration, PmsType } from '../types/pms';

const router = Router();

// POST /webhooks/pms
router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // 1. Identify practice
  let practiceId = (req.query.practiceId || req.headers['x-practice-id']) as string | undefined;
  let integration: PmsIntegration | null = null;

  if (!practiceId) {
    // Try to identify by API key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const { data } = await supabase
        .from('pms_integrations')
        .select('*')
        .eq('webhook_api_key', apiKey)
        .eq('active', true)
        .limit(1)
        .single();

      if (data) {
        integration = data as unknown as PmsIntegration;
        practiceId = integration.practice_id;
      }
    }
  }

  if (!practiceId) {
    res.status(400).json({
      error: 'Cannot identify practice. Provide practiceId query param, X-Practice-ID header, or X-API-Key header.',
    });
    return;
  }

  // 2. Load PMS integration config
  if (!integration) {
    const { data } = await supabase
      .from('pms_integrations')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('active', true)
      .limit(1)
      .single();

    integration = data as unknown as PmsIntegration | null;
  }

  if (!integration) {
    res.status(404).json({ error: 'No active PMS integration for this practice' });
    return;
  }

  // 3. Verify authentication
  const adapter = getPmsAdapter(integration.pms_type as PmsType);
  const rawBody = JSON.stringify(req.body);

  const isAuthenticated = adapter.verifyAuth(
    req.headers as Record<string, string | string[] | undefined>,
    rawBody,
    integration
  );

  if (!isAuthenticated) {
    console.warn(`[pmsWebhook] Auth failed for practice ${practiceId}`);
    res.status(401).json({ error: 'Invalid webhook authentication' });
    return;
  }

  // 4. Respond immediately (PMS webhooks often have short timeouts)
  res.status(200).json({ received: true });

  // 5. Process asynchronously
  try {
    const event = adapter.normalizeWebhookEvent(req.body);

    console.log(`[pmsWebhook] Processing event ${event.pmsEventId}: status=${event.status}, appointment=${event.pmsAppointmentId}`);

    const result = await processPmsEvent(practiceId, event, 'webhook', integration);

    console.log(`[pmsWebhook] Done: ${result.action} (${Date.now() - startTime}ms)`);

    // Reset error count on success
    if (result.success && integration.error_count > 0) {
      await supabase
        .from('pms_integrations')
        .update({ error_count: 0, last_error: null })
        .eq('id', integration.id);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[pmsWebhook] Processing error:', errorMsg);

    // Increment error count
    const newCount = (integration.error_count || 0) + 1;
    const updates: Record<string, unknown> = {
      error_count: newCount,
      last_error: errorMsg,
    };

    // Auto-disable after 10 consecutive errors
    if (newCount >= 10) {
      updates.active = false;
      console.error(`[pmsWebhook] Integration ${integration.id} auto-disabled after ${newCount} consecutive errors`);
    }

    await supabase
      .from('pms_integrations')
      .update(updates)
      .eq('id', integration.id);
  }
});

export default router;

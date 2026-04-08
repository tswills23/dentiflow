// Generic PMS Adapter
// Accepts a standardized JSON payload from any PMS that can send webhooks.
// Auth: HMAC-SHA256 via X-Webhook-Signature header, or static X-API-Key.

import crypto from 'crypto';
import type { PmsAdapter, PmsAppointmentEvent, PmsIntegration, PmsNormalizedStatus } from '../../../types/pms';

const VALID_STATUSES: PmsNormalizedStatus[] = [
  'scheduled', 'confirmed', 'checked_in', 'in_progress',
  'completed', 'no_show', 'cancelled', 'rescheduled', 'late',
];

export class GenericPmsAdapter implements PmsAdapter {
  normalizeWebhookEvent(rawBody: Record<string, unknown>): PmsAppointmentEvent {
    const status = String(rawBody.status || '').toLowerCase().replace(/[\s-]/g, '_');

    if (!VALID_STATUSES.includes(status as PmsNormalizedStatus)) {
      throw new Error(`Unknown appointment status: ${rawBody.status}`);
    }

    const eventId = String(rawBody.event_id || rawBody.eventId || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const appointmentId = String(rawBody.appointment_id || rawBody.appointmentId || '');
    if (!appointmentId) {
      throw new Error('Missing required field: appointment_id');
    }

    const previousStatus = rawBody.previous_status || rawBody.previousStatus;

    return {
      pmsEventId: eventId,
      pmsAppointmentId: appointmentId,
      pmsPatientId: rawBody.patient_id as string || rawBody.patientId as string || null,

      patientFirstName: rawBody.patient_first_name as string || rawBody.patientFirstName as string || null,
      patientLastName: rawBody.patient_last_name as string || rawBody.patientLastName as string || null,
      patientPhone: rawBody.patient_phone as string || rawBody.patientPhone as string || null,
      patientEmail: rawBody.patient_email as string || rawBody.patientEmail as string || null,

      appointmentTime: String(rawBody.appointment_time || rawBody.appointmentTime || new Date().toISOString()),
      durationMinutes: Number(rawBody.duration_minutes || rawBody.durationMinutes || 60),
      providerName: rawBody.provider_name as string || rawBody.providerName as string || null,
      serviceType: rawBody.service_type as string || rawBody.serviceType as string || null,
      location: rawBody.location as string || null,

      status: status as PmsNormalizedStatus,
      previousStatus: previousStatus ? String(previousStatus).toLowerCase().replace(/[\s-]/g, '_') as PmsNormalizedStatus : null,

      rawPayload: rawBody,
    };
  }

  verifyAuth(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    integration: PmsIntegration
  ): boolean {
    // Method 1: HMAC-SHA256 signature
    if (integration.webhook_secret) {
      const signature = headers['x-webhook-signature'] as string;
      if (!signature) return false;

      const expected = crypto
        .createHmac('sha256', integration.webhook_secret)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    }

    // Method 2: Static API key
    if (integration.webhook_api_key) {
      const apiKey = headers['x-api-key'] as string;
      return apiKey === integration.webhook_api_key;
    }

    // No auth configured — reject
    return false;
  }

  async fetchRecentChanges(
    _integration: PmsIntegration,
    _since: Date
  ): Promise<PmsAppointmentEvent[]> {
    // Generic adapter has no polling capability — it's webhook-only
    console.log('[genericAdapter] Polling not supported for generic PMS type');
    return [];
  }
}

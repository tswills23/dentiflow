// Dentrix Ascend PMS Adapter
// Status mapping for Dentrix Ascend appointment statuses.
// Polling is a stub until DADP enrollment and API access are approved.

import crypto from 'crypto';
import type { PmsAdapter, PmsAppointmentEvent, PmsIntegration, PmsNormalizedStatus } from '../../../types/pms';

// Dentrix Ascend uses these appointment statuses
const DENTRIX_STATUS_MAP: Record<string, PmsNormalizedStatus> = {
  'confirmed': 'confirmed',
  'here': 'checked_in',
  'ready': 'in_progress',
  'chair': 'in_progress',
  'checkout': 'completed',
  'complete': 'completed',
  'broken': 'cancelled',
  'no show': 'no_show',
  'no_show': 'no_show',
  'noshow': 'no_show',
  'late': 'late',
  'scheduled': 'scheduled',
  'unconfirmed': 'scheduled',
};

function normalizeDentrixStatus(raw: string): PmsNormalizedStatus {
  const key = raw.toLowerCase().trim();
  const mapped = DENTRIX_STATUS_MAP[key];
  if (!mapped) {
    console.warn(`[dentrixAscend] Unknown Dentrix status: "${raw}", defaulting to scheduled`);
    return 'scheduled';
  }
  return mapped;
}

export class DentrixAscendAdapter implements PmsAdapter {
  normalizeWebhookEvent(rawBody: Record<string, unknown>): PmsAppointmentEvent {
    // Dentrix Ascend webhook payload format (expected structure — adjust once real webhook docs are available)
    const data = (rawBody.data || rawBody) as Record<string, unknown>;

    const eventId = String(
      rawBody.event_id || rawBody.eventId ||
      data.id || `da_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );

    const appointmentId = String(data.appointment_id || data.appointmentId || data.id || '');
    if (!appointmentId) {
      throw new Error('Missing appointment ID in Dentrix Ascend webhook payload');
    }

    const rawStatus = String(data.status || rawBody.status || 'scheduled');
    const rawPrevStatus = data.previous_status || data.previousStatus || rawBody.previous_status;

    // Patient data may be nested under a patient object
    const patient = (data.patient || {}) as Record<string, unknown>;

    return {
      pmsEventId: eventId,
      pmsAppointmentId: appointmentId,
      pmsPatientId: String(patient.id || data.patient_id || data.patientId || ''),

      patientFirstName: patient.first_name as string || patient.firstName as string || null,
      patientLastName: patient.last_name as string || patient.lastName as string || null,
      patientPhone: patient.phone as string || patient.mobile_phone as string || data.patient_phone as string || null,
      patientEmail: patient.email as string || null,

      appointmentTime: String(data.appointment_time || data.start_time || data.date || new Date().toISOString()),
      durationMinutes: Number(data.duration_minutes || data.duration || 60),
      providerName: data.provider_name as string || data.provider as string || null,
      serviceType: (data.service_type as string) || (data.procedure as string) || (data.reason as string) || null,
      location: data.location as string || data.office_name as string || null,

      status: normalizeDentrixStatus(rawStatus),
      previousStatus: rawPrevStatus ? normalizeDentrixStatus(String(rawPrevStatus)) : null,

      rawPayload: rawBody,
    };
  }

  verifyAuth(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    integration: PmsIntegration
  ): boolean {
    // Dentrix Ascend webhook signature verification
    // (exact header name TBD — using common patterns)
    if (integration.webhook_secret) {
      const signature = (
        headers['x-webhook-signature'] ||
        headers['x-dentrix-signature'] ||
        headers['x-signature']
      ) as string;

      if (!signature) return false;

      const expected = crypto
        .createHmac('sha256', integration.webhook_secret)
        .update(rawBody)
        .digest('hex');

      try {
        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected)
        );
      } catch {
        return false;
      }
    }

    // Fallback: API key
    if (integration.webhook_api_key) {
      const apiKey = headers['x-api-key'] as string;
      return apiKey === integration.webhook_api_key;
    }

    return false;
  }

  async fetchRecentChanges(
    integration: PmsIntegration,
    _since: Date
  ): Promise<PmsAppointmentEvent[]> {
    // Stub — requires DADP enrollment and OAuth access token
    if (!integration.access_token || !integration.api_base_url) {
      console.log('[dentrixAscend] Polling not configured — API access requires DADP enrollment');
      return [];
    }

    // TODO: Implement when API access is approved
    // 1. Check token expiry, refresh if needed
    // 2. GET /v2/appointments?modifiedSince={since}&organizationId={org}
    // 3. Map each result through normalizeDentrixStatus
    // 4. Return as PmsAppointmentEvent[]
    console.log('[dentrixAscend] Polling stub — API integration pending');
    return [];
  }
}

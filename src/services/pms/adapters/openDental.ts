// Open Dental PMS Adapter
// -----------------------------------------------------------------------------
// Read path (PmsAdapter): Open Dental has no native outbound webhooks — status
// ingest is poll-based. verifyAuth/normalizeWebhookEvent support a middleware
// that forwards a generic payload; native poll ingest is a documented minimal
// stub for now (booking is the priority).
//
// Write path (PmsBookingAdapter): FULLY implemented against the verified REST API.
//   Availability : GET  /appointments/SlotsWebSched
//   Create       : POST /appointments
//   Auth header  : Authorization: ODFHIR {DeveloperKey}/{CustomerKey}
//   Base URL     : https://api.opendental.com/api/v1  (override via api_base_url)
//
// Access: Developer key from vendor.relations@opendental.com (1–3 business days).
// Public TEST creds (Open Dental's shared test server) for building/smoke-testing:
//   Developer NFF6i0KrXrxDkZHt  /  Customer VzkmZEaUWOjnQX2z
//
// TIMEZONE SAFETY: Open Dental stores appointment times as practice-LOCAL
// wall-clock strings ("yyyy-MM-dd HH:mm:ss", no offset). SlotsWebSched returns
// them in that exact form. We keep them VERBATIM through the book call — never
// round-trip through UTC/ISO — so a 9:00 AM slot books as 9:00 AM regardless of
// server timezone.

import crypto from 'crypto';
import type {
  PmsAdapter,
  PmsBookingAdapter,
  PmsAppointmentEvent,
  PmsIntegration,
  PmsNormalizedStatus,
  PmsSlot,
  PmsSlotQuery,
  PmsBookingRequest,
  PmsBookingResult,
} from '../../../types/pms';

const DEFAULT_BASE_URL = 'https://api.opendental.com/api/v1';

// Open Dental appointment status strings → normalized
const OD_STATUS_MAP: Record<string, PmsNormalizedStatus> = {
  scheduled: 'scheduled',
  complete: 'completed',
  completed: 'completed',
  unschedlist: 'scheduled',
  broken: 'cancelled',
  planned: 'scheduled',
  ptnote: 'scheduled',
  ptnotecompleted: 'completed',
};

function normalizeOdStatus(raw: string): PmsNormalizedStatus {
  const key = raw.toLowerCase().replace(/[\s_]/g, '');
  return OD_STATUS_MAP[key] || 'scheduled';
}

// "yyyy-MM-dd HH:mm:ss" already? pass through. Otherwise format preserving
// wall-clock components (no timezone conversion). See TIMEZONE SAFETY above.
const OD_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
function toOdDateTime(value: string): string {
  if (OD_DATETIME_RE.test(value)) return value;
  // Fallback for ISO input: take the wall-clock parts verbatim, drop any offset.
  const m = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1]} ${m[2]}:${m[3] || '00'}`;
  throw new Error(`Unrecognized datetime for Open Dental: "${value}"`);
}

export class OpenDentalAdapter implements PmsAdapter, PmsBookingAdapter {
  // ---------------------------------------------------------------------------
  // Shared request helper
  // ---------------------------------------------------------------------------

  private baseUrl(integration: PmsIntegration): string {
    return (integration.api_base_url || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private authHeader(integration: PmsIntegration): string {
    // Developer key is shared across all our practices (env), overridable per row.
    const developerKey = integration.client_id || process.env.OPENDENTAL_DEVELOPER_KEY;
    // Customer key is unique per practice.
    const customerKey = integration.client_secret;
    if (!developerKey || !customerKey) {
      throw new Error(
        '[openDental] Missing API keys — need developer key (client_id/OPENDENTAL_DEVELOPER_KEY) and customer key (client_secret)'
      );
    }
    return `ODFHIR ${developerKey}/${customerKey}`;
  }

  private async request<T>(
    integration: PmsIntegration,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    opts: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl(integration)}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: this.authHeader(integration),
        'Content-Type': 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[openDental] ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  // ---------------------------------------------------------------------------
  // Write path (PmsBookingAdapter)
  // ---------------------------------------------------------------------------

  async getAvailableSlots(integration: PmsIntegration, query: PmsSlotQuery): Promise<PmsSlot[]> {
    const raw = await this.request<Array<Record<string, unknown>>>(
      integration,
      'GET',
      '/appointments/SlotsWebSched',
      {
        query: {
          dateStart: query.dateStart,
          dateEnd: query.dateEnd,
          ClinicNum: query.clinicId ?? undefined,
          defNumApptType: query.appointmentTypeId ?? undefined,
          isNewPatient: query.isNewPatient ?? undefined,
        },
      }
    );

    return (raw || []).map((s) => ({
      // Keep Open Dental's local wall-clock strings verbatim (TIMEZONE SAFETY)
      startTime: String(s.DateTimeStart ?? ''),
      endTime: String(s.DateTimeEnd ?? ''),
      providerId: s.ProvNum != null ? String(s.ProvNum) : null,
      operatoryId: s.OpNum != null ? String(s.OpNum) : null,
      clinicId: query.clinicId ?? (s.ClinicNum != null ? String(s.ClinicNum) : null),
    }));
  }

  async createAppointment(
    integration: PmsIntegration,
    req: PmsBookingRequest
  ): Promise<PmsBookingResult> {
    if (!req.slot.operatoryId) {
      return { success: false, pmsAppointmentId: null, startTime: null, error: 'Open Dental requires an operatory (Op) — slot has no operatoryId' };
    }

    const body: Record<string, unknown> = {
      PatNum: Number(req.pmsPatientId),
      Op: Number(req.slot.operatoryId),
      AptDateTime: toOdDateTime(req.slot.startTime),
      AptStatus: 'Scheduled',
    };
    if (req.slot.providerId) body.ProvNum = Number(req.slot.providerId);
    if (req.slot.clinicId) body.ClinicNum = Number(req.slot.clinicId);
    if (req.note) body.Note = req.note;
    if (req.appointmentTypeId) body.AppointmentTypeNum = Number(req.appointmentTypeId);
    if (req.isNewPatient != null) body.IsNewPatient = req.isNewPatient;

    try {
      const created = await this.request<Record<string, unknown>>(
        integration,
        'POST',
        '/appointments',
        { body }
      );
      const aptNum = created?.AptNum;
      return {
        success: true,
        pmsAppointmentId: aptNum != null ? String(aptNum) : null,
        startTime: String(created?.AptDateTime ?? body.AptDateTime),
        rawResponse: created,
      };
    } catch (err) {
      return {
        success: false,
        pmsAppointmentId: null,
        startTime: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Read path (PmsAdapter)
  // ---------------------------------------------------------------------------

  normalizeWebhookEvent(rawBody: Record<string, unknown>): PmsAppointmentEvent {
    // Open Dental has no native webhooks; this handles a middleware/manual push
    // shaped like an Open Dental appointment row.
    const appointmentId = String(rawBody.AptNum ?? rawBody.appointment_id ?? rawBody.id ?? '');
    if (!appointmentId) {
      throw new Error('[openDental] Missing AptNum/appointment_id in payload');
    }
    const rawStatus = String(rawBody.AptStatus ?? rawBody.status ?? 'scheduled');

    return {
      pmsEventId: String(rawBody.event_id ?? `od_${appointmentId}_${rawBody.DateTStamp ?? ''}`),
      pmsAppointmentId: appointmentId,
      pmsPatientId: rawBody.PatNum != null ? String(rawBody.PatNum) : (rawBody.patient_id as string) || null,
      patientFirstName: (rawBody.patient_first_name as string) || null,
      patientLastName: (rawBody.patient_last_name as string) || null,
      patientPhone: (rawBody.patient_phone as string) || null,
      patientEmail: (rawBody.patient_email as string) || null,
      appointmentTime: String(rawBody.AptDateTime ?? rawBody.appointment_time ?? new Date().toISOString()),
      durationMinutes: Number(rawBody.duration_minutes ?? 60),
      providerName: (rawBody.provider_name as string) || null,
      serviceType: (rawBody.ProcDescript as string) || (rawBody.service_type as string) || null,
      location: (rawBody.ClinicNum as string) || (rawBody.location as string) || null,
      status: normalizeOdStatus(rawStatus),
      previousStatus: null,
      rawPayload: rawBody,
    };
  }

  verifyAuth(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    integration: PmsIntegration
  ): boolean {
    // Poll-based ingest; if a middleware forwards events, authenticate the same
    // way the generic adapter does (HMAC signature or static API key).
    if (integration.webhook_secret) {
      const signature = headers['x-webhook-signature'] as string;
      if (!signature) return false;
      const expected = crypto.createHmac('sha256', integration.webhook_secret).update(rawBody).digest('hex');
      try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return false;
      }
    }
    if (integration.webhook_api_key) {
      return (headers['x-api-key'] as string) === integration.webhook_api_key;
    }
    return false;
  }

  async fetchRecentChanges(
    _integration: PmsIntegration,
    _since: Date
  ): Promise<PmsAppointmentEvent[]> {
    // Poll-based status ingest (no-show/completed) is not required for booking and
    // needs the exact change-filter params confirmed against a live customer key.
    // Intentionally a no-op until wired during integration testing.
    console.log('[openDental] fetchRecentChanges: poll ingest not yet wired (booking is the active path)');
    return [];
  }
}

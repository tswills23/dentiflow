// =============================================================================
// PMS Integration Types
// =============================================================================

export type PmsNormalizedStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled'
  | 'late';

export type PmsType = 'dentrix_ascend' | 'open_dental' | 'eaglesoft' | 'generic';

// Normalized event — adapter output, PMS-agnostic
export interface PmsAppointmentEvent {
  pmsEventId: string;
  pmsAppointmentId: string;
  pmsPatientId: string | null;

  // Patient info (for find-or-create)
  patientFirstName: string | null;
  patientLastName: string | null;
  patientPhone: string | null;
  patientEmail: string | null;

  // Appointment details
  appointmentTime: string;        // ISO 8601
  durationMinutes: number;
  providerName: string | null;
  serviceType: string | null;
  location: string | null;

  // Status change
  status: PmsNormalizedStatus;
  previousStatus: PmsNormalizedStatus | null;

  // Raw PMS payload for debugging
  rawPayload: Record<string, unknown>;
}

// Per-practice PMS integration config (matches DB row)
export interface PmsIntegration {
  id: string;
  practice_id: string;
  pms_type: PmsType;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  api_base_url: string | null;
  webhook_secret: string | null;
  webhook_api_key: string | null;
  polling_enabled: boolean;
  polling_interval_minutes: number;
  last_synced_at: string | null;
  sync_noshow: boolean;
  sync_complete: boolean;
  sync_cancelled: boolean;
  sync_rescheduled: boolean;
  active: boolean;
  last_error: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

// Sync log row (matches DB row)
export interface PmsSyncLogRow {
  id: string;
  practice_id: string;
  pms_event_id: string;
  pms_appointment_id: string;
  pms_patient_id: string | null;
  event_type: string;
  source: 'webhook' | 'polling' | 'manual';
  action_taken: string | null;
  dentiflow_appointment_id: string | null;
  dentiflow_patient_id: string | null;
  success: boolean;
  error_message: string | null;
  processed_at: string;
}

// Processing result
export interface PmsProcessResult {
  action: string;
  success: boolean;
  error?: string;
  appointmentId?: string;
  patientId?: string;
  sequenceId?: string;
}

// Batch sync result (for cron)
export interface PmsSyncResult {
  practicesProcessed: number;
  eventsProcessed: number;
  noshowSequencesCreated: number;
  reviewSequencesCreated: number;
  appointmentsSynced: number;
  patientsCreated: number;
  skippedDuplicate: number;
  errors: string[];
}

// Adapter interface — each PMS type implements this
export interface PmsAdapter {
  normalizeWebhookEvent(rawBody: Record<string, unknown>): PmsAppointmentEvent;
  verifyAuth(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    integration: PmsIntegration
  ): boolean;
  fetchRecentChanges(
    integration: PmsIntegration,
    since: Date
  ): Promise<PmsAppointmentEvent[]>;
}

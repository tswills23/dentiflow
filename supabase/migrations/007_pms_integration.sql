-- ============================================================================
-- DentiFlow PMS Integration — Schema Migration
-- Adds pms_integrations config table, pms_sync_log for idempotency,
-- pms_patient_id on patients, index on appointments.booking_platform_id
-- ============================================================================

-- 1. PMS integration config (one per practice)
CREATE TABLE IF NOT EXISTS pms_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,

  -- PMS identification
  pms_type text NOT NULL DEFAULT 'generic' CHECK (pms_type IN (
    'dentrix_ascend', 'open_dental', 'eaglesoft', 'generic'
  )),

  -- OAuth credentials (for API-based PMS like Dentrix Ascend)
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  api_base_url text,

  -- Webhook authentication
  webhook_secret text,          -- HMAC-SHA256 secret for signature verification
  webhook_api_key text,         -- Static API key alternative

  -- Polling config
  polling_enabled boolean DEFAULT false,
  polling_interval_minutes integer DEFAULT 10,
  last_synced_at timestamptz,

  -- Feature flags (which status changes to act on)
  sync_noshow boolean DEFAULT true,
  sync_complete boolean DEFAULT true,
  sync_cancelled boolean DEFAULT false,
  sync_rescheduled boolean DEFAULT false,

  -- Health tracking
  active boolean DEFAULT true,
  last_error text,
  error_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- One integration per practice
CREATE UNIQUE INDEX idx_pms_integrations_practice ON pms_integrations(practice_id);

-- Lookup by API key (for webhook auth without practiceId param)
CREATE INDEX idx_pms_integrations_api_key ON pms_integrations(webhook_api_key)
  WHERE webhook_api_key IS NOT NULL;

-- RLS
ALTER TABLE pms_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role pms_integrations" ON pms_integrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Practice pms_integrations" ON pms_integrations
  FOR SELECT USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pms_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 2. PMS sync log (idempotency + audit trail)
CREATE TABLE IF NOT EXISTS pms_sync_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,

  pms_event_id text NOT NULL,
  pms_appointment_id text NOT NULL,
  pms_patient_id text,

  event_type text NOT NULL,           -- no_show, completed, cancelled, rescheduled, etc.
  source text NOT NULL DEFAULT 'webhook' CHECK (source IN ('webhook', 'polling', 'manual')),

  -- What DentiFlow did
  action_taken text,                  -- noshow_sequence_created, review_sequence_created, appointment_synced, skipped_duplicate
  dentiflow_appointment_id uuid REFERENCES appointments(id),
  dentiflow_patient_id uuid REFERENCES patients(id),

  success boolean DEFAULT true,
  error_message text,

  processed_at timestamptz DEFAULT now(),

  -- Same PMS event can't be processed twice
  UNIQUE(practice_id, pms_event_id)
);

CREATE INDEX idx_pms_sync_log_practice_time ON pms_sync_log(practice_id, processed_at DESC);
CREATE INDEX idx_pms_sync_log_appointment ON pms_sync_log(pms_appointment_id);

-- RLS
ALTER TABLE pms_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role pms_sync_log" ON pms_sync_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Practice pms_sync_log" ON pms_sync_log
  FOR SELECT USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );


-- 3. Add pms_patient_id to patients for PMS-based patient resolution
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pms_patient_id text;
CREATE INDEX IF NOT EXISTS idx_patients_pms_patient_id ON patients(practice_id, pms_patient_id)
  WHERE pms_patient_id IS NOT NULL;


-- 4. Index booking_platform_id on appointments for fast PMS appointment upsert
CREATE INDEX IF NOT EXISTS idx_appointments_booking_platform_id
  ON appointments(practice_id, booking_platform_id)
  WHERE booking_platform_id IS NOT NULL;


-- 5. Add PMS events metric to daily tracking
ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS pms_events_processed integer DEFAULT 0;

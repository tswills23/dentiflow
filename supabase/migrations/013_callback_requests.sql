-- ============================================================================
-- DentiFlow Reactivation — Callback / human-handoff request log
-- When a recall patient asks for a call, their records, or otherwise needs a
-- human, the reply handler logs them here so the office has a running call list.
-- ============================================================================

CREATE TABLE IF NOT EXISTS callback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  patient_id uuid,
  patient_name text,
  phone text,
  request_type text NOT NULL DEFAULT 'callback',  -- 'callback' | 'records'
  message text,                                    -- the inbound text that triggered it
  status text NOT NULL DEFAULT 'open',             -- 'open' | 'done'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_callback_requests_practice_status
  ON callback_requests(practice_id, status, created_at DESC);

-- Secure by default: only the service role (backend) can read/write until we
-- add a dashboard policy.
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;

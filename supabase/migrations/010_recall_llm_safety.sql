-- Migration 010: Recall LLM Safety Controls
-- (1) DB-backed kill switch on practices — flips faster than env var redeploy
-- (2) Twilio MessageSid unique constraint — eliminates retry-induced double-sends

ALTER TABLE practices
  ADD COLUMN IF NOT EXISTS recall_llm_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN practices.recall_llm_enabled IS
  'Per-practice kill switch for recall reply LLM path. False = keyword/template only. Default false; flip via SQL UPDATE for instant rollback.';

-- Dedupe table for Twilio inbound webhooks. Twilio retries on slow/failed
-- responses within ~10 min. Same MessageSid arriving twice = retry, not a
-- new message. Insert with UNIQUE constraint to atomically reject retries.
CREATE TABLE IF NOT EXISTS processed_inbound_sms (
  twilio_message_sid text PRIMARY KEY,
  practice_id uuid REFERENCES practices(id) ON DELETE CASCADE,
  from_phone text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pis_received_at ON processed_inbound_sms (received_at DESC);

-- 7-day retention via pg_cron if available (Twilio retry window is much shorter)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('processed-inbound-sms-retention') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'processed-inbound-sms-retention'
    );
    PERFORM cron.schedule(
      'processed-inbound-sms-retention',
      '0 4 * * *',
      $cron$DELETE FROM processed_inbound_sms WHERE received_at < now() - interval '7 days'$cron$
    );
  END IF;
END $$;

COMMENT ON TABLE processed_inbound_sms IS
  'Atomic dedupe for Twilio inbound webhooks. PRIMARY KEY on MessageSid means duplicate inserts fail with 23505. 7-day retention (Twilio retries within minutes).';

-- Migration 009: Recall Reply Audit
-- Adds audit table for every recall reply (LLM and template paths), with RLS
-- and 180-day retention cron. Forensics + replay + future fine-tuning data.

CREATE TABLE IF NOT EXISTS recall_reply_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  sequence_id     uuid NOT NULL REFERENCES recall_sequences(id) ON DELETE CASCADE,
  practice_id     uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  inbound_message text NOT NULL,
  intent          text NOT NULL,
  confidence_score numeric(4,3),
  state_before    text NOT NULL,
  state_after     text NOT NULL,
  action          text NOT NULL,
  reply_text      text NOT NULL,

  used_llm        boolean NOT NULL DEFAULT false,
  llm_latency_ms  integer,
  llm_reasoning   text,
  raw_claude_content text,

  validator_pass  boolean NOT NULL DEFAULT true,
  validator_block_reason text,
  fallback_reason text,

  transition_overridden boolean NOT NULL DEFAULT false,
  llm_suggested_state text,

  input_tokens    integer,
  output_tokens   integer,
  cache_read_tokens integer
);

CREATE INDEX IF NOT EXISTS idx_rra_practice_created ON recall_reply_audit (practice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rra_used_llm         ON recall_reply_audit (used_llm, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rra_fallback         ON recall_reply_audit (fallback_reason) WHERE fallback_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rra_validator_blocks ON recall_reply_audit (created_at DESC) WHERE validator_block_reason IS NOT NULL;

-- RLS: service_role full access; authenticated users scoped to their practice
ALTER TABLE recall_reply_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rra_service_role ON recall_reply_audit;
CREATE POLICY rra_service_role ON recall_reply_audit FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS rra_user_practice ON recall_reply_audit;
CREATE POLICY rra_user_practice ON recall_reply_audit FOR SELECT TO authenticated
  USING (practice_id IN (SELECT practice_id FROM user_profiles WHERE id = auth.uid()));

-- 180-day retention cron — requires pg_cron extension
-- If pg_cron is not enabled, schedule this externally via Railway cron or skip.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('recall-audit-retention') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'recall-audit-retention'
    );
    PERFORM cron.schedule(
      'recall-audit-retention',
      '0 3 * * *',
      $cron$DELETE FROM recall_reply_audit WHERE created_at < now() - interval '180 days'$cron$
    );
  END IF;
END $$;

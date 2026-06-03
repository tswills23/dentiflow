-- ============================================================================
-- DentiFlow Reactivation — Two-stage link-click follow-up
-- Replaces the single 24h boolean follow-up with a 2-touch cadence:
--   Stage 1: 1h after the patient clicks the booking link
--   Stage 2: 24h after Stage 1, only if they never replied
-- ============================================================================

-- 1. Add cadence tracking columns to recall_sequences
ALTER TABLE recall_sequences
  ADD COLUMN IF NOT EXISTS link_followup_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_followup_last_sent_at timestamptz;

-- 2. Backfill: existing rows that already got the legacy single follow-up
--    count as having completed Stage 1.
UPDATE recall_sequences
  SET link_followup_count = 1
  WHERE link_followup_sent = true AND link_followup_count = 0;

-- 3. Index for Stage 1 candidates (clicked, no follow-up yet, still active)
CREATE INDEX IF NOT EXISTS idx_recall_sequences_link_followup_stage1
  ON recall_sequences(link_clicked_at)
  WHERE link_clicked_at IS NOT NULL AND link_followup_count = 0 AND sequence_status = 'active';

-- 4. Index for Stage 2 candidates (one follow-up sent, still active)
CREATE INDEX IF NOT EXISTS idx_recall_sequences_link_followup_stage2
  ON recall_sequences(link_followup_last_sent_at)
  WHERE link_followup_count = 1 AND sequence_status = 'active';

-- ============================================================================
-- DentiFlow Reactivation — Booking Link Tracking
-- Adds click-tracked redirect support, follow-up SMS flag, and link metrics
-- ============================================================================

-- 1. Add booking link tracking columns to recall_sequences
ALTER TABLE recall_sequences
  ADD COLUMN IF NOT EXISTS booking_link_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS link_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_followup_sent boolean DEFAULT false;

-- 2. Index for fast redirect lookups
CREATE INDEX IF NOT EXISTS idx_recall_sequences_booking_link_token
  ON recall_sequences(booking_link_token)
  WHERE booking_link_token IS NOT NULL;

-- 3. Index for follow-up cron queries
CREATE INDEX IF NOT EXISTS idx_recall_sequences_link_followup
  ON recall_sequences(link_clicked_at)
  WHERE link_clicked_at IS NOT NULL AND link_followup_sent = false AND sequence_status = 'active';

-- 4. Add link click metric to metrics_daily
ALTER TABLE metrics_daily
  ADD COLUMN IF NOT EXISTS recall_links_clicked integer DEFAULT 0;

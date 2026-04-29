-- ============================================================================
-- DentiFlow No-Show Recovery — Schema Migration
-- Adds noshow_sequences table, noshow metrics fields, increment function
-- ============================================================================

-- 1. Create noshow_sequences table
CREATE TABLE IF NOT EXISTS noshow_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,

  -- Sequence tracking
  status text NOT NULL DEFAULT 'message_1_pending' CHECK (status IN (
    'message_1_pending', 'message_1_sent', 'message_2_sent',
    'replied', 'rebooked', 'deferred', 'declined', 'opted_out', 'no_response'
  )),

  message_count smallint DEFAULT 0,
  booking_stage text DEFAULT 'S3_TIME_PREF',
  reply_count smallint DEFAULT 0,

  -- Booking state machine fields (shared pattern with recall)
  offered_slots jsonb,
  selected_slot jsonb,
  patient_preferences jsonb,

  -- Scheduling
  next_send_at timestamptz,
  last_sent_at timestamptz,
  defer_until timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_noshow_sequences_practice_status ON noshow_sequences(practice_id, status);
CREATE INDEX idx_noshow_sequences_patient ON noshow_sequences(patient_id);
CREATE INDEX idx_noshow_sequences_appointment ON noshow_sequences(appointment_id);
CREATE INDEX idx_noshow_sequences_next_send ON noshow_sequences(next_send_at) WHERE next_send_at IS NOT NULL;

-- 3. RLS
ALTER TABLE noshow_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice noshow sequences" ON noshow_sequences
  FOR ALL USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Service role noshow sequences" ON noshow_sequences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON noshow_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Add no-show metric fields to metrics_daily
ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS noshow_total integer DEFAULT 0;
ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS noshow_recovered integer DEFAULT 0;

-- 6. Increment function for no-show metrics
CREATE OR REPLACE FUNCTION increment_noshow_metric(
  p_practice_id uuid,
  p_date date,
  p_field text
) RETURNS void AS $$
BEGIN
  INSERT INTO metrics_daily (practice_id, date)
  VALUES (p_practice_id, p_date)
  ON CONFLICT (practice_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE metrics_daily SET %I = %I + 1 WHERE practice_id = $1 AND date = $2',
    p_field, p_field
  ) USING p_practice_id, p_date;
END;
$$ LANGUAGE plpgsql;

-- 7. Real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE noshow_sequences;

-- ============================================================================
-- DentiFlow Recall Engine — Schema Migration
-- Adds recall_sequences table, patient recall columns, metrics columns
-- ============================================================================

-- 1. Add recall columns to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS recall_eligible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS recall_opt_out boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recall_voice text,
  ADD COLUMN IF NOT EXISTS recall_segment text;

-- 2. Create recall_sequences table
CREATE TABLE IF NOT EXISTS recall_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Voice & segment (set at Day 0, never changes)
  assigned_voice text NOT NULL CHECK (assigned_voice IN ('office', 'hygienist', 'doctor')),
  segment_overdue text NOT NULL CHECK (segment_overdue IN ('lt_6', 'gte_6_lt_12', 'gte_12')),
  months_overdue numeric(5,1) NOT NULL DEFAULT 0,

  -- Sequence tracking
  sequence_day smallint NOT NULL DEFAULT 0 CHECK (sequence_day IN (0, 1, 3)),
  sequence_status text NOT NULL DEFAULT 'active' CHECK (sequence_status IN ('active', 'paused', 'completed', 'exited')),

  -- Booking agent state
  booking_stage text NOT NULL DEFAULT 'S0_OPENING',
  offered_slots jsonb,
  selected_slot jsonb,
  patient_preferences jsonb,

  -- Scheduling
  next_send_at timestamptz,
  last_sent_at timestamptz,
  template_id text,

  -- Exit tracking
  opt_out boolean DEFAULT false,
  defer_until timestamptz,
  exit_reason text,
  reply_count integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One active sequence per patient per practice
  CONSTRAINT unique_active_sequence UNIQUE (practice_id, patient_id)
);

-- 3. Add recall metrics columns to metrics_daily
ALTER TABLE metrics_daily
  ADD COLUMN IF NOT EXISTS recall_sent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recall_replies integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recall_booked integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recall_opt_outs integer DEFAULT 0;

-- 4. Indexes for recall_sequences
CREATE INDEX IF NOT EXISTS idx_recall_sequences_practice
  ON recall_sequences(practice_id);

CREATE INDEX IF NOT EXISTS idx_recall_sequences_patient
  ON recall_sequences(patient_id);

CREATE INDEX IF NOT EXISTS idx_recall_sequences_status
  ON recall_sequences(sequence_status)
  WHERE sequence_status = 'active';

CREATE INDEX IF NOT EXISTS idx_recall_sequences_next_send
  ON recall_sequences(next_send_at)
  WHERE sequence_status = 'active' AND next_send_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recall_sequences_booking_stage
  ON recall_sequences(booking_stage)
  WHERE sequence_status = 'active';

-- 5. Index for patient phone lookup (recall reply routing)
CREATE INDEX IF NOT EXISTS idx_patients_phone_practice
  ON patients(phone, practice_id)
  WHERE phone IS NOT NULL;

-- 6. RLS policies for recall_sequences
ALTER TABLE recall_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on recall_sequences"
  ON recall_sequences FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view recall_sequences for their practice"
  ON recall_sequences FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- 7. Updated_at trigger
CREATE OR REPLACE FUNCTION update_recall_sequences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recall_sequences_updated_at
  BEFORE UPDATE ON recall_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_recall_sequences_updated_at();

-- 8. Enable real-time for recall_sequences
ALTER PUBLICATION supabase_realtime ADD TABLE recall_sequences;

-- 9. Increment function for recall metrics
CREATE OR REPLACE FUNCTION increment_recall_metric(
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

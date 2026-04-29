-- ============================================================================
-- DentiFlow Reviews & Referrals Engine — Schema Migration
-- Adds review_sequences, review_feedback, referrals tables
-- ============================================================================

-- 1. Create review_sequences table
CREATE TABLE IF NOT EXISTS review_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id text,

  -- Sequence tracking
  status text NOT NULL DEFAULT 'survey_sent' CHECK (status IN (
    'survey_sent', 'survey_reminded', 'score_received',
    'review_requested', 'referral_sent', 'feedback_received',
    'completed', 'no_response'
  )),

  -- Satisfaction data
  satisfaction_score smallint CHECK (satisfaction_score BETWEEN 1 AND 5),
  review_url_sent boolean DEFAULT false,
  referral_sent boolean DEFAULT false,

  -- Scheduling
  survey_send_at timestamptz,
  reminder_sent_at timestamptz,
  review_requested_at timestamptz,
  referral_sent_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create review_feedback table
CREATE TABLE IF NOT EXISTS review_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  review_sequence_id uuid NOT NULL REFERENCES review_sequences(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback_text text NOT NULL,
  acknowledged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  referring_patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  referred_name text,
  referred_phone text,
  referral_link_hash text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'contacted', 'booked', 'converted', 'declined'
  )),
  converted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_review_sequences_practice_status
  ON review_sequences(practice_id, status);

CREATE INDEX IF NOT EXISTS idx_review_sequences_patient
  ON review_sequences(patient_id);

CREATE INDEX IF NOT EXISTS idx_review_sequences_status_active
  ON review_sequences(status)
  WHERE status IN ('survey_sent', 'survey_reminded', 'review_requested');

CREATE INDEX IF NOT EXISTS idx_review_feedback_practice
  ON review_feedback(practice_id);

CREATE INDEX IF NOT EXISTS idx_review_feedback_unacknowledged
  ON review_feedback(practice_id)
  WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_referrals_practice_status
  ON referrals(practice_id, status);

CREATE INDEX IF NOT EXISTS idx_referrals_hash
  ON referrals(referral_link_hash);

-- 5. RLS policies — review_sequences
ALTER TABLE review_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on review_sequences"
  ON review_sequences FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view review_sequences for their practice"
  ON review_sequences FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- 6. RLS policies — review_feedback
ALTER TABLE review_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on review_feedback"
  ON review_feedback FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view review_feedback for their practice"
  ON review_feedback FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- Allow dashboard users to update acknowledged flag
CREATE POLICY "Users can update review_feedback for their practice"
  ON review_feedback FOR UPDATE
  USING (
    practice_id IN (
      SELECT practice_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    practice_id IN (
      SELECT practice_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- 7. RLS policies — referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on referrals"
  ON referrals FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view referrals for their practice"
  ON referrals FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- 8. Updated_at triggers
CREATE OR REPLACE FUNCTION update_review_sequences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_review_sequences_updated_at
  BEFORE UPDATE ON review_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_review_sequences_updated_at();

-- 9. Add review metrics columns to metrics_daily
ALTER TABLE metrics_daily
  ADD COLUMN IF NOT EXISTS review_surveys_sent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_scores_received integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_links_sent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referrals_generated integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referrals_converted integer DEFAULT 0;

-- 10. Enable real-time for review tables
ALTER PUBLICATION supabase_realtime ADD TABLE review_sequences;
ALTER PUBLICATION supabase_realtime ADD TABLE review_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE referrals;

-- 11. Increment function for review metrics (reuse pattern from recall)
CREATE OR REPLACE FUNCTION increment_review_metric(
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

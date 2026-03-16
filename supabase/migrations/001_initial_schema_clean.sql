-- DentiFlow Speed-to-Lead: Clean Reset + Full Migration
-- Drops all existing objects first, then recreates everything

-- ============================================
-- DROP EXISTING (reverse dependency order)
-- ============================================

DROP TRIGGER IF EXISTS set_updated_at ON practices;
DROP TRIGGER IF EXISTS set_updated_at ON patients;
DROP TRIGGER IF EXISTS set_updated_at ON appointments;
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS increment_metric(uuid, date, text);

-- Remove from realtime publication (ignore errors if not added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS patients;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS conversations;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS appointments;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS metrics_daily;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP TABLE IF EXISTS automation_log CASCADE;
DROP TABLE IF EXISTS metrics_daily CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS practices CASCADE;

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_name text,
  phone text,
  email text,
  website text,
  address text,
  city text,
  state text,
  timezone text DEFAULT 'America/Chicago',
  booking_platform text DEFAULT 'booking_link',
  booking_url text,
  google_review_link text,
  brand_voice text DEFAULT 'professional',
  twilio_phone text,
  practice_config jsonb DEFAULT '{}'::jsonb,
  business_hours jsonb DEFAULT '{
    "monday": {"open": "08:00", "close": "17:00"},
    "tuesday": {"open": "08:00", "close": "17:00"},
    "wednesday": {"open": "08:00", "close": "17:00"},
    "thursday": {"open": "08:00", "close": "17:00"},
    "friday": {"open": "08:00", "close": "16:00"},
    "saturday": null,
    "sunday": null
  }'::jsonb,
  appointment_buffer_minutes integer DEFAULT 10,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid REFERENCES practices(id) NOT NULL,
  first_name text,
  last_name text,
  phone text,
  email text,
  source text DEFAULT 'web_form',
  status text DEFAULT 'new',
  interested_service text,
  patient_type text DEFAULT 'unknown',
  last_visit_date timestamptz,
  lead_score integer DEFAULT 0,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid REFERENCES practices(id) NOT NULL,
  patient_id uuid REFERENCES patients(id) NOT NULL,
  channel text NOT NULL,
  direction text NOT NULL,
  message_body text NOT NULL,
  service_context text,
  ai_generated boolean DEFAULT false,
  automation_type text,
  status text DEFAULT 'sent',
  twilio_sid text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid REFERENCES practices(id) NOT NULL,
  patient_id uuid REFERENCES patients(id) NOT NULL,
  service_id text NOT NULL,
  provider_name text,
  appointment_time timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  status text DEFAULT 'scheduled',
  source text,
  booking_platform_id text,
  estimated_revenue numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid REFERENCES practices(id) NOT NULL,
  date date NOT NULL,
  new_leads integer DEFAULT 0,
  leads_contacted integer DEFAULT 0,
  appointments_booked integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  avg_response_time_ms integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  under_60s_count integer DEFAULT 0,
  estimated_revenue_recovered numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(practice_id, date)
);

CREATE TABLE automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid REFERENCES practices(id) NOT NULL,
  patient_id uuid REFERENCES patients(id),
  automation_type text NOT NULL,
  action text,
  result text DEFAULT 'triggered',
  response_time_ms integer,
  message_body text,
  service_context text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  practice_id uuid REFERENCES practices(id) NOT NULL,
  role text DEFAULT 'owner',
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_patients_practice ON patients(practice_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_conversations_practice ON conversations(practice_id);
CREATE INDEX idx_conversations_patient ON conversations(patient_id);
CREATE INDEX idx_conversations_created ON conversations(created_at);
CREATE INDEX idx_appointments_practice ON appointments(practice_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_time ON appointments(appointment_time);
CREATE INDEX idx_metrics_practice_date ON metrics_daily(practice_id, date);
CREATE INDEX idx_automation_practice ON automation_log(practice_id);
CREATE INDEX idx_automation_created ON automation_log(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Practice patients" ON patients
  FOR ALL USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Practice conversations" ON conversations
  FOR ALL USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Practice appointments" ON appointments
  FOR ALL USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Practice metrics" ON metrics_daily
  FOR ALL USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Practice log" ON automation_log
  FOR ALL USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Service role patients" ON patients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role conversations" ON conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role appointments" ON appointments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role metrics" ON metrics_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role log" ON automation_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role practices" ON practices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role user_profiles" ON user_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON practices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION increment_metric(p_practice_id uuid, p_date date, p_field text)
RETURNS void AS $$
BEGIN
  INSERT INTO metrics_daily (practice_id, date)
  VALUES (p_practice_id, p_date)
  ON CONFLICT (practice_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE metrics_daily SET %I = COALESCE(%I, 0) + 1 WHERE practice_id = $1 AND date = $2',
    p_field, p_field
  ) USING p_practice_id, p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REAL-TIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE patients;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE metrics_daily;

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO practices (
  name, owner_name, phone, email, city, state, timezone,
  booking_platform, booking_url, brand_voice,
  practice_config
)
VALUES (
  'Wills Family Dentistry',
  'Demo Owner',
  '+16306400029',
  'demo@dentiflow.ai',
  'Chicago',
  'IL',
  'America/Chicago',
  'booking_link',
  'https://example.com/book',
  'professional',
  '{
    "services_offered": ["hygiene_cleaning", "comprehensive_exam", "emergency", "whitening", "crowns", "implant_consult"],
    "pricing_overrides": {
      "hygiene_cleaning": { "low": 150, "high": 250, "unit": "per visit", "notes": "Insurance typically covers preventive" },
      "whitening": { "low": 300, "high": 500, "unit": "per treatment" }
    },
    "providers": [
      { "name": "Dr. Wills", "title": "Dr.", "specialties": ["comprehensive_exam", "crowns", "implant_consult"] },
      { "name": "Sarah", "title": "RDH", "specialties": ["hygiene_cleaning", "perio_maintenance"] }
    ],
    "tone_notes": "Warm, caring, community-feel. Not corporate. Use ''our team'' not ''our staff''.",
    "booking_notes": "New patients should mention if they have X-rays from another office",
    "insurance_note": "We accept most PPO plans. Our team can verify benefits before your visit.",
    "new_patient_special": "Complimentary exam and X-rays for new patients"
  }'::jsonb
);

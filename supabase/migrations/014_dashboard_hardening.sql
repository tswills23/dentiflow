-- ============================================================================
-- Migration 014: Dashboard hardening
--   1. Close cross-tenant RLS leak on recall/review/referral tables
--   2. Add authenticated SELECT on practices + callback_requests
--   3. New dashboard_settings table (verified bookings + avg patient value)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cross-tenant leak fix
-- The "service role full access" policies were created as `FOR ALL USING(true)`
-- with NO `TO service_role` clause, so they defaulted to PUBLIC and any
-- authenticated user could read every practice's rows. Recreate scoped to
-- service_role only. The per-practice "Users can view ..." SELECT policies
-- already exist and remain the only path for authenticated users.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role full access on recall_sequences" ON recall_sequences;
CREATE POLICY "Service role full access on recall_sequences"
  ON recall_sequences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on review_sequences" ON review_sequences;
CREATE POLICY "Service role full access on review_sequences"
  ON review_sequences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on review_feedback" ON review_feedback;
CREATE POLICY "Service role full access on review_feedback"
  ON review_feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on referrals" ON referrals;
CREATE POLICY "Service role full access on referrals"
  ON referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2a. practices — authenticated SELECT (was service-role only, so the dashboard
-- silently fell back to default branding / could not read practice_config).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their practices" ON practices;
CREATE POLICY "Users can view their practices"
  ON practices FOR SELECT TO authenticated
  USING (
    id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 2b. callback_requests — authenticated SELECT (RLS was enabled with no policy,
-- so the office could never see the call list).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role full access on callback_requests" ON callback_requests;
CREATE POLICY "Service role full access on callback_requests"
  ON callback_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view callback_requests for their practice" ON callback_requests;
CREATE POLICY "Users can view callback_requests for their practice"
  ON callback_requests FOR SELECT TO authenticated
  USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 3. dashboard_settings — per-practice key/value store for owner-facing
-- dashboard inputs that have no live source (manual Dentrix-verified booking
-- count, average patient value used to compute revenue recovered).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dashboard_settings (
  practice_id uuid PRIMARY KEY REFERENCES practices(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on dashboard_settings" ON dashboard_settings;
CREATE POLICY "Service role full access on dashboard_settings"
  ON dashboard_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view dashboard_settings for their practice" ON dashboard_settings;
CREATE POLICY "Users can view dashboard_settings for their practice"
  ON dashboard_settings FOR SELECT TO authenticated
  USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert dashboard_settings for their practice" ON dashboard_settings;
CREATE POLICY "Users can insert dashboard_settings for their practice"
  ON dashboard_settings FOR INSERT TO authenticated
  WITH CHECK (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update dashboard_settings for their practice" ON dashboard_settings;
CREATE POLICY "Users can update dashboard_settings for their practice"
  ON dashboard_settings FOR UPDATE TO authenticated
  USING (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

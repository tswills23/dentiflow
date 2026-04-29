-- Migration 004: Multi-practice user support
-- Allows a single auth user to be linked to multiple practices
-- (e.g., DSO owner managing several locations as separate practices)

-- 1. Drop the UNIQUE constraint on auth_user_id (currently limits 1 practice per user)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_auth_user_id_key;

-- 2. Add composite unique constraint: one link per user-practice pair
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_auth_user_practice_unique
  UNIQUE (auth_user_id, practice_id);

-- 3. Add index for fast profile lookups by auth_user_id (used in RLS subqueries)
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles (auth_user_id);

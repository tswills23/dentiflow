-- Migration 003: Add location column to patients table
-- Stores the office/branch location from PMS CSV (e.g. "Downtown", "Northside")
-- Used to personalize recall SMS: "Hi John, this is Sarah from Bright Dental Downtown"

ALTER TABLE patients ADD COLUMN IF NOT EXISTS location text;

-- Index for filtering patients by location within a practice
CREATE INDEX IF NOT EXISTS idx_patients_practice_location
  ON patients (practice_id, location)
  WHERE location IS NOT NULL;

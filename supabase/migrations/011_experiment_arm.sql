-- A/B test arm tagging for recall sequences.
-- Null = not in experiment (default for all existing + future non-test sequences).
-- 'control_voice' = Arm A (existing 3-voice Day 0/1/3 sequence).
-- 'offer_only' = Arm B (single-send Day 0 offer message, auto-exits after 7 days).

ALTER TABLE recall_sequences
  ADD COLUMN experiment_arm TEXT
  CHECK (experiment_arm IS NULL OR experiment_arm IN ('control_voice', 'offer_only'));

CREATE INDEX idx_recall_sequences_experiment_arm
  ON recall_sequences(experiment_arm)
  WHERE experiment_arm IS NOT NULL;

COMMENT ON COLUMN recall_sequences.experiment_arm IS
  'A/B test arm. Null = not in experiment. control_voice = Arm A 3-voice. offer_only = Arm B single-send offer.';

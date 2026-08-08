-- Hold all Village Dental sequences beyond the first 500 (oldest 500 kept active)
UPDATE recall_sequences
SET sequence_status = 'exited', exit_reason = 'paused'
WHERE id IN (
  SELECT rs.id
  FROM recall_sequences rs
  JOIN patients p ON p.id = rs.patient_id
  WHERE p.location = 'Village Dental'
  AND rs.practice_id = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941'
  AND rs.sequence_status = 'active'
  ORDER BY p.created_at ASC
  OFFSET 500
);

SELECT sequence_status, exit_reason, COUNT(*)
FROM recall_sequences rs
JOIN patients p ON p.id = rs.patient_id
WHERE p.location = 'Village Dental'
AND rs.practice_id = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941'
GROUP BY sequence_status, exit_reason
ORDER BY sequence_status;

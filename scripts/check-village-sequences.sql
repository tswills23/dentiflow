SELECT rs.sequence_status, COUNT(*)
FROM recall_sequences rs
JOIN patients p ON p.id = rs.patient_id
WHERE p.location = 'Village Dental'
AND rs.practice_id = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941'
GROUP BY rs.sequence_status;

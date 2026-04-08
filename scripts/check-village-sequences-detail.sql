SELECT rs.sequence_status, rs.sequence_day, rs.last_sent_at IS NULL as not_yet_sent, COUNT(*)
FROM recall_sequences rs
JOIN patients p ON p.id = rs.patient_id
WHERE p.location = 'Village Dental'
AND rs.practice_id = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941'
GROUP BY rs.sequence_status, rs.sequence_day, not_yet_sent
ORDER BY rs.sequence_status, rs.sequence_day;

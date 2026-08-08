SELECT sequence_status, COUNT(*) FROM recall_sequences
WHERE practice_id = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941'
GROUP BY sequence_status;

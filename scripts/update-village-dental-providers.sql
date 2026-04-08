UPDATE practices
SET
  owner_name = 'Dr. Phillip',
  practice_config = jsonb_set(
    jsonb_set(
      practice_config,
      '{providers,0,name}',
      '"Dr. Phillip"'
    ),
    '{providers,1,name}',
    '"your hygiene team"'
  )
WHERE id = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941'
RETURNING name, owner_name, practice_config->'providers' as providers;

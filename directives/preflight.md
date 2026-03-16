# DentiFlow Preflight Check

Run before any recall campaign to verify system health.

## Checks

1. **Supabase connectivity** — can we read/write the patients table?
2. **Twilio credentials** — are TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN set?
3. **SMS_LIVE_MODE flag** — is it `true` (live) or `false` (console log)?
4. **Practice config** — does the target practice have a `twilio_phone` set?
5. **Template coverage** — are all 45 templates present (no placeholders)?
6. **Anthropic API** — is the ANTHROPIC_API_KEY set? (needed for STL + recall preference parsing fallback)
7. **Active sequences** — how many patients are currently in active recall sequences?

## Manual Verification

```bash
# 1. Check Supabase
curl http://localhost:3000/health

# 2. Check env vars
grep TWILIO .env
grep SMS_LIVE_MODE .env
grep ANTHROPIC .env

# 3. Check practice config
# Query Supabase for practice twilio_phone

# 4. Test ingest with 1 patient
POST /api/recall/ingest
{ "practiceId": "<UUID>", "patients": [{ "firstName": "Test", "phone": "5550001234", "lastVisitDate": "2025-01-01" }] }

# 5. Check response
# Should return { "imported": 1, "skipped": 0, "errors": [] }
```

## Future: Automated Preflight Endpoint

```
POST /api/recall/preflight?practice_id=<UUID>

Expected output:
{
  "checks": {
    "supabase": "ok",
    "twilio": "ok",
    "sms_mode": "live",
    "practice_config": "ok",
    "templates": "45/45 complete",
    "anthropic": "ok",
    "active_sequences": 0
  },
  "ready": true
}
```

## Notes
- Always run preflight before first outreach to a new practice
- SMS_LIVE_MODE=false is safe for testing — messages go to console.log
- Template coverage should be 45/45 (3 voices × 3 days × 5 variants)

# PMS Patient Data Ingest — SOP

## Overview

Import overdue patients from PMS (Practice Management Software) CSV exports into Supabase for recall outreach.

## Endpoint

```
POST /api/recall/ingest
Content-Type: application/json

{
  "practiceId": "<UUID>",
  "patients": [
    {
      "firstName": "Sarah",
      "lastName": "Johnson",
      "phone": "6305551234",
      "email": "sarah@example.com",
      "lastVisitDate": "2025-06-15"
    }
  ]
}
```

## CSV Column Mapping

| PMS Column | API Field | Required | Notes |
|------------|-----------|----------|-------|
| Patient First Name | firstName | Yes | Used in SMS templates |
| Patient Last Name | lastName | No | Stored for reference |
| Phone Number | phone | Yes | Normalized to E.164 (+1XXXXXXXXXX) |
| Email | email | No | Stored, not used for recall |
| Last Visit Date | lastVisitDate | No | ISO date. If missing, defaults to 24 months overdue |

## Phone Normalization

- 10 digits → prepend +1
- 11 digits starting with 1 → prepend +
- Invalid formats → skipped with error logged

## Processing Pipeline

1. Normalize phone number
2. Check if patient exists (by phone + practice_id)
3. If new → create patient record with `source: 'manual'`, `status: 'inactive'`, `patient_type: 'existing_patient'`
4. If existing → check `recall_opt_out` flag (skip if true)
5. Check for existing active recall sequence (skip if exists)
6. Calculate months overdue from `lastVisitDate`
7. Assign voice tier (office / hygienist / doctor)
8. Create `recall_sequences` row with `sequence_day: 0`, `sequence_status: 'active'`
9. Mark patient `recall_eligible = true`

## Post-Ingest

After successful ingest, trigger outreach:

```
POST /api/recall/outreach
{ "practiceId": "<UUID>" }
```

## Source Files

- `src/services/recall/ingestAgent.ts` — Import pipeline
- `src/services/recall/voiceAssignment.ts` — Voice tier calculation

## Notes

- Patients are marked `recall_eligible = true` after passing filters
- Duplicate phone numbers within the same practice are deduplicated
- Re-ingesting a patient with an active sequence is a no-op (skipped)

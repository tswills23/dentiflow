# PMS Patient Data Ingest — SOP

## Overview

Import overdue patients from PMS (Practice Management Software) CSV exports into Supabase for recall outreach. Uses a two-step flow with a human checkpoint between import and outreach.

## Two-Step Flow

### Step 1: Import (no texts sent)

```
POST /api/recall/import
Content-Type: application/json

{
  "practiceId": "<UUID>",
  "csv": "<raw CSV text>"
}
```

Response includes: parsed count, imported count, skipped count, errors, voice/location breakdown.

### Step 2: Launch outreach (after review)

```
POST /api/recall/launch
Content-Type: application/json

{
  "practiceId": "<UUID>"
}
```

Sends Day 0 SMS to all imported patients. From here, hourly cron handles everything automatically.

## CSV Parser (csvParser.ts)

The parser handles real-world PMS exports with these features:

### Auto-Header Detection
- Scans first 20 lines for known header keywords (Phone, Patient, First, etc.)
- Skips PMS title/metadata rows automatically (Dentrix Ascend exports 3-4 title rows)

### Column Mapping

| PMS Column Variations | Maps To | Required |
|-----------------------|---------|----------|
| `Patient`, `Patient Name`, `Name` | firstName + lastName (combined "Last, First" format) | Yes (firstName) |
| `First Name`, `FirstName`, `fname` | firstName | Yes |
| `Last Name`, `LastName`, `lname` | lastName | No |
| `Phone`, `Phone Number`, `Phone #`, `Mobile`, `Cell` | phone | Yes |
| `Email`, `Email Address` | email | No |
| `Last Visit`, `Last Visit Date`, `Last Appt` | lastVisitDate | No (defaults to 24mo overdue) |
| `Preferred Location`, `Location`, `Office`, `Branch`, `Clinic` | location | No |
| `Next Appointment Date`, `Next Appt` | (skip filter) | — |

### Combined Name Parsing
- Format: `"Last, First Middle"` or `"Last, First ~"` (~ = PMS inactive flag)
- Example: `"Marsaglia, Julia A"` → firstName: `Julia`, lastName: `Marsaglia`
- Middle names/initials are stripped (first word only after comma)

### Filtering
- Patients with a `Next Appointment Date` value are skipped (already scheduled)
- Rows missing firstName are skipped with error logged
- Rows missing phone are skipped with error logged

### Format Handling
- BOM character stripping (Excel UTF-8 exports)
- Relaxed column count (handles empty/extra columns)
- Quoted fields with commas inside

## Phone Normalization

- 10 digits → prepend +1
- 11 digits starting with 1 → prepend +
- Invalid formats → skipped with error logged

## Processing Pipeline

1. Parse CSV with csvParser.ts
2. For each valid record:
   a. Normalize phone number
   b. Check if patient exists (by phone + practice_id)
   c. If new → create patient record with `source: 'manual'`, `status: 'inactive'`, `patient_type: 'existing_patient'`
   d. If existing → check `recall_opt_out` flag (skip if true)
   e. Check for existing active recall sequence (skip if exists)
   f. Calculate months overdue from `lastVisitDate`
   g. Assign voice tier (office / hygienist / doctor)
   h. Set patient `location` field
   i. Create `recall_sequences` row with `sequence_day: 0`, `sequence_status: 'active'`
   j. Mark patient `recall_eligible = true`

## Google Sheet Review

After import, a segmented Google Sheet can be generated for review:
- Script: `.tmp/create_sheet.mjs`
- Uses `gcloud.cmd auth print-access-token` + Sheets API v4
- Creates per-location tabs (one tab per office + "All Patients" tab)
- Navy header, frozen row, filters, auto-sized columns
- Prerequisite: `gcloud auth login --enable-gdrive-access`

## Real-World Import Stats (Wills Family Dentistry — Dentrix Ascend)

| Metric | Count |
|--------|-------|
| CSV rows | 6,876 |
| Skipped (have appointments) | 2,896 |
| Skipped (no phone) | 180 |
| Imported | 3,800 |
| 32 Cottage Dental Care | 2,421 |
| Village Dental | 966 |
| 32 Western Springs Dentistry | 413 |
| Doctor voice (12+ months) | 2,465 |
| Hygienist voice (6-12 months) | 776 |
| Office voice (<6 months) | 712 |

## Source Files

- `src/services/recall/csvParser.ts` — CSV parsing + header detection
- `src/services/recall/ingestAgent.ts` — Import pipeline (normalize, dedupe, voice/segment assign)
- `src/services/recall/voiceAssignment.ts` — Voice tier calculation
- `.tmp/create_sheet.mjs` — Google Sheets report generator

## Notes

- Express body limit is 5mb (`express.json({ limit: '5mb' })`) — required for large CSVs
- Patients are marked `recall_eligible = true` after passing filters
- Duplicate phone numbers within the same practice are deduplicated
- Re-ingesting a patient with an active sequence is a no-op (skipped)
- Recall opt-out is permanent — sets `recall_opt_out = true` on patient record
- Large imports (~3,800 patients) take ~2-3 minutes via HTTP; server continues even if client times out

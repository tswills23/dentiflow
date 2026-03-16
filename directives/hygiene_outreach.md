# Hygiene Outreach Workflow — SOP

## Overview

Automated SMS outreach to overdue hygiene patients. Uses a 3-day sequence with voice-matched templates to maximize reply rates and booking conversions.

## Workflow

### 1. Patient Selection
- Export overdue patients from Dentrix Ascend (or other PMS)
- Filter: last hygiene visit > 5 months ago
- Format as CSV with columns: firstName, lastName, phone, lastVisitDate

### 2. Upload
```
POST /api/recall/ingest
{ "practiceId": "<UUID>", "patients": [...] }
```

### 3. Voice Assignment (Automatic)
Patients are automatically assigned a voice tier based on months overdue:
- < 6 months → office (front desk tone)
- 6–12 months → hygienist (care-focused)
- 12+ months → doctor (authority voice)

### 4. Outreach
```
POST /api/recall/outreach
{ "practiceId": "<UUID>" }
```

Sends Day 0 SMS to all eligible patients. No CTA — optimized for replies.

### 5. Follow-Up (Automated)
Run the orchestrator hourly (cron or manual):
```
POST /api/recall/orchestrate
{ "practiceId": "<UUID>" }
```

- Day 1 (+24h): Soft CTA — "Would mornings or afternoons work?"
- Day 3 (+48h from Day 1): Direct CTA — "We have a spot Tuesday at 10am"
- Auto-exit (+24h from Day 3): Mark as no_response

### 6. Reply Handling (Automated)
Patient replies routed automatically via Twilio webhook:
- Booking interest → show available slots
- Time preferences → show matching slots
- Opt-out ("STOP") → exit sequence, mark patient
- Cost/urgent → handoff to staff

## SMS Character Limit
All outreach templates are under 320 characters. Keep all responses under 320 characters.

## Filtering Criteria
```sql
SELECT * FROM patients
WHERE practice_id = '<UUID>'
  AND recall_eligible = true
  AND recall_opt_out = false
  AND last_visit_date < NOW() - INTERVAL '5 months';
```

## Metrics
Track in `metrics_daily`:
- `recall_sent` — total SMS sent
- `recall_replies` — patient replies received
- `recall_booked` — appointments booked
- `recall_opt_outs` — patients who opted out

## Source Files
- `src/services/recall/outreachEngine.ts`
- `src/services/recall/sequenceOrchestrator.ts`
- `src/services/recall/templates.ts`

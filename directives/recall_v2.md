# DentiFlow Recall Engine — Specification v2 (SMS)

## Overview

The recall engine re-engages overdue patients via automated SMS sequences. It uses a 3-day cadence with voice-assigned templates and a booking state machine to guide patients to scheduling.

## Architecture

```
PMS CSV Export
    → POST /api/recall/ingest (ingestAgent.ts)
    → Supabase patients table (with voice assignment)

Outreach Trigger
    → POST /api/recall/outreach (outreachEngine.ts)
    → Sends Day 0 SMS via Twilio (smsService.ts)
    → Logs to conversations + automation_log

Hourly Cron
    → POST /api/recall/orchestrate (sequenceOrchestrator.ts)
    → Sends Day 1 follow-up (+24h from Day 0)
    → Sends Day 3 follow-up (+48h from Day 1)
    → Auto-exits non-responders (+24h from Day 3)
    → Re-activates deferred patients (60 days after deferral)

Patient Replies
    → POST /webhooks/sms (Twilio inbound)
    → Routing check: active recall sequence? → replyHandler.ts
    → No active sequence? → speed-to-lead pipeline
    → replyHandler classifies intent, navigates booking state machine
    → All responses validated by responseValidator.ts before sending
```

## Voice Assignment

Voice tier is determined by months overdue at ingest time:

| Months Overdue | Segment | Voice | Rationale |
|----------------|---------|-------|-----------|
| < 6 | lt_6 | office | Low urgency, casual front-desk tone |
| 6–12 | gte_6_lt_12 | hygienist | Medium urgency, care-focused |
| 12+ | gte_12 | doctor | High urgency, authority voice |

Voice is set at Day 0 and never changes within a sequence.

## Sequence Cadence

| Day | Delay | Template Style | Behavior |
|-----|-------|---------------|----------|
| 0 | Immediate | Warm, no CTA | Reply-optimized opener |
| 1 | +24h | Soft CTA | Gentle nudge with scheduling mention |
| 3 | +48h from Day 1 | Direct CTA | Clear booking ask, only if no reply |
| Auto-exit | +24h from Day 3 | — | Mark `no_response`, exit sequence |

## Template System

- 45 total templates: 3 voices × 3 days × 5 variants
- Variant selection: MD5 hash of phone number → variant 1–5
- Templates are deterministic — same phone always gets same variant
- All templates under 320 characters (SMS limit)
- Templates defined in `src/services/recall/templates.ts`

## Booking State Machine

Stages: S0_OPENING → S1_INTENT → S3_TIME_PREF → S4_AVAILABILITY → S5_CONFIRMATION → S6_COMPLETED

Exit states: EXIT_OPT_OUT, EXIT_DEFERRED, EXIT_DECLINED, EXIT_CANCELLED

Handoff state: S7_HANDOFF (urgent, cost questions, wrong number)

State transitions defined in `src/services/recall/bookingStateMachine.ts`

## Intent Classification

Context-aware keyword matching (same word → different intent based on current stage):
- "yes" in S0 → booking_interest
- "yes" in S4 → confirm
- "yes" in S5 → confirm

Priority order: opt_out → cost → urgent → stage-specific → unclear

Defined in `src/services/recall/intentClassifier.ts`

## Data Model

Primary table: `recall_sequences` in Supabase

Key columns:
- `assigned_voice`, `segment_overdue`, `months_overdue` — set at ingest
- `sequence_day` (0, 1, 3), `sequence_status` (active, paused, completed, exited)
- `booking_stage` — current FSM stage
- `offered_slots`, `selected_slot`, `patient_preferences` — booking state
- `opt_out`, `defer_until`, `exit_reason` — exit tracking

Patient columns: `recall_eligible`, `recall_opt_out`, `recall_voice`, `recall_segment`

Metrics: `recall_sent`, `recall_replies`, `recall_booked`, `recall_opt_outs` on `metrics_daily`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recall/ingest` | POST | Import patients from CSV |
| `/api/recall/outreach` | POST | Trigger Day 0 SMS for eligible patients |
| `/api/recall/orchestrate` | POST | Run sequence orchestrator (Day 1/3, auto-exit, re-entry) |
| `/webhooks/sms` | POST | Twilio inbound — routes to recall or STL |

## HIPAA Guardrails

The response validator blocks:
- Shaming language (overdue, delinquent, negligent)
- Fear language (damage, deteriorate, worsen)
- Incentive language (guarantee, free, discount, promo)
- Visit history references (HIPAA — no PHI in SMS)
- Diagnosis language (inherited from STL validator)

## Source Files

| File | Purpose |
|------|---------|
| `src/services/recall/ingestAgent.ts` | CSV import pipeline |
| `src/services/recall/outreachEngine.ts` | Day 0 SMS sending |
| `src/services/recall/sequenceOrchestrator.ts` | Day 1/3, auto-exit, re-entry |
| `src/services/recall/replyHandler.ts` | Reply processing + booking flow |
| `src/services/recall/bookingStateMachine.ts` | FSM transitions (33 rules) |
| `src/services/recall/intentClassifier.ts` | Context-aware intent detection |
| `src/services/recall/slotSelector.ts` | Balanced round-robin slot selection |
| `src/services/recall/templates.ts` | 45 SMS templates |
| `src/services/recall/voiceAssignment.ts` | Voice tier assignment |

## Notes

- Python implementation archived in `_archive/` for reference
- SMS_LIVE_MODE=false sends to console instead of Twilio
- 60-second cooldown per phone number (shared with STL)
- One outbound per inbound — no double-sends

# SMS Booking Agent — Conversation Flow

## Overview

The SMS booking agent handles the multi-turn conversation when a recall patient replies to an outreach message. It navigates a finite state machine to guide the patient from initial reply to confirmed appointment.

## Flow

```
Inbound SMS → /webhooks/sms → routing check
    → Active recall sequence found? → replyHandler.ts
        1. Classify intent (intentClassifier.ts)
        2. Get state transition (bookingStateMachine.ts)
        3. Execute action (show slots, confirm, handoff, etc.)
        4. Validate response (responseValidator.ts)
        5. Send SMS reply (smsService.ts)
        6. Update recall_sequence in Supabase
    → No active sequence? → speed-to-lead pipeline (unchanged)
```

## State Machine Stages

| Stage | Purpose | Common Next |
|-------|---------|-------------|
| S0_OPENING | Initial reply received | S3_TIME_PREF or S4_AVAILABILITY |
| S1_INTENT | Determining patient intent | S3_TIME_PREF |
| S3_TIME_PREF | Collecting time preferences | S4_AVAILABILITY |
| S4_AVAILABILITY | Presenting verified time slots | S5_CONFIRMATION |
| S5_CONFIRMATION | Confirming selected slot | S6_COMPLETED |
| S6_COMPLETED | Booking done (terminal) | — |
| S7_HANDOFF | Escalate to human (terminal) | — |

Exit states: EXIT_OPT_OUT, EXIT_DEFERRED, EXIT_DECLINED, EXIT_CANCELLED

## Intent Classification

Context-aware — the same reply text maps to different intents depending on current stage:

| Reply | Stage S0 | Stage S4 | Stage S5 |
|-------|----------|----------|----------|
| "yes" | booking_interest | confirm | confirm |
| "sure" | booking_interest | confirm | confirm |
| "morning" | preferences | preferences | preferences |

Priority order: opt_out → cost_question → urgent → stage-specific → unclear

## Actions

| Action | Behavior |
|--------|----------|
| ask_preferences | Ask for preferred days/times |
| show_balanced_slots | Present 3 slots matching preferences |
| show_default_slots | Present 3 default slots (morning/afternoon mix) |
| confirm_slot | Confirm the selected slot with details |
| complete_booking | Finalize booking, exit as completed |
| handoff_urgent | Escalate to staff for urgent issue |
| handoff_cost | Escalate for insurance/cost questions |
| opt_out_silent | Mark opt-out, update patient record |
| defer_60_days | Defer sequence for 60 days |
| acknowledge_decline | Acknowledge decline, exit gracefully |

## Policy Overrides

These override any stage transition:
- `opt_out` → EXIT_OPT_OUT (always honored)
- `urgent_medical` → S7_HANDOFF
- `cost_question` → S7_HANDOFF
- `wrong_number` → S7_HANDOFF
- `needs_human` → S7_HANDOFF

## Slot Selection

- Round-robin across requested days for balanced distribution
- Office hours: 9–11 AM (morning), 2–4 PM (afternoon)
- Open days: Monday–Friday
- 14-day lookahead window
- Default: 3 slots presented

## Conversation Tracking

- No thread IDs — conversations tracked by patient phone + recall_sequence_id
- All messages logged to `conversations` table with `automation_type: 'recall'`
- State persisted in `recall_sequences` row (booking_stage, offered_slots, selected_slot, patient_preferences)

## Source Files

- `src/services/recall/replyHandler.ts` — Main orchestrator
- `src/services/recall/bookingStateMachine.ts` — FSM transitions
- `src/services/recall/intentClassifier.ts` — Intent detection
- `src/services/recall/slotSelector.ts` — Slot selection

## Notes

- Python V4 implementation archived in `_archive/booking_agent_python/`
- All responses validated by `responseValidator.ts` before sending
- Staff notification sent on handoff (S7_HANDOFF)

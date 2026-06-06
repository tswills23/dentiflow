# AI-Booking Architecture (Ascend integration)

Status: planning doc — not yet implemented. Created 2026-05-19 after Ascend partner-program access was confirmed.

## Strategic context

Current recall product: SMS → patient taps link → Dentrix Ascend booking page → patient self-books.
Target product: SMS → patient replies → AI converses, queries real availability, writes the appointment to Ascend via API, sends confirmation.

The binary blocker (Ascend write-API access) is cleared. Existing recall infrastructure already covers ~80% of the scaffolding needed.

## What already exists (reuse, don't rebuild)

| Component | File | What it does today |
|---|---|---|
| Reply handler orchestrator | `src/services/recall/replyHandler.ts` | Routes inbound SMS through intent classifier → state machine → action → reply |
| Intent classifier | `src/services/recall/intentClassifier.ts` | 13 intents incl. `booking_interest`, `preferences`, `slot_selection`, `confirm`, `booked_confirmation` |
| State machine | `src/services/recall/bookingStateMachine.ts` | S0_OPENING → S1_INTENT → S3_TIME_PREF → S4_AVAILABILITY → S5_CONFIRMATION → S6_COMPLETED. Already supports the right transitions. |
| AI reply generator | `src/services/recall/recallReplyAI.ts` | Claude Sonnet 4.5 with validator. Generates the conversational text. |
| Validator | Reply validator (HIPAA, tone, voice rules) | Already gates every AI-generated reply |
| Critical-intent guard | `classifyCriticalIntent()` | opt_out / urgent / wrong_number bypass AI entirely |
| Booking-link tracker | `src/routes/bookingRedirectRoute.ts` + `link_clicked_at` | Becomes optional fallback for patients who prefer self-service |
| Time-preference parser | `parsePreferences()` in intentClassifier | Extracts day/time-of-day from "Tuesday afternoon" |

## What needs to change

### 1. Replace synthetic slot generator with Ascend availability lookup

**Today:** `src/services/recall/slotSelector.ts` invents 9am/10am/2pm slots over a 14-day window. Not connected to real availability.

**Target:** new `src/services/pms/ascend/availability.ts` that queries Ascend for actual open slots matching the patient's time preferences, returning slots tied to real provider/operatory/duration.

Interface should preserve `AvailableSlot` shape so `replyHandler.ts` doesn't care whether slots are synthetic or real — feature-flag per practice.

### 2. New action: `book_appointment`

State machine transitions: when patient confirms a slot (S5_CONFIRMATION:confirm), instead of just marking the sequence S6_COMPLETED, fire an `ascendCreateAppointment()` call before transitioning. If the write succeeds → S6 + confirmation SMS. If the write fails → S7_HANDOFF + staff notification ("AI tried to book, system error, please contact patient").

New file: `src/services/pms/ascend/appointmentWriter.ts` with `createAppointment(slot, patient, appointmentType, providerId) → { appointmentId, confirmedAt }`.

### 3. Slot-locking to prevent races

Two patients confirming the same slot 30 seconds apart must not both succeed. Options:
- **Optimistic:** call Ascend with the slot, let Ascend reject if taken, gracefully reshow alternatives. Simplest, depends on Ascend's atomicity guarantee.
- **Pessimistic:** soft-hold via `recall_sequences.held_slot_until` for 5 minutes when AI offers a specific slot. Cleared on confirm/decline/timeout.

Pick optimistic for v1. Only escalate to pessimistic if Ascend returns race-condition errors in practice.

### 4. Appointment-type and provider routing

A receptionist picks slots using soft logic: cleaning vs emergency vs new-patient go to different slot lengths and different providers. AI needs the same routing.

New table: `practice_appointment_types` — per practice, mapping intent-language ("cleaning", "checkup", "tooth hurts") to Ascend appointment-type IDs, default duration, default provider/operatory pool. Per-practice configuration (not template-locked) since every office is different.

### 5. Webhook ingest from Ascend (if supported) / nightly poll fallback

When a patient cancels or reschedules outside our flow (calls the office, walks in, uses the patient portal), we need to know.

- If Ascend exposes webhooks: subscribe to `appointment.created` / `appointment.cancelled` / `appointment.updated`, normalize into our existing `appointments` table.
- If poll-only: nightly cron pulls today + next 14 days, diffs against `appointments`, fires our existing `bookingAttribution` logic.

Either way: `appointments` table becomes the source of truth, and the existing `attributeReactivationBookings()` cron auto-closes sequences.

### 6. Audit log + staff dashboard surface

Every AI-initiated appointment write needs:
- Full conversation transcript stored on the appointment record (or linked via sequence_id)
- Staff dashboard row showing "AI booked Patient X for Y date" with one-click "review" / "cancel" buttons
- Daily summary email to the practice: "Yesterday AI booked 4 appointments, handed off 2"

Builds practice trust. Non-negotiable for v1.

### 7. Human-handoff path

Triggers for handoff (skip AI booking, alert staff):
- Patient explicitly says "have someone call me"
- Insurance complexity AI can't resolve
- Slot AI offered is no longer available AND patient said "no other options"
- Any Ascend API error (5xx, timeout, auth)
- Cost questions that go beyond the cost-handoff template
- Anything the validator blocks

Existing `notifyEscalation()` in `staffNotifier.ts` already does this — reuse, just expand triggers.

## Data model changes

```sql
-- new: per-practice appointment routing config
create table practice_appointment_types (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid references practices(id),
  intent_keywords text[], -- ['cleaning', 'checkup', 'hygiene']
  ascend_appointment_type_id text not null,
  default_duration_min int not null,
  default_provider_ids text[],
  default_operatory_ids text[],
  created_at timestamptz default now()
);

-- new columns on recall_sequences
alter table recall_sequences add column held_slot_until timestamptz; -- for pessimistic locking if needed
alter table recall_sequences add column ascend_appointment_id text;
alter table recall_sequences add column booking_confirmed_at timestamptz;

-- new columns on appointments (if not already there)
alter table appointments add column source text default 'manual'; -- 'manual' | 'ai_booking' | 'patient_portal' | 'ascend_sync'
alter table appointments add column sequence_id uuid references recall_sequences(id);

-- new: ascend credentials per practice
alter table practices add column ascend_api_credentials jsonb; -- encrypted; access token, refresh token, practice id at ascend
alter table practices add column ascend_partner_practice_id text;
```

## Phased rollout

**Phase 0 (this week — gated on Railway recovery):**
- Fix BACKEND_URL guard (already drafted locally)
- Send broken-link recovery to the 283 patients who got `undefined/r/...`
- Restore production service

**Phase 1 (week 1–2 — Ascend onboarding):**
- Follow up with Ascend, formalize partner-program enrollment
- Sandbox credentials, API documentation, test practice
- Write `src/services/pms/ascend/client.ts` — auth, retry, rate-limit handling
- Read-only first: availability lookup + appointment list

**Phase 2 (week 3–4 — pilot read flow):**
- Replace `slotSelector.ts` with real-Ascend availability behind a feature flag
- One practice (Village Dental), one segment (6–12 month overdue), 50 patients
- AI still sends link to book — but the slots offered are real
- Validates that availability lookup is accurate

**Phase 3 (week 5–6 — write pilot):**
- Add `appointmentWriter.ts` for AI to actually create appointments
- Same segment, conservative: only book if patient explicitly confirms a slot AI proposed
- Daily audit review with the practice for first 2 weeks
- Tight error logging and handoff fallbacks

**Phase 4 (week 7+):**
- Expand to all 32 Dental group locations
- Open to more segments (no-show recovery, new-patient inquiries)
- Roll as premium tier feature

## What we learned from public research (2026-05-20)

**Cost:** $5,000 one-time + $47/location/month. Reasonable at scale; small expense at 32 Dental's volume.

**Real blocker:** **SOC2 Type II certification is mandatory for production access.** Typical 6–12 month timeline; Vanta/Drata can accelerate to ~4 months. Start this in parallel with everything else — it's the long pole.

**Sandbox:** 60-day window from signed agreement. Don't sign until we're staffed to build, or the clock burns idle.

**Quota:** 30,000 API calls + 3 GB / location / month included; $0.0018/call overage. At ~10 calls per booking, that's 3,000 bookings/practice/month free — plenty of headroom.

**Auth model:** unclear from public docs — mixed signals between OAuth 2.0 (for vendor identity) and per-practice API keys. Likely both: OAuth establishes our app, practice-admin grants per-practice creds.

**Documented endpoint categories (paths NOT public):** Schedule, Patient, Clinical, Treatment, Insurance, Financial. For our use: Schedule (appointment CRUD, availability, providers, operatories) and Patient (lookup, possibly create).

**Streaming events:** Supported in some form for near-real-time updates instead of pure polling. Transport (true webhooks vs SSE vs long-poll) not specified publicly.

**Other live partners on Ascend API:** Arini, Resonate, Kickcall (AI voice receptionists doing live booking), DentaFlo (scheduling layer), Dental Intelligence + athenahealth (analytics/EHR), NexHealth (booking + sync). 140+ vendors total in the API Exchange. We'd be joining a real category, not creating one — the fact that competitors are doing live booking is a positive signal that the API supports our use case.

## Open questions for Ascend pre-agreement Q&A

Before signing (and starting the 60-day sandbox clock):

1. Confirm `POST appointment` endpoint exists and works for existing patients without UI/Chrome-extension assistance.
2. Confirm a real-time **availability** endpoint exists (not just "compute from schedule template + existing appointments client-side").
3. **Atomicity guarantee** on appointment write — does Ascend reject 409 on slot conflict, or silently double-book?
4. Streaming events catalog — which entities fire events, payload shape, retry/replay/delivery guarantees.
5. Idempotency-key support on writes.
6. Whether appointments created by our app are editable by other apps (and vice versa).
7. Sandbox practice ID + how to extend beyond 60 days if needed.
8. Cancel/reschedule endpoints — same atomicity question.

Contact: `ddp@henryscheinone.com` / 801.847.4278.

## What stays the same

- Partner-locked recall templates (Day 0/1/3, 3 voices). AI-booking augments the reply layer, not the outbound template bank.
- Validator and tone rules. Every AI-booking reply still passes through the existing voice/HIPAA/tone validator.
- Critical-intent guard. Opt-out / urgent / wrong-number never reach the booking AI — same hard pre-filter that protects the recall LLM today.
- Per-practice kill switches: `recall_llm_enabled` (DB), `RECALL_LLM_FORCE_OFF` (env), `RECALL_LLM_ENABLED` (env). Add a fourth: `ascend_booking_enabled` per practice.

## Competitive positioning

- **Pearly** does AI-booking-via-SMS for dental. Closest competitor.
- **NexHealth** has booking-API integrations across multiple PMS — broader, less deep.
- **Weave / Solutionreach / RevenueWell** — link-based, AI roadmaps exist but not shipped.

Our edge if we ship this well:
- Partner-locked voice rules calibrated from real patient roleplay (already documented in CLAUDE.md)
- Per-voice cohort routing (doctor / hygienist / office) — nobody else does this
- Recall + no-show + reviews in one conversation thread (existing infra advantage)

## What this does NOT change

- Recall strategy stays Arm A (3-touch, 3-voice). AI-booking happens *inside* the reply layer; the outbound templates stay partner-locked.
- Phone calls are still the primary booking channel for many patients. AI-booking captures the SMS-replyer cohort, doesn't replace the front desk.
- Click-tracker becomes a fallback for patients who prefer self-service. Don't tear it out — let patients route themselves.

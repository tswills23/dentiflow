# GHL Wiring & Reporting — How the Pieces Actually Connect

**Date:** 2026-07-27
**Answers:** "If the front desk marks a no-show in the PMS, how does GHL know?" and "How do the Claude agents and GHL produce results I can prove to clients?"

---

## The core correction

The course teaches **GHL workflows as the brain**. Under that model your challenge is completely valid and there's no good answer — GHL can't see the PMS, so either something syncs every appointment state into GHL, or the office abandons their scheduler and lives in GHL. For a dental practice the second option is a non-starter. Front desks run on Dentrix and Open Dental. That is not changing, and any pitch that requires it will lose.

But that model isn't yours. **Dentiflow is the brain. GHL is the surface.** Under that model the problem dissolves, because GHL never needs to *detect* anything — it only needs to be *told* what happened.

| | Course model | Dentiflow model |
|---|---|---|
| Source of truth | GHL | **The PMS** |
| Who detects the no-show | GHL (can't) | Dentiflow's PMS sync (already works) |
| Who decides to chase | GHL workflow | Dentiflow's no-show service |
| Who sends | GHL | Dentiflow → GHL transport |
| What GHL does | Everything | Displays the thread, holds the record, reports |
| What the office changes | Moves scheduling into GHL | **Nothing** |

That last row is the entire sales advantage. "Your front desk keeps working exactly the way they work today" is a much easier close than "first, move your scheduling into our CRM."

---

## The no-show loop, traced

This is built and running today. No GHL involved.

```
Front desk marks no-show in Open Dental / Dentrix
        │
        ▼
pmsSyncCron              hourly at :10  — polls the PMS
        │
        ▼
pmsEventProcessor        sees status === 'no_show'
        │                 → updateAppointmentStatus(id, 'no_show')
        │                 → createNoshowSequence()
        ▼
noshowCron               hourly at :05  — drives the schedule
        │                 → Message 1 at +1h
        │                 → Message 2 at +24h
        │                 → close at +48h
        ▼
sendSMS()  ──►  Twilio today  /  GHL transport later
        │
        ▼
Patient replies → noshowReplyHandler → enters booking at S3_TIME_PREF
        │
        ▼
Patient picks a slot → pmsBookingService → appointment written back to the PMS
```

Relevant code: [pmsEventProcessor.ts:58](../../../src/services/pms/pmsEventProcessor.ts#L58) dispatches on `no_show`, [pmsSyncCron.ts](../../../src/services/pms/pmsSyncCron.ts) polls, [noshowService.ts:21](../../../src/services/noshow/noshowService.ts#L21) creates the sequence.

The processor also **closes** an active no-show sequence when the appointment gets rescheduled ([pmsEventProcessor.ts:337](../../../src/services/pms/pmsEventProcessor.ts#L337)) — so if the front desk rebooks them manually, the chase stops on its own. That's the "sequences must auto-stop" problem, solved at the PMS layer where the truth actually lives, rather than by syncing state into GHL and hoping it's current.

**Nothing in this loop needs GHL.** Adding GHL adds exactly two things: the message goes out through GHL's number instead of Twilio's, and Dentiflow posts the outcome into GHL so it shows up in reporting.

---

## What Dentiflow writes into GHL

GHL is a display and reporting surface. Dentiflow drives it via API. Every one of these is a write *from* Dentiflow — GHL is never asked to figure anything out.

| GHL object | What Dentiflow writes | When |
|---|---|---|
| **Conversation thread** | The outbound message | Every send |
| **Contact custom fields** | `pms_patient_id`, `last_visit_date`, `months_overdue`, `recall_status` | On sync + on state change |
| **Contact tags** | `recall-day0`, `replied`, `booked`, `no-show-chase`, `opted-out` | On state change |
| **Opportunity / pipeline stage** | Stage move — this is what generates client-facing reporting | On state change |
| **Calendar event** | The appointment (double-write alongside the PMS) | On booking |
| **Note** | Audit line — "Booked via AI recall, verified on OD schedule 7/28" | On booking + on verify |
| **DND flag** | Set on opt-out | Immediately, permanently |

### State machine → pipeline stage

Your existing states drive the funnel. No new logic — just an API call on each transition.

| Dentiflow state | GHL pipeline stage |
|---|---|
| Day 0 sent | Contacted |
| Any patient reply | Engaged |
| `S3_TIME_PREF` / `S4` slot selection | Scheduling |
| `S6_COMPLETED` | Booked |
| Confirmed on the PMS schedule | Verified |
| Opted out / declined / exited | Lost |

That's the whole reporting integration. The client opens GHL and sees a funnel that is driven entirely by your state machine, and you didn't build a reporting tool to get it.

---

## The two-tier proof model

This is the answer to "results I can track and prove."

**Tier 1 — GHL: activity and funnel.**
Messages sent, reply rate, engagement, pipeline conversion, conversation history. Live, staff-visible, zero build cost because it falls out of the writes above. This is what the practice looks at day to day.

**Tier 2 — Dentiflow dashboard: verified outcomes.**
Booked appointments confirmed present on the actual PMS schedule, cross-referenced. Revenue attribution. This is the number that closes renewals, and it's the one GHL structurally cannot produce, because GHL only knows what it was told — it can't see the schedule.

The pitch that comes out of this: *"GHL reports what we did. We verify it against your actual schedule."* Every marketing agency can show a dashboard. Almost none can show that the appointments were really there.

Tier 2 is also the group-rollup answer. Multi-location reporting lives here, not in GHL sub-accounts.

---

## What exists vs. what's left

**Already built and working:**
- PMS sync + event processor + no-show dispatch
- No-show sequence engine, recall engine, review sequences
- Reply handler, booking state machine, validator, intent classifier
- Open Dental adapter (verified 2026-07-13)
- `ghlTransport.ts` — outbound send (written, uncommitted, untested)

**Left to build for the GHL layer:**
1. Outbound smoke test — confirm the pipe works
2. Inbound webhook `/webhooks/ghl` + shared routing extraction
3. Transport router inside `sendSMS()`
4. **The GHL write-back calls** — tags, custom fields, pipeline stage moves, notes. This is the reporting integration and it's the piece that makes the whole thing visible to clients.
5. Data mirror — every conversation also lands in Supabase

Item 4 is the one that answers your question, and it's smaller than it looks: a single `updateGhlState()` helper called from the same places the state machine already transitions.

---

## The rule that keeps this clean

**GHL workflows fire webhooks. They never decide anything.**

The moment a GHL workflow contains an if-statement about a patient, you've recreated the course's architecture and inherited its sync problem. Keep every decision in code where it's versioned, testable, and portable — and GHL stays a surface you could swap out, rather than a system you're trapped in.

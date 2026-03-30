# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution

**Layer 3: Execution (Doing the work)**
- TypeScript services in `src/services/`
- Utility scripts in `execution/` (migration runners)
- Environment variables, API tokens stored in `.env`
- Handle API calls, data processing, database interactions
- Reliable, testable, fast

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a new service, check `src/services/` and `execution/` per your directive. Only create new files if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the code and test it again (unless it uses paid tokens/credits — check w user first)
- Update the directive with what you learned (API limits, timing, edge cases)

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations — update the directive. But don't create or overwrite directives without asking unless explicitly told to.

## Self-annealing loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test tool, make sure it works
4. Update directive to include new flow
5. System is now stronger

## File Organization

```
dentiflow/
├── CLAUDE.md
├── .env
├── package.json
│
├── directives/
│   ├── system/                    ← Speed-to-Lead directives
│   │   ├── stl-persona.md
│   │   ├── stl-response-rules.md
│   │   ├── stl-intent-detection.md
│   │   ├── stl-booking-flow.md
│   │   └── stl-escalation.md
│   ├── services/                  ← Dental service knowledge (10 files)
│   ├── recall_v2.md              ← Recall engine specification
│   ├── sms_booking_agent.md      ← SMS booking conversation flow
│   ├── pms_ingest.md             ← Patient data import SOP
│   ├── hygiene_outreach.md       ← Outreach workflow SOP
│   ├── preflight.md              ← System health check SOP
│   ├── onboard_client.md         ← Client onboarding SOP
│   ├── demo_booking_agent.md     ← Demo flow SOP
│   └── USAGE.md                  ← Quick start guide
│
├── src/
│   ├── server.ts                  ← Express server
│   ├── routes/
│   │   ├── smsWebhook.ts         ← Twilio inbound (routes review > noshow > recall > STL)
│   │   ├── formWebhook.ts        ← Web form leads
│   │   ├── missedCallWebhook.ts  ← Missed call leads
│   │   ├── recallRoutes.ts       ← Recall API endpoints
│   │   ├── noshowRoutes.ts       ← No-Show Recovery API endpoints
│   │   └── pmsWebhookRoutes.ts   ← PMS appointment status webhooks
│   ├── services/
│   │   ├── orchestration/         ← Speed-to-Lead pipeline
│   │   │   └── stlOrchestrator.ts
│   │   ├── execution/             ← Shared execution services
│   │   │   ├── smsService.ts      ← Twilio SMS (shared by STL + recall)
│   │   │   ├── responseValidator.ts ← 3-layer validator (shared)
│   │   │   ├── aiClient.ts
│   │   │   ├── staffNotifier.ts
│   │   │   ├── metricsTracker.ts
│   │   │   ├── conversationStore.ts
│   │   │   └── patientManager.ts
│   │   ├── recall/                ← Recall engine services
│   │   │   ├── csvParser.ts       ← PMS CSV parser (auto-header detection)
│   │   │   ├── ingestAgent.ts
│   │   │   ├── outreachEngine.ts
│   │   │   ├── recallCron.ts      ← Hourly cron for Day 1/3/exit
│   │   │   ├── sequenceOrchestrator.ts
│   │   │   ├── replyHandler.ts    ← + emergency staff notifications
│   │   │   ├── bookingStateMachine.ts
│   │   │   ├── intentClassifier.ts
│   │   │   ├── slotSelector.ts
│   │   │   ├── templates.ts
│   │   │   └── voiceAssignment.ts
│   │   ├── noshow/                ← No-Show Recovery services
│   │   │   ├── noshowService.ts   ← Create sequence, send messages, find active
│   │   │   ├── noshowReplyHandler.ts ← Reply handling → booking state machine at S3
│   │   │   └── noshowCron.ts      ← Hourly cron for Message 1/2/exit/deferred
│   │   ├── pms/                   ← PMS Integration (Dentrix Ascend, etc.)
│   │   │   ├── adapterRegistry.ts ← Factory: getPmsAdapter(pmsType)
│   │   │   ├── pmsEventProcessor.ts ← Core: idempotency, patient resolve, status dispatch
│   │   │   ├── pmsSyncCron.ts     ← Hourly polling cron (for PMS without webhooks)
│   │   │   └── adapters/
│   │   │       ├── generic.ts     ← Generic webhook adapter (any PMS)
│   │   │       └── dentrixAscend.ts ← Dentrix Ascend status mapping + polling stub
│   │   ├── booking/               ← Booking adapters
│   │   ├── serviceKnowledge.ts
│   │   ├── anchorTemplates.ts
│   │   └── templateFallback.ts
│   ├── types/
│   │   ├── database.ts            ← Supabase types
│   │   ├── recall.ts              ← Recall engine types
│   │   └── pms.ts                 ← PMS integration types
│   └── lib/
│       └── supabase.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_recall_schema.sql
│       ├── 003_patient_location.sql
│       ├── 004_multi_practice_users.sql  ← Multi-practice auth support
│       ├── 005_reviews_referrals.sql     ← Reviews, feedback, referrals tables
│       ├── 006_noshow_recovery.sql       ← No-show sequences table + metrics
│       └── 007_pms_integration.sql      ← PMS integration config + sync log
│
├── dashboard/                     ← React + Tailwind (white-label)
│   └── src/
│       ├── main.tsx               ← Entry point (BrowserRouter + AuthProvider)
│       ├── App.tsx                ← Layout, routing, sidebar with practice switcher
│       ├── contexts/
│       │   └── AuthContext.tsx    ← Multi-practice auth state (user, profiles[], activePracticeId)
│       ├── pages/
│       │   ├── Login.tsx          ← Email/password login (Supabase Auth)
│       │   ├── PracticeSelector.tsx ← Practice picker for multi-practice users
│       │   ├── Dashboard.tsx      ← KPIs, activity feed, response speed
│       │   ├── Leads.tsx          ← Patient leads table
│       │   ├── Conversations.tsx  ← SMS thread interface
│       │   └── Appointments.tsx   ← Appointment schedule
│       ├── hooks/
│       │   ├── useBranding.ts    ← Practice-specific theme/colors
│       │   └── useRealtime.ts    ← Supabase real-time subscriptions
│       ├── components/           ← Shared UI (StatCard, StatusBadge, etc.)
│       ├── types/
│       │   └── branding.ts       ← Branding config types
│       └── lib/
│           └── supabase.ts       ← Supabase client init
│
├── execution/                     ← Migration runner scripts
│   ├── run_migration.mjs
│   ├── run_migration_003.mjs
│   └── verify_migration.mjs
│
├── scripts/                       ← Dev utility scripts (tunnels, diagnostics, imports)
│
├── worker/                        ← Cloudflare Worker (Retell voice agent middleware)
│
└── .tmp/                          ← Temporary/scratch files (gitignored)
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | TypeScript / Node.js (Express) | All server code |
| Database | Supabase (Postgres) | Shared by STL + Recall |
| AI Engine | Claude API | Constrained AI (temp 0.3) for STL |
| SMS | Twilio | Shared by STL + Recall. A2P verification pending |
| Dashboard | React + Tailwind (Vite) | White-label per practice |
| Hosting | Vercel (frontend) + Railway (backend) | |

## Integration Status

| Integration | Status | Notes |
|------------|--------|-------|
| Supabase | Live | Shared database for STL + Recall |
| Supabase Auth | Live | Email/password login, multi-practice user support |
| Twilio SMS | Built, A2P pending | Console.log fallback when SMS_LIVE_MODE=false |
| Claude API | Live | STL responses |
| Dashboard | Live | White-label branding per practice, deployed to Vercel |
| Dentrix Ascend | CSV + webhook built | CSV parser + PMS webhook endpoint (API polling stub until DADP enrollment) |
| PMS Integration | Built | Generic webhook + Dentrix adapter, auto no-show/review triggers |
| Google Sheets | Working | Via gcloud auth + Sheets API v4 for import review sheets |

## Speed-to-Lead Pipeline

```
Inbound (SMS / Web Form / Missed Call)
    → Webhook endpoint
    → Find/create patient in Supabase
    → Match dental service (serviceKnowledge.ts)
    → Generate AI response (Claude API, constrained)
    → Validate response (responseValidator.ts — HIPAA, pricing, length)
    → Send SMS (smsService.ts, 60s cooldown)
    → Notify staff (staffNotifier.ts)
    → Log everything (metricsTracker.ts, conversationStore.ts)
```

## Recall Pipeline

```
Step 1: Import CSV → POST /api/recall/import
    → csvParser.ts: auto-detect headers, parse PMS format, filter scheduled patients
    → ingestAgent.ts: normalize phones, dedupe, assign voice/segment, set location
    → Returns summary — NO texts sent (human review checkpoint)

Step 2: Launch Outreach → POST /api/recall/launch
    → outreachEngine.ts: sends Day 0 SMS to all imported patients
    → Log to conversations + automation_log

Step 3+: Automatic (hourly cron — recallCron.ts)
    → Day 0 + 24h → Send Day 1 SMS (soft CTA)
    → Day 1 + 48h → Send Day 3 SMS (direct CTA, non-responders only)
    → Day 3 + 24h → Auto-exit with no_response
    → Check deferred patients → re-activate if defer_until passed

Patient Reply → POST /webhooks/sms → routing check
    → Active review sequence? → reviewReplyHandler.ts
    → Active noshow sequence? → noshowReplyHandler.ts
    → Active recall sequence? → replyHandler.ts
        → Classify intent (context-aware)
        → Navigate booking state machine (S0→S6)
        → Validate response (shared responseValidator.ts)
        → Emergency → staff notification via staffNotifier.ts
        → Send SMS reply
    → No active sequence? → speed-to-lead pipeline (unchanged)
```

## No-Show Recovery Pipeline

```
Step 1: Mark No-Show → POST /api/noshow/mark (or dashboard button)
    → Update appointment status to 'no_show'
    → Create noshow_sequence (status: message_1_pending)
    → Schedule Message 1 for 1 hour from now

Step 2: Automatic (hourly cron — noshowCron.ts at :05)
    → message_1_pending + next_send_at passed → Send Message 1, status → message_1_sent
    → message_1_sent + 24h + no reply → Send Message 2, status → message_2_sent
    → message_2_sent + 24h + no reply → status → no_response (close sequence)
    → deferred + defer_until passed → Reset to message_1_pending (one more attempt)

Patient Reply → POST /webhooks/sms → noshow routing
    → Enter booking state machine at S3_TIME_PREF (skip opening stages)
    → "not right now" → defer 14 days (not 60 like recall)
    → "cancel" / "not interested" → declined, exit
    → "stop" → opt_out, permanent
    → Concern ("scared", "can't afford") → S7_HANDOFF, staff notification
    → Booking interest → slot selection → confirm → rebooked
```

## PMS Integration Pipeline

```
PMS (Dentrix Ascend / any) sends appointment status change
    ├── Webhook push ──→ POST /webhooks/pms?practiceId=UUID
    │                       ↓
    │                   Verify auth (API key or HMAC-SHA256)
    │                       ↓
    │                   Normalize via PMS adapter (Dentrix/generic)
    │                       ↓
    │                   Idempotency check (pms_sync_log)
    │                       ↓
    │                   Resolve patient (PMS ID → phone → create)
    │                       ↓
    │                   Upsert appointment (booking_platform_id)
    │                       ↓
    │                   Status dispatch:
    │                     "No Show"    → createNoshowSequence() → recovery SMS
    │                     "Complete"   → createReviewSequence() → survey SMS
    │                     "Cancelled"  → update appointment status
    │                     "Rescheduled"→ close any active noshow sequence
    │                     Other        → sync only (appointment status update)
    │
    └── Polling cron (10 * * * *) ──→ for PMS without webhooks
                                        (stub until DADP API access approved)
```

- Auth: per-practice config in `pms_integrations` table (webhook_secret or webhook_api_key)
- Idempotency: `pms_sync_log` table with UNIQUE(practice_id, pms_event_id)
- Patient matching: pms_patient_id → phone → create new
- Dashboard manual buttons remain as fallback (existing dedup prevents double sequences)
- Auto-disable after 10 consecutive webhook errors

## Authentication & Multi-Tenancy

```
Page load → Supabase session check
  ├── No session → /login (all routes redirect)
  └── Session found → fetch user_profiles (all rows for this auth_user_id)
        ├── 1 profile → auto-select practice, show dashboard
        └── N profiles → show PracticeSelector
              └── User picks one → localStorage saves choice → dashboard
                    └── Sidebar shows practice switcher dropdown
```

- **AuthContext** (`dashboard/src/contexts/AuthContext.tsx`) — single source of truth for auth state
- **user_profiles** table links `auth.users.id` → `practices.id` (many-to-many via composite unique)
- **RLS** on all 8 tables enforces `practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())`
- **Service role** bypasses RLS for backend operations (webhooks, cron jobs)
- **No self-serve signup** — accounts created manually via Supabase dashboard
- **Practice switching** reloads all data + branding for the selected practice

## Critical Rules

- Emergency intent always overrides all other intents
- "crown came off" → emergency, NOT crown service
- Response validator runs AFTER AI, BEFORE send — catches diagnosis language, HIPAA violations
- Template fallback if Claude API fails — never silence
- SMS_LIVE_MODE=false for dev (console.log instead of Twilio)
- 60-second cooldown per phone number
- One outbound per inbound — no double-sends
- Recall opt-out is permanent — sets recall_opt_out=true on patient record
- Express body limit is 5mb for CSV imports (`express.json({ limit: '5mb' })`)
- Emergency replies during recall trigger staff SMS notification

## Summary

You sit between human intent (directives) and deterministic execution (TypeScript services). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.

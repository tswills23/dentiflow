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
│   │   ├── smsWebhook.ts         ← Twilio inbound (routes recall vs STL)
│   │   ├── formWebhook.ts        ← Web form leads
│   │   ├── missedCallWebhook.ts  ← Missed call leads
│   │   └── recallRoutes.ts       ← Recall API endpoints
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
│   │   ├── booking/               ← Booking adapters
│   │   ├── serviceKnowledge.ts
│   │   ├── anchorTemplates.ts
│   │   └── templateFallback.ts
│   ├── types/
│   │   ├── database.ts            ← Supabase types
│   │   └── recall.ts              ← Recall engine types
│   └── lib/
│       └── supabase.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_recall_schema.sql
│       └── 003_patient_location.sql
│
├── dashboard/                     ← React + Tailwind (white-label)
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
| Twilio SMS | Built, A2P pending | Console.log fallback when SMS_LIVE_MODE=false |
| Claude API | Live | STL responses |
| Dashboard | Live | White-label branding per practice |
| Dentrix Ascend | CSV import working | PMS CSV parser handles real exports (auto-header, combined names, locations) |
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
    → Active recall sequence? → replyHandler.ts
        → Classify intent (context-aware)
        → Navigate booking state machine (S0→S6)
        → Validate response (shared responseValidator.ts)
        → Emergency → staff notification via staffNotifier.ts
        → Send SMS reply
    → No active sequence? → speed-to-lead pipeline (unchanged)
```

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

# DentiFlow Directory Structure

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
│   │   ├── reviews/               ← Review & referral services
│   │   ├── booking/               ← Booking adapters
│   │   ├── serviceKnowledge.ts
│   │   ├── anchorTemplates.ts
│   │   └── templateFallback.ts
│   ├── types/
│   │   ├── database.ts            ← Re-exports Database from supabase.ts + custom interfaces
│   │   ├── supabase.ts            ← Auto-generated (npx supabase gen types) — DO NOT EDIT
│   │   ├── recall.ts              ← Recall engine types
│   │   ├── pms.ts                 ← PMS integration types
│   │   └── review.ts              ← Review/referral types
│   └── lib/
│       └── supabase.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql       ← 7 tables, indexes, RLS, triggers, seed
│       ├── 002_recall_schema.sql        ← Recall sequences, automation_log, metrics
│       ├── 003_patient_location.sql     ← location column on patients
│       ├── 004_multi_practice_users.sql ← Multi-practice auth
│       ├── 005_reviews_referrals.sql    ← Reviews, feedback, referrals tables
│       ├── 006_noshow_recovery.sql      ← No-show sequences + metrics
│       ├── 007_pms_integration.sql      ← PMS config + sync log
│       └── 008_booking_link_tracking.sql← Booking link tokens + click metrics
│
├── dashboard/                     ← React + Tailwind (white-label)
│   └── src/
│       ├── main.tsx               ← Entry point
│       ├── App.tsx                ← Layout, routing, sidebar
│       ├── contexts/AuthContext.tsx ← Multi-practice auth state
│       ├── pages/                 ← Dashboard, Leads, Conversations, Appointments, Reviews
│       ├── hooks/                 ← useBranding, useRealtime
│       └── lib/supabase.ts
│
├── execution/                     ← Migration runner scripts
├── scripts/                       ← Dev utility scripts
├── worker/                        ← Cloudflare Worker (Retell voice agent)
└── .tmp/                          ← Temporary/scratch files (gitignored)
```

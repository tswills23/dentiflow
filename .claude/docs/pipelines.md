# DentiFlow Pipeline Reference

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

Step 2: Launch Outreach → recall-launch.ts --location "<name>" --confirm
    → Activates paused sequences for that location only
    → Prompts "Send N SMS now? (y/N)" — manual approval required
    → On y: runDay0Outreach(practiceId, { location }) — scoped to that location via patients!inner join
    → Log to conversations + automation_log
    NOTE: --location is required and scopes BOTH activation AND the send query.
          Cross-location sends are not possible — the query joins patients and filters by location.

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
- Dashboard manual buttons remain as fallback
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

- **AuthContext** (`dashboard/src/contexts/AuthContext.tsx`) — single source of truth
- **user_profiles** links `auth.users.id` → `practices.id` (many-to-many via composite unique)
- **RLS** on all 8 tables: `practice_id IN (SELECT practice_id FROM user_profiles WHERE auth_user_id = auth.uid())`
- **Service role** bypasses RLS for backend (webhooks, cron)
- **No self-serve signup** — accounts created manually

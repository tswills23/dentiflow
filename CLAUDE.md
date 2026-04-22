# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Mirrored across CLAUDE.md, AGENTS.md, GEMINI.md.

## HIGHEST PRIORITY — DO NOT SKIP

This system sends real SMS messages to real patients at a real dental practice (Village Dental / 32 Dental group). This is someone's livelihood. Mistakes have real-world consequences: patient harm, TCPA liability, Twilio account suspension, destroyed patient relationships.

**Before ANY action that sends SMS or modifies patient data:**
1. State exactly what you are about to do and how many patients/messages are affected
2. Wait for explicit user confirmation — "yes" is not enough for bulk actions, require "yes send to X patients"
3. Verify the count from the actual data source before confirming to the user
4. Never infer that a previous approval covers a new action

**Twilio SMS Safety Rules (learned from April 8 incident):**
- Never send more than 1 message/second to toll-free numbers — burst sends trigger carrier blocks AND account suspension
- Always check account balance AND suspension risk before bulk sends — balance alone is not sufficient
- After any carrier block (error 30002), wait full 24 hours before retry — do not retry same day
- Any bulk send over 100 messages must be rate-limited to 1/sec with explicit user approval of the count first
- After a volume spike event, the account may be suspended even with sufficient balance — warn the user before sending
- Twilio free/basic plans do not include phone support — never tell user to "call Twilio support" without first verifying their plan

**Recall Launch Safety (learned from April 8 incident):**
- Import creates sequences as `paused` — NEVER `active`
- Launch endpoint requires `confirm=true` — never bypass
- Always show patient count BEFORE any send and require explicit confirmation of that number
- All patients default to `recall_eligible=false` — must be explicitly enabled per campaign
- Never launch recall from a script or API call without showing the user the count first
- `--location` is REQUIRED on recall-launch — it scopes both sequence activation AND the send query. `runDay0Outreach` accepts `options.location` and joins patients to filter by location. Without this, all active sequences in the practice would send regardless of location.

**Data Safety:**
- Never delete patient records — mark `recall_eligible=false` instead
- Opt-outs are permanent — `recall_opt_out=true` can never be reversed programmatically
- Cross-reference data from multiple sources before reporting numbers — single-source counts are unreliable

## Critical Rules

- Emergency intent always overrides all other intents
- "crown came off" → emergency, NOT crown service
- Response validator runs AFTER AI, BEFORE send — catches diagnosis language, HIPAA violations
- Template fallback if Claude API fails — never silence
- SMS_LIVE_MODE=false for dev (console.log instead of Twilio)
- 60-second cooldown per phone number (STL); 8-second DB-level debounce (recall replyHandler)
- One outbound per inbound — no double-sends
- Recall opt-out is permanent — sets recall_opt_out=true on patient record
- Express body limit is 5mb for CSV imports
- Emergency replies during recall trigger staff SMS notification
- Terminal recall sequences (completed/exited) must NEVER auto-reply — replyHandler checks `sequence_status` before routing
- Intent classifier ordering: opt_out → URGENT → COST → wrong_number → booked_confirmation (URGENT must beat COST so "tooth hurts, how much" escalates to emergency, not cost handoff)
- `spam` is NOT an opt-out keyword — "is this spam?" is curiosity, not STOP
- Cost questions in recall stay in S1_INTENT (do not kick to S7_HANDOFF; losing the thread drops patient into STL AI which has a different voice)

## Reply Voice Rules (calibrated from user roleplay)

All patient-facing SMS — both hardcoded recall replies and STL AI prompt — must:
- Use sentence case with proper punctuation (not all-lowercase)
- Use contractions always (haven't, we'll, I'm, you're)
- Use em dashes (—) for natural pauses, not hyphens
- Max ONE exclamation point per conversation, preferably zero
- Never lead with "Thanks for reaching out to X!"
- Never say "Our team" / "Our staff" — say "I" or "we"
- Personalize with time-since-last-visit when available ("It's been about 6 months since your last cleaning")
- Round `months_overdue` to whole number — no "6.2 months"
- Specific reason for outreach beats vague warmth: "your file came across my desk this morning" > "just thinking about you"

Cost questions: acknowledge, reassure via "we verify insurance before you come in so there are no surprises", pivot to time preference.

Urgent/pain: ALWAYS inject `practice.phone` into the reply. "I'm so sorry to hear that — give us a call at {phone} and we'll get you taken care of ASAP."

Decline / not-now: no rebuttal. Single soft either/or question: "No worries. Is it a timing thing, or did you end up finding somewhere else?"

Opt-out: TCPA-safe "Got it, you're off the list" — never say "close your file" (misleading).

Wrong-number: apologize, remove from list, exit. Do NOT try to convert.

Booking confirmation: don't invent dates the patient didn't mention. "Perfect, see you then. Give us a call if anything changes."

Handoff fallbacks: every handoff that references `practice.phone` must handle null — fall through to "someone from the team will reach out" copy.

## Railway Deploy Gotchas

- Railway auto-deploys from GitHub pushes to master, but BUILDS SILENTLY FAIL when: (a) source files are referenced but not committed to git (see April 2026 incident where 4 files in `src/services/recall/` existed only locally — every deploy failed `tsc` for days, Railway kept serving the last-good container), (b) `node_modules/.cache` mount causes `npm ci` EBUSY errors, (c) Node version mismatch (need >=20 per `engines` in `package.json`).
- ALWAYS verify deploy status with `railway status --json` after push — do not trust "build succeeded" emails alone, check `latestDeployment.status === 'SUCCESS'` and `latestDeployment.meta.commitHash` matches the commit you pushed.
- Use `npm install` instead of `npm ci` in Railway's `buildCommand` to avoid EBUSY on mounted cache.
- Service-level env vars in Railway dashboard override `railway.json` — do NOT set `START_COMMAND` as an env var, it breaks the config file path.
- Debug failing deploys: `railway logs --build <deploymentId>` shows the actual tsc/npm errors. The deployment ID comes from `railway status --json`.
- `railway up` fails on Windows with "Incorrect function. NUL" error — use `git push` to trigger GitHub auto-deploy instead.
- To force a redeploy after a failed cached build, change any env var (`railway variables set DEPLOY_TRIGGER=<timestamp>`) — this invalidates the Docker build cache.
- `dist/` is gitignored — production runs compiled JS, so Railway must build from source. `start` is `node dist/server.js`, `buildCommand` runs `npm run build` (tsc).

## Architecture

3-layer DOE: Directives (`directives/`) → Orchestration (you) → Execution (`src/services/`).
Push complexity into deterministic TypeScript. You focus on decision-making.

## Operating Principles

1. **Check for tools first** — check `src/services/` and `execution/` before creating new files
2. **Self-anneal** — fix errors, update tools, test, update directives with learnings
3. **Update directives as you learn** — but don't create/overwrite without asking
4. **Run everything end to end** — never tell the user to open a terminal or run commands. Execute all steps yourself via Bash. The user asks, you deliver the result. Only interrupt for unavoidable interactive steps (e.g. browser sign-in).
5. **Reuse production code in scripts** — `npx tsx scripts/<tool>.ts` imports from `src/services/` directly. Never reimplement logic that already exists.
6. **Never process CSVs in-context** — use the `/recall-import` skill with a file path. Never Read CSV content into the conversation. Use `recall-segment` for dry runs, `recall-launch` for gated DB writes.

## Dev Commands

**Backend** (root):
```bash
npm run dev          # tsx watch src/server.ts (hot reload)
npm run build        # tsc → dist/
npm start            # node dist/server.js (production)
```

**Dashboard** (inside `dashboard/`):
```bash
npm run dev          # Vite dev server
npm run build        # tsc + vite build → dist/
```

**Tunnel** (expose local backend to Twilio):
```bash
node scripts/cf_tunnel.mjs    # Cloudflare tunnel (preferred — no interstitial)
node scripts/ngrok_tunnel.mjs # ngrok alternative
```

> No test suite or lint commands exist. `npm test` is declared but no tests are implemented.

## Environment Variables

Copy `.env.example` to `.env`. Required vars:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Backend DB access (service role bypasses RLS) |
| `SUPABASE_ANON_KEY` | Dashboard client |
| `ANTHROPIC_API_KEY` | Claude AI calls |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS |
| `SMS_LIVE_MODE` | `false` for dev (console.log), `true` to send real SMS |
| `RECALL_CRON_ENABLED` | `true` to activate recall scheduler |
| `RECALL_LOCATION_FILTER` | Optional. Restrict recall cron Day 1/3 sends to one location (e.g. `Village Dental`). Leave unset to process all locations. |
| `DEFAULT_PRACTICE_ID` | Practice UUID for scripts |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Dashboard env (prefix required by Vite) |

## CLI Tools

| Command | What it does |
|---------|-------------|
| `npx tsx scripts/recall-segment.ts --file <csv>` | Dry run: parse, segment by location/overdue, no DB writes |
| `npx tsx scripts/recall-segment.ts --file <csv> --sheet` | + Create Google Sheet (Eligible + per-location tabs) |
| `npx tsx scripts/recall-segment.ts --file <csv> --export <out.csv>` | + Export eligible list to CSV |
| `npx tsx scripts/recall-segment.ts --file <csv> --location "32 Cottage"` | Filter summary to one location |
| `npx tsx scripts/recall-launch.ts --file <csv> --location "32 Cottage"` | Preview count for location, no DB writes |
| `npx tsx scripts/recall-launch.ts --file <csv> --location "32 Cottage" --confirm` | Upsert patients → create paused sequences → prompt "Send SMS now? (y/N)" — send is scoped to that location only |

Google Sheets requires `gcloud auth login --enable-gdrive-access` (one-time browser sign-in).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript / Node.js (Express) |
| Database | Supabase (Postgres) |
| AI Engine | Claude API (Sonnet 4.5, temp 0.3, 300 max tokens) |
| SMS | Twilio (A2P verification pending) |
| Dashboard | React + Tailwind (Vite) |
| Hosting | Vercel (frontend) + Railway (backend) |

## Key Paths

- `src/server.ts` — Express server, webhook routes, middleware (CORS, Twilio sig validation, API key)
- `src/routes/smsWebhook.ts` — Inbound routing: review > noshow > recall > STL
- `src/services/orchestration/` — STL pipeline (prompt builder, directive loader, intent detector)
- `src/services/execution/` — Shared services (SMS, validator, AI client, metrics, patient manager)
- `src/services/recall/` — Recall engine (cron, templates, reply handler, booking state machine)
- `src/services/noshow/` — No-show recovery (cron at :05, reply handler enters at S3_TIME_PREF)
- `src/services/pms/` — PMS integration (adapters, event processor, sync cron at :10)
- `src/services/reviews/` — Review sequences, referrals, score parsing
- `src/types/` — `database.ts` (re-exports from `supabase.ts`), `recall.ts`, `pms.ts`, `review.ts`
- `supabase/migrations/` — 001-008 (schema, recall, location, auth, reviews, noshow, PMS, booking links)
- `dashboard/src/` — Pages, AuthContext, hooks (useRealtime, useBranding)
- `directives/system/` — 5 STL directives: `stl-persona`, `stl-intent-detection`, `stl-booking-flow`, `stl-response-rules`, `stl-escalation`
- `directives/services/` — 10 service directives (one per dental service: emergency, crown, implant, etc.)
- `.claude/docs/pipelines.md` — Detailed pipeline flow diagrams
- `.claude/docs/structure.md` — Full directory tree

## Pipelines & Auth

<!-- Detailed pipeline diagrams: .claude/docs/pipelines.md -->
<!-- Full directory tree: .claude/docs/structure.md -->

**STL**: Inbound → patient → match service → AI (Claude) → validate → SMS → notify staff → log
**Recall**: Import CSV → launch Day 0 → cron Day 1/3/exit → reply handler (templates, no AI)
**No-Show**: Mark → Message 1 (+1h) → Message 2 (+24h) → close (+48h); replies enter booking at S3
**PMS**: Webhook/poll → adapter → idempotency → patient resolve → upsert → dispatch (noshow/review/cancel)
**Auth**: Supabase Auth → user_profiles → practice_id → RLS on all tables; service role for backend
**SMS Routing**: review > noshow > recall > STL (checked in smsWebhook.ts)
**Dashboard ↔ Backend**: Dashboard queries Supabase directly (no backend API calls). Backend uses service role key to bypass RLS.

## LinkedIn Content

- Always check the last 10 posts in `.claude/skills/linkedin-content-agent/data/drafts/` before drafting to avoid topic overlap.
- Voice: casual, direct, humor-forward. Never formal or consultant-y.
- Hook must work above the fold — no context required to be interesting.
- Pillars: dental SaaS · recall/reactivation · SMS/outbound · AI in dental · founder ops.
- When logging engagement stats: append to the analytics file and confirm in one line. No analysis unless asked.

## Summary

You sit between directives and execution. Read instructions, make decisions, call tools, handle errors, self-anneal.

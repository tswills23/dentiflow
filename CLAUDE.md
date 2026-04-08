# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Mirrored across CLAUDE.md, AGENTS.md, GEMINI.md.

## Critical Rules

- Emergency intent always overrides all other intents
- "crown came off" → emergency, NOT crown service
- Response validator runs AFTER AI, BEFORE send — catches diagnosis language, HIPAA violations
- Template fallback if Claude API fails — never silence
- SMS_LIVE_MODE=false for dev (console.log instead of Twilio)
- 60-second cooldown per phone number
- One outbound per inbound — no double-sends
- Recall opt-out is permanent — sets recall_opt_out=true on patient record
- Express body limit is 5mb for CSV imports
- Emergency replies during recall trigger staff SMS notification

## Architecture

3-layer DOE: Directives (`directives/`) → Orchestration (you) → Execution (`src/services/`).
Push complexity into deterministic TypeScript. You focus on decision-making.

## Operating Principles

1. **Check for tools first** — check `src/services/` and `execution/` before creating new files
2. **Self-anneal** — fix errors, update tools, test, update directives with learnings
3. **Update directives as you learn** — but don't create/overwrite without asking
4. **Run everything end to end** — never tell the user to open a terminal or run commands. Execute all steps yourself via Bash. The user asks, you deliver the result. Only interrupt for unavoidable interactive steps (e.g. browser sign-in).
5. **Reuse production code in scripts** — `npx tsx scripts/<tool>.ts` imports from `src/services/` directly. Never reimplement logic that already exists.
6. **Never process CSVs in-context** — use the `/recall-import` skill with a file path. Never Read CSV content into the conversation.

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
| `DEFAULT_PRACTICE_ID` | Practice UUID for scripts |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Dashboard env (prefix required by Vite) |

## CLI Tools

| Command | What it does |
|---------|-------------|
| `npx tsx scripts/recall-import.ts --file <csv>` | Dry run: parse, eligibility, voice tiers, summary |
| `npx tsx scripts/recall-import.ts --file <csv> --sheet` | + Create Google Sheet (Eligible + per-location tabs) |
| `npx tsx scripts/recall-import.ts --file <csv> --export <out.csv>` | + Export eligible list to CSV |
| `npx tsx scripts/recall-import.ts --file <csv> --import` | + Write eligible patients to Supabase |

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

# Setting Up DentiFlow on Another Machine

Step-by-step guide to clone, configure, and verify the project on a new machine. Targets ~10-15 min from clone to working `npm run build`.

---

## Prerequisites

Install these first if missing:

| Tool | Check command | Install |
|---|---|---|
| Git | `git --version` | https://git-scm.com/downloads |
| Node 20+ | `node --version` | https://nodejs.org or use [nvm](https://github.com/nvm-sh/nvm) / [fnm](https://github.com/Schniz/fnm) |
| Railway CLI (optional) | `railway --version` | `npm install -g @railway/cli` |
| Supabase CLI (optional) | `supabase --version` | `npm install -g supabase` |

The repo's `.node-version` file pins to Node 20. If you have nvm/fnm, run `nvm use` (or `fnm use`) inside the repo to auto-switch.

---

## Step 1 — Clone

```bash
git clone https://github.com/tswills23/dentiflow.git
cd dentiflow
```

---

## Step 2 — Install dependencies

```bash
npm install
```

Should complete in 1-2 minutes. Some warnings about deprecated transitive deps are expected — ignore them.

If you also want the dashboard:
```bash
cd dashboard && npm install && cd ..
```

---

## Step 3 — Set up `.env`

The `.env` file is gitignored (it has secrets). You need to recreate it on the new machine.

### Option A — Pull from Railway (recommended)

```bash
railway login
railway link
# Select: zonal-achievement → production → dentiflow

railway variables
```

That prints all production env vars. Build a `.env` from those values. Required keys:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SMS_LIVE_MODE=false
RECALL_CRON_ENABLED=false
REVIEW_CRON_ENABLED=false
NOSHOW_CRON_ENABLED=false
TEST_MODE_ALLOWED_PHONE=+16306400029,+16307476875
DEFAULT_PRACTICE_ID=a3f04cf9-54aa-4bd6-939a-d0417c42d941
BACKEND_URL=https://dentiflow-production.up.railway.app
```

Set `SMS_LIVE_MODE=false` for local dev (sends to console instead of Twilio).

### Option B — Copy `.env` from your other machine

USB drive, secure note in a password manager, or AirDrop. The file lives at the repo root: `<repo>/.env`.

---

## Step 4 — Verify the build

```bash
npm run build
```

Should finish with zero output — TypeScript compiles cleanly. If you see any errors, something didn't pull correctly. Re-run `git status` and `git log --oneline -1` to confirm you're on the latest commit.

---

## Step 5 — Verify everything that should be there

### Recall LLM rollout files (from 2026-04-28)

These should all exist:

```bash
ls src/services/recall/recallReplyAI.ts \
   src/services/recall/recallReplyAudit.ts \
   src/services/recall/recallReplyMonitor.ts \
   src/services/execution/aiClientJSON.ts \
   scripts/test-recall-replies.ts \
   scripts/replay-recall-reply.ts \
   directives/recall_reply_examples.md \
   docs/runbook-recall-llm.md \
   supabase/migrations/009_recall_reply_audit.sql \
   supabase/migrations/010_recall_llm_safety.sql
```

If any file errors with "No such file", the pull was incomplete.

### Latest commit

```bash
git log --oneline -1
```

Should match the latest commit on GitHub. As of this writing it's `bd4476c chore: sync working tree to GitHub for cross-machine access`.

### Working tree clean

```bash
git status
```

Should say `nothing to commit, working tree clean`.

---

## Step 6 — Run the eval (optional — costs ~$0.18)

This confirms code AND config AND Anthropic API access all work end-to-end:

```bash
npx tsx scripts/test-recall-replies.ts
```

Expected output: `12/12 passed, 0 failed` with p50 latency ~3-4s.

---

## Step 7 — Start dev server (optional)

```bash
npm run dev    # backend with hot reload
```

In another terminal for the dashboard:
```bash
cd dashboard && npm run dev
```

Backend listens on port 3000. Dashboard on http://localhost:5173.

---

## Quick verification prompt for Claude Code

If you have Claude Code installed on the new machine, paste this to get an automated check:

```
I just cloned this repo on a new machine. Confirm everything came over correctly:

1. Show me the latest commit hash and message
2. Run `git status` to confirm working tree is clean
3. Verify these recall LLM rollout files exist:
   - src/services/recall/recallReplyAI.ts
   - src/services/recall/recallReplyAudit.ts
   - src/services/recall/recallReplyMonitor.ts
   - src/services/execution/aiClientJSON.ts
   - scripts/test-recall-replies.ts
   - scripts/replay-recall-reply.ts
   - directives/recall_reply_examples.md
   - docs/runbook-recall-llm.md
   - supabase/migrations/009_recall_reply_audit.sql
   - supabase/migrations/010_recall_llm_safety.sql
4. Run `npm run build` and confirm it compiles with zero errors
5. Read CLAUDE.md and confirm the "Recall LLM Reply Path" section is present
6. Confirm I have a .env file with SUPABASE_URL, ANTHROPIC_API_KEY, and TWILIO_ACCOUNT_SID set

Report each check as PASS or FAIL. Don't run the eval suite (it costs money). Tell me the full SHA from `git rev-parse HEAD` so I can compare against my other machine.
```

---

## Common gotchas

| Symptom | Fix |
|---|---|
| `npm install` errors with EBUSY on Windows | Close VS Code / any process holding files, retry |
| `npm run build` fails with "Cannot find module @anthropic-ai/sdk" | Re-run `npm install` |
| `npx tsx scripts/test-recall-replies.ts` fails with "Missing SUPABASE_URL" | `.env` not set up — see Step 3 |
| Eval suite fails with "Practice not found" | Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` point at the production project (`gqktxicuxzgfzvelajzw`) |
| `railway link` doesn't show the project | Make sure you're logged in with the same account: `railway whoami` |
| Eval times out repeatedly | Anthropic API may be slow — re-run. Single retries are normal. |

---

## What's NOT in the repo (and why)

These are intentionally gitignored or excluded:

- `.env` — secrets
- `node_modules/` — install with `npm install`
- `dist/` — build output, generated by `npm run build`
- `callrail-puller/recordings/` — patient call audio + transcripts (PHI)
- `*.csv` — patient data exports
- `supabase/.temp/` — CLI cache
- `.claude/scheduled_tasks.lock` — runtime lock

You'll need to re-pull/re-generate these on the new machine if you need them.

---

## Sync workflow (going forward)

After pulling on the new machine, your typical flow is:

```bash
# Pull latest from GitHub before starting work
git pull

# Make changes, commit, push
git add <files>
git commit -m "..."
git push

# On other machine, pull the changes
git pull
```

Both machines should always see `git status` as clean before switching between them.

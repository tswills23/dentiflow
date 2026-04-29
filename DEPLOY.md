# DentiFlow — Railway Deployment Guide

## What Gets Deployed
A single Express server (`src/server.ts`) running 24/7 with:
- 4 hourly crons (recall :00, noshow :05, review :05, PMS sync :10)
- Inbound SMS webhook (Twilio)
- PMS webhook (Dentrix)
- Admin API routes (recall import/launch, noshow, appointments)
- Booking link redirects + referral pages

## Prerequisites
- Railway account (railway.com)
- GitHub repo with this code pushed
- Twilio, Supabase, Anthropic credentials from `.env`

## Deploy Steps

### 1. Verify build locally
```bash
npm run build   # tsc → dist/
npm start       # node dist/server.js — confirm it boots
```

### 2. Connect Railway to GitHub
1. Go to railway.com → New Project → Deploy from GitHub
2. Select the repo — Railway auto-detects Node.js + `railway.json`
3. It will run `npm ci && npm run build`, then `npm start`

### 3. Set environment variables
In Railway dashboard → Variables tab, add:

```
# Supabase
SUPABASE_URL=https://gqktxicuxzgfzvelajzw.supabase.co
SUPABASE_ANON_KEY=<from .env>
SUPABASE_SERVICE_ROLE_KEY=<from .env>

# Anthropic
ANTHROPIC_API_KEY=<from .env>

# Twilio
TWILIO_ACCOUNT_SID=<from .env>
TWILIO_AUTH_TOKEN=<from .env>

# Production flags
SMS_LIVE_MODE=true
ADMIN_API_KEY=<generate a strong random key>
BACKEND_URL=https://<your-app>.railway.app
```

**Do NOT set PORT** — Railway assigns it automatically.

### 4. Update Twilio webhook URL
After deploy, Railway gives a URL like `https://dentiflow-stl-production.up.railway.app`.

Update Messaging Service `MGbaf27c37d80f0b60e749699f45e8908d`:
- Twilio Console → Messaging → Services → Integration → Incoming Messages
- Set webhook URL to: `https://<railway-url>/webhooks/sms`

Also set `BACKEND_URL` env var on Railway to match (for Twilio signature validation).

### 5. Verify
```bash
# Health check
curl https://<railway-url>/health
# → {"status":"ok","service":"dentiflow-stl"}

# Check logs in Railway dashboard for cron output:
# [recallCron] tick — advanced=0, exited=0
# [noshowCron] tick — sent=0, advanced=0
# [reviewCron] tick — surveys=0, reminders=0
# [pmsSyncCron] tick — synced=0

# Send a test SMS to +18333486593 and watch logs
```

## Custom Domain (Optional)
Railway dashboard → Settings → Domains → Add Custom Domain
Add a CNAME record at your DNS provider pointing to Railway.

## Cost Estimate
| Service | Cost |
|---------|------|
| Railway | ~$5-10/mo (usage-based) |
| Supabase | Free tier |
| Twilio | ~$0.0079/SMS |
| Claude API | ~$0.003/STL response |
| Vercel (dashboard) | Free tier |
| **Total** | **~$15-25/mo** |

## Cron Controls
All crons default to enabled. Disable individually via env vars:
```
RECALL_CRON_ENABLED=false
NOSHOW_CRON_ENABLED=false
REVIEW_CRON_ENABLED=false
PMS_SYNC_CRON_ENABLED=false
```

## Troubleshooting
- **SMS not arriving**: Check `BACKEND_URL` matches Railway URL exactly (Twilio sig validation)
- **Crons not firing**: Check logs — they only run if `*_CRON_ENABLED` is not `false`
- **Build fails**: Run `npm run build` locally first to catch TypeScript errors
- **Process crashes**: Railway auto-restarts up to 10 times (configured in `railway.json`)

# DentiFlow Quick Start

## Setup

1. Copy `.env.example` to `.env` and fill in credentials:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
   - `SMS_LIVE_MODE=false` (set to `true` for production)

2. Install dependencies:
   ```bash
   npm install
   cd dashboard && npm install
   ```

3. Run database migrations (if not already done):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_recall_schema.sql`

4. Start the server:
   ```bash
   npm run dev
   ```

5. Verify: `GET http://localhost:3000/health`

## Run a Recall Campaign

1. Export overdue patients from Dentrix Ascend as CSV
2. Upload:
   ```
   POST /api/recall/ingest
   { "practiceId": "<UUID>", "patients": [...] }
   ```
3. Review eligible patients in Supabase or dashboard
4. Trigger outreach:
   ```
   POST /api/recall/outreach
   { "practiceId": "<UUID>" }
   ```
5. Orchestrator runs hourly — sends Day 1, Day 3, handles auto-exits:
   ```
   POST /api/recall/orchestrate
   { "practiceId": "<UUID>" }
   ```
6. Patient replies handled automatically via Twilio webhook

## Speed-to-Lead

Speed-to-lead runs independently. Inbound leads from:
- SMS: `POST /webhooks/sms`
- Web forms: `POST /webhooks/form`
- Missed calls: `POST /webhooks/missed-call`

AI generates personalized responses within 60 seconds.

## Monitor

- **Dashboard**: `cd dashboard && npm run dev` (local) or deployed URL
- **Supabase**: `recall_sequences` table shows all active sequences
- **Automation log**: `automation_log` table shows every action taken
- **Metrics**: `metrics_daily` table aggregates daily KPIs

## Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| SMS_LIVE_MODE | Send real SMS via Twilio | false |
| SUPABASE_URL | Supabase project URL | — |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key | — |
| ANTHROPIC_API_KEY | Claude API key | — |
| TWILIO_ACCOUNT_SID | Twilio account SID | — |
| TWILIO_AUTH_TOKEN | Twilio auth token | — |
| PORT | Server port | 3000 |

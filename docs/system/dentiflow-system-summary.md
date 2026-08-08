# Source Doc 20: Dentiflow System Summary

## What Dentiflow Is

A complete AI revenue system for PPO dental practices. Six modules that plug revenue leaks across the entire patient lifecycle.

## The 6 Modules

### 1. SMS Recall Recovery (Built, Deploying)

**What it does:** Sends automated SMS sequences to overdue patients to bring them back for hygiene appointments.

**How it works:**
- Import patient list from PMS (Dentrix Ascend CSV, auto-header detection).
- 3-day sequence: Day 0 (warm opener), Day 1 (soft CTA), Day 3 (direct CTA for non-responders).
- AI-powered reply handling with booking state machine (classify intent, navigate to booking).
- Voice assignment: 5 tiers (warm, direct, clinical, urgent, value) matched to patient segment.
- Emergency detection and staff notification.
- HIPAA-compliant response validation.

**Results so far:** 8-12% response rate on first batch. 3,962 patients imported from first practice.

### 2. Speed-to-Lead AI Pipeline (Built)

**What it does:** Responds to new patient inquiries within 60 seconds across all inbound channels.

**How it works:**
- Inbound SMS webhook (Twilio) routes to AI response pipeline.
- Web form webhook captures new patient forms and fires auto-text.
- Missed call webhook detects unanswered calls and sends recovery text.
- Claude API generates constrained, HIPAA-compliant responses (temp 0.3).
- 3-layer response validator: blocked patterns, HIPAA guardrails, length/format checks.
- 60-second cooldown per phone number prevents double-sends.
- Template fallback if AI fails (never silence).

**Key stat:** Responding within 60 seconds increases close rates by 391% (Harvard).

### 3. Reviews + Referrals Automation (Building Now)

**What it does:** Automates post-visit review collection and referral requests.

**How it works:**
- 1-2 hours after visit, automated text asks patient to rate experience (1-5).
- Score 4-5: routes to Google review link.
- Score 1-3: routes to private feedback, staff alerted.
- 24-48 hours after positive review: automated referral request.
- Tracking: who was asked, who reviewed, who referred, conversion rates.

**Expected results:** 15-20 Google reviews/month vs typical 2-3.

### 4. No-Show Recovery Sequences (Building Now)

**What it does:** Multi-touch confirmation sequence before visits + recovery sequence after no-shows.

**How it works:**
- 4-touch confirmation cascade: day of booking, 7 days before, 2 days before, morning of.
- No-confirm escalation: staff alert if no confirmation 24 hours before.
- Post no-show: same-day recovery text, next-day follow-up, Day 3 move to recall.
- Waitlist backfill: empty slots offered to waitlist patients.

**Expected results:** 30-50% reduction in no-show rate.

### 5. AI Voice Receptionist (Building Next)

**What it does:** AI-powered phone answering that handles common patient calls without human involvement.

**How it works:**
- Retell.ai integration via Cloudflare Worker middleware.
- Handles: appointment scheduling, hours/location questions, insurance verification, basic triage.
- Transfers to human staff for complex cases.
- After-hours coverage (the calls that currently go to voicemail).

**Market positioning:** Premium upsell tier. The complete hands-off front desk.

### 6. White-label Analytics Dashboard (Built, Deployed)

**What it does:** Practice owner command center showing performance across all modules.

**How it works:**
- React + Tailwind (Vite), white-labeled per practice.
- Real-time metrics: recall response rates, speed-to-lead times, review velocity, no-show rates.
- Per-location breakdowns for multi-location practices.
- Primary color: #1E40AF (navy blue).

## Tech Stack

- Backend: TypeScript/Node.js (Express)
- Database: Supabase (Postgres)
- AI: Claude API (constrained, temp 0.3)
- SMS: Twilio (A2P pending)
- Voice: Retell.ai (via Cloudflare Worker)
- Frontend: React + Tailwind (Vite)
- Hosting: Vercel (frontend) + Railway (backend)

## Content Angles

- Build in public: share what's being built, architecture decisions, module launches.
- System thinking: how 6 modules work together (each amplifies the others).
- Framework: the complete revenue system architecture.
- Story: the build journey, decisions made, trade-offs chosen.
- Actionable: open-source the thinking, share the architecture so practice owners understand what a real system looks like vs a point solution.

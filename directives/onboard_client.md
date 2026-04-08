# DentiFlow — Client Onboarding Runbook

> Step-by-step guide to onboard a new dental practice.
> Target: under 60 minutes from intake form to "ready to launch."
>
> Split: Client fills out intake (10 min) → You run setup (30 min) → Verify + go live (20 min)

---

## Part 1: Client Intake (What the Practice Gives You)

Collect ALL of this before touching any systems. Every field is required.

### Practice Info

| Field | Example | Notes |
|-------|---------|-------|
| Practice name | Bright Dental | Appears in all patient-facing SMS |
| Owner/lead dentist | Dr. Sarah Williams, DDS | Used in doctor-voice recall templates |
| Lead hygienist | Jessica Martinez, RDH | Used in hygienist-voice recall templates |
| Additional providers | Dr. Tom Lee, DMD; Anna Chen, RDH | Add all — system picks per-patient voice tier |
| Office phone | +13125551234 | Receives staff notifications (emergencies, new leads) |
| Email for dashboard login | sarah@brightdental.com | Supabase Auth account |
| City, State | Chicago, IL | Practice record |
| Timezone | America/Chicago | MUST be IANA format — crons and scheduling depend on this |
| Business hours | Mon-Fri 8am-5pm, Sat 9am-1pm, Sun closed | Per-day open/close times |

### Services & Messaging

| Field | Example | Notes |
|-------|---------|-------|
| Services offered | Cleanings, crowns, implants, root canals, etc. | Controls what the AI discusses |
| Insurance accepted | "Most PPO plans, file claims for you" | AI uses when patients ask |
| New patient special | "$99 exam and X-rays" | AI mentions to new patients |
| Tone preference | "Warm, community feel. Not corporate." | Shapes AI personality |
| Online booking URL | brightdental.com/book | AI directs patients here |
| Booking notes | "Weekend slots book fast — mention if available" | Extra context for AI |

### Reviews & Referrals

| Field | Example | Notes |
|-------|---------|-------|
| Google Review link | g.page/r/CabcdefGHIJKLMN/review | Score 4-5 patients get sent here |
| Referral offer | "A complimentary exam" | What the referred friend gets |
| Referral incentive | "A $100 gift card drawing" | What the referrer gets |

### Branding

| Field | Example | Notes |
|-------|---------|-------|
| Logo (URL or file) | brightdental.com/logo.png | Dashboard sidebar + login page |
| Primary brand color (hex) | #1E40AF | Dashboard accent color |
| Accent color (hex) | #059669 | Secondary color |
| Practice display name | Bright Dental | Shown in dashboard header |
| Login headline | "Welcome to Bright Dental" | Login page text |

### Existing Texting Platform

DentiFlow changes nothing about what the practice already uses. These questions determine which DentiFlow features to enable so there's no overlap or double-texting.

| Question | Example Answer | How It Affects Setup |
|----------|---------------|---------------------|
| What texting platform do you use (if any)? | Weave / RevenueWell / Solutionreach / None | Context — know what we coexist with |
| Does it send automated no-show follow-ups? | Yes / No / Not sure | If **yes** → set `sync_noshow=false` (DentiFlow won't send no-show recovery, their platform handles it) |
| Does it send post-visit review/survey requests? | Yes / No / Not sure | If **yes** → set `sync_complete=false` (DentiFlow won't send review requests, their platform handles it) |
| Does it send anything beyond reminders + confirmations? | "It sends birthday texts and recall reminders too" | Catch any other overlap — if their platform already does recall outreach, discuss scope before launching |

**The rule:** DentiFlow only activates features the practice doesn't already have covered. We add to their stack, never conflict with it.

**Common scenarios:**

| Their Platform Does | DentiFlow Does | DentiFlow Skips |
|--------------------|---------------|----------------|
| Reminders + confirmations only | Recall, no-show recovery, reviews, speed-to-lead | Nothing — full feature set |
| Reminders + no-show follow-ups | Recall, reviews, speed-to-lead | No-show recovery |
| Reminders + review requests | Recall, no-show recovery, speed-to-lead | Reviews |
| Reminders + no-show + reviews | Recall, speed-to-lead | No-show recovery + reviews |
| Nothing (no texting platform) | Everything | Nothing |

**"Not sure" answers:** Default to OFF for that feature. Better to skip than double-text. You can always enable it later once you confirm their platform doesn't cover it.

### PMS & Patient Data

| Field | Example | Notes |
|-------|---------|-------|
| PMS system | Dentrix Ascend | Determines adapter type |
| Location names (if multi-location) | Downtown, Westside, North Shore | Recall segmentation + template personalization |
| Patient recall CSV | Exported from PMS | Overdue patients for recall campaign |

### How to Get the Google Review Link

Most practices don't know where to find this. Tell them:
1. Google your practice name
2. Click "Write a review" on your Google Business listing
3. Copy that URL
4. Or: Google Business Profile → "Ask for reviews" → copy the short link

---

## Part 2: Your Setup (Supabase + Twilio)

### Step 1 — Create Practice Record (Supabase SQL Editor)

> Always use Supabase SQL Editor. Local pooler connections are unreliable.

```sql
INSERT INTO practices (
  name,
  owner_name,
  phone,
  email,
  city,
  state,
  timezone,
  booking_platform,
  booking_url,
  google_review_link,
  brand_voice,
  twilio_phone,
  practice_config,
  business_hours
) VALUES (
  'Bright Dental',
  'Dr. Sarah Williams',
  '+13125551234',
  'sarah@brightdental.com',
  'Chicago',
  'IL',
  'America/Chicago',
  'dentrix_ascend',
  'https://brightdental.com/book',
  'https://g.page/r/CabcdefGHIJKLMN/review',
  'warm_professional',
  NULL,  -- Set after Twilio number purchased in Step 3
  '{
    "services_offered": [
      "hygiene_cleaning", "comprehensive_exam", "filling", "crown",
      "root_canal", "extraction", "whitening", "implant_consult",
      "perio_maintenance", "emergency"
    ],
    "providers": [
      {"name": "Dr. Sarah Williams", "title": "DDS", "specialties": ["general"]},
      {"name": "Jessica Martinez", "title": "RDH", "specialties": ["hygiene_cleaning"]}
    ],
    "tone_notes": "Warm, community feel. Not corporate. Focus on care over sales.",
    "insurance_note": "We accept most PPO plans and file claims for you.",
    "new_patient_special": "$99 exam and X-rays for new patients",
    "booking_notes": "",
    "google_review_url": "https://g.page/r/CabcdefGHIJKLMN/review",
    "referral_offer": "a complimentary exam",
    "referral_incentive": "a $100 gift card drawing",
    "review_survey_delay_hours": 2,
    "branding": {
      "logo_url": "https://brightdental.com/logo.png",
      "primary_color": "#1E40AF",
      "accent_color": "#059669",
      "practice_display_name": "Bright Dental",
      "login_headline": "Welcome to Bright Dental"
    }
  }'::jsonb,
  '{
    "monday":    {"open": "08:00", "close": "17:00"},
    "tuesday":   {"open": "08:00", "close": "17:00"},
    "wednesday": {"open": "08:00", "close": "17:00"},
    "thursday":  {"open": "08:00", "close": "17:00"},
    "friday":    {"open": "08:00", "close": "16:00"},
    "saturday":  null,
    "sunday":    null
  }'::jsonb
)
RETURNING id;
```

**Save the returned UUID** — this is `<PRACTICE_UUID>` for everything else.

### Step 2 — Create Dashboard User

**In Supabase Dashboard:**
1. Authentication → Users → Invite User
2. Email: the login email from intake
3. Set a temporary password
4. Copy the generated `id` UUID → this is `<AUTH_USER_UUID>`

**Link user to practice:**
```sql
INSERT INTO user_profiles (auth_user_id, practice_id, role)
VALUES ('<AUTH_USER_UUID>', '<PRACTICE_UUID>', 'admin');
```

**Multi-practice users** (like yourself): same `auth_user_id`, new row with different `practice_id`. Dashboard shows practice switcher automatically.

**Verify:**
```sql
SELECT up.role, p.name
FROM user_profiles up
JOIN practices p ON p.id = up.practice_id
WHERE up.auth_user_id = '<AUTH_USER_UUID>';
```

### Step 3 — Twilio Phone Number (5 minutes)

You have one Twilio account and one Messaging Service. A2P is already registered. Per new client:

1. **Buy a local number** — Twilio Console → Phone Numbers → Buy a Number → pick one matching practice's area code (~$1.15/mo)
2. **Add to Messaging Service** — Messaging → Services → `MGbaf27c37d80f0b60e749699f45e8908d` → Sender Pool → Add the number
3. **Update practice record:**
```sql
UPDATE practices SET twilio_phone = '+18885551234' WHERE id = '<PRACTICE_UUID>';
```

Done. The Messaging Service webhook is already configured — inbound SMS auto-routes to the correct practice by matching the `To` number against `practices.twilio_phone`.

**If the practice already uses Weave / RevenueWell / Solutionreach:**
- DentiFlow gets its own separate number. Their existing platform stays exactly as-is.
- DentiFlow only activates features their platform doesn't already cover (see intake answers from Part 1).
- Recall patients haven't been in for months — they don't have any practice number saved, so a new number is fine.
- There's almost zero patient overlap between what their platform texts (patients WITH appointments) and what DentiFlow texts (patients WITHOUT appointments, or post-visit sequences if enabled).

### Step 4 — PMS Integration (Default Path)

PMS integration is the default. This is what makes DentiFlow hands-free for the front desk.

**Set `sync_noshow` and `sync_complete` based on intake answers:**

| Their existing platform handles... | sync_noshow | sync_complete |
|------------------------------------|-------------|---------------|
| Nothing (or no platform) | `true` | `true` |
| No-show follow-ups | `false` | `true` |
| Review/survey requests | `true` | `false` |
| Both no-show + reviews | `false` | `false` |
| Not sure | `false` | `false` |

```sql
INSERT INTO pms_integrations (
  practice_id,
  pms_type,
  webhook_api_key,
  sync_noshow,
  sync_complete,
  active
) VALUES (
  '<PRACTICE_UUID>',
  'dentrix_ascend',
  'dk_live_' || gen_random_uuid(),
  true,   -- SET BASED ON TABLE ABOVE
  true,   -- SET BASED ON TABLE ABOVE
  true
)
RETURNING id, webhook_api_key;
```

**Save the `webhook_api_key`.** Give the practice or their PMS vendor:

| Setting | Value |
|---------|-------|
| Webhook URL | `https://your-backend.com/webhooks/pms?practiceId=<PRACTICE_UUID>` |
| Method | POST |
| Auth header | `X-API-Key: <webhook_api_key>` |

**What this automates (when enabled):**

| PMS Event | DentiFlow Action | Controlled By |
|-----------|-----------------|---------------|
| Appointment completed | Survey SMS in 2 hours → Google review link if score 4-5 | `sync_complete` |
| Patient no-show | Recovery SMS in 1 hour → follow-up at 24 hours | `sync_noshow` |
| Cancelled | Updates DB status | Always on |
| Rescheduled | Closes any active no-show sequence | Always on |

Even with `sync_noshow=false` and `sync_complete=false`, the PMS webhook still syncs appointment statuses to the database — it just doesn't trigger outbound SMS sequences. This keeps the dashboard data accurate regardless of which features are active.

**Fallback (if PMS webhook isn't set up yet):** Staff uses Mark No-Show / Mark Complete buttons on Dashboard → Appointments tab. Same automation triggers, just manual instead of automatic. Only relevant if the corresponding sync flag is enabled.

**Note on Dentrix Ascend:** Full API polling requires DADP enrollment + SOC2. Webhook mode works now. Polling is a stub until API access is approved.

**Enabling features later:** If the practice drops Weave or wants to consolidate, just flip the flags:
```sql
UPDATE pms_integrations
SET sync_noshow = true, sync_complete = true
WHERE practice_id = '<PRACTICE_UUID>';
```
Takes effect immediately — no server restart needed.

### Step 5 — Import Patients + Launch Recall

**Import (no texts sent — review checkpoint):**
```
POST /api/recall/import
Content-Type: application/json

{
  "practiceId": "<PRACTICE_UUID>",
  "csv": "<raw CSV content>"
}
```

The parser auto-detects headers. Supports Dentrix format ("Last, First Middle" in a single Patient column), generic format (separate first/last name columns), and everything in between. Patients with an upcoming appointment are auto-skipped.

**What happens on import:**
- Phone numbers normalized to E.164
- Duplicates removed
- Voice tier assigned: <6 months overdue → office, 6-12 months → hygienist, 12+ months → doctor
- Location set from CSV if present
- Recall sequences created as `pending`
- **No texts sent**

**Review the results**, then launch:
```
POST /api/recall/launch
Content-Type: application/json

{ "practiceId": "<PRACTICE_UUID>" }
```

This sends Day 0 messages. After that, the hourly cron handles everything:

| Timing | What Happens |
|--------|-------------|
| Day 0 | You launch this |
| +24h | Cron sends Day 1 (soft CTA) |
| +72h | Cron sends Day 3 (direct CTA, non-responders only) |
| +96h | Cron auto-exits non-responders |
| Deferred | Cron re-activates when defer date passes |

---

## Part 3: Verify & Go Live

### Preflight Checks

| Check | How | Expected |
|-------|-----|----------|
| Server health | `GET /health` | 200 OK |
| Practice has twilio_phone | Query practices table | Not NULL |
| Providers configured | Query practice_config | At least 1 doctor + 1 hygienist |
| Google Review URL set | Query practices table | Not NULL |
| SMS mode | Check `.env` | `SMS_LIVE_MODE=false` for testing |
| Templates valid | `node scripts/verify_templates.mjs` | 45/45 recall + 10/10 no-show |

### Test Sequence

1. **With `SMS_LIVE_MODE=false`** — messages go to console.log:
   - Import 1 test patient → launch → check logs for simulated Day 0 message
   - Send a test inbound SMS via webhook → check logs for AI response
   - Verify staff notification would fire to `practices.phone`

2. **Switch to live** — set `SMS_LIVE_MODE=true`, restart server:
   - Send a real test to your own phone
   - Confirm delivery in Twilio message logs
   - Reply to test the inbound routing (should hit speed-to-lead pipeline)

### Go Live

1. Launch the real recall campaign (`POST /api/recall/launch`)
2. Monitor the Recall tab in the dashboard for delivery status
3. Watch for first inbound replies (auto-handled by booking state machine)

---

## Part 4: Handoff to Practice

### What to Send Them

| Detail | Value |
|--------|-------|
| Dashboard URL | `https://dentiflow-dashboard.vercel.app` |
| Login email | Whatever you set in Step 2 |
| Temporary password | Whatever you set in Step 2 (tell them to change it) |

### What They See

| Tab | What It Shows |
|-----|--------------|
| Dashboard | KPIs, activity feed, response speed |
| Leads | All patients with status |
| Conversations | SMS threads (all patient conversations) |
| Recall | Campaign stats — booking funnel, day progression, voice performance |
| Reviews | Review sequences, scores, Google review sends |
| Appointments | Schedule, Mark No-Show / Complete buttons (fallback if no PMS integration) |

### What They Need to Know

The practice should rarely need to touch the dashboard. With PMS integration active:
- Recall runs on autopilot (cron-driven after you launch)
- No-show recovery triggers automatically from PMS (if enabled)
- Review requests trigger automatically from PMS (if enabled)
- Speed-to-lead handles new inbound inquiries 24/7
- Staff gets SMS notifications for emergencies and new leads

The dashboard is for **monitoring results**, not daily operations.

---

## Part 5: Post-Launch

### Automated Systems Running

| System | Schedule | What It Does |
|--------|----------|-------------|
| Recall cron | Hourly at :00 | Day 1/3/exit progression + deferred re-activation |
| No-show cron | Hourly at :05 | Message 1/2/exit + deferred re-activation (if sync_noshow enabled) |
| Review cron | Hourly | Survey send/reminder/referral timing (if sync_complete enabled) |
| PMS sync cron | Hourly at :10 | Polls PMS for status changes (if webhook unavailable) |

### Inbound SMS Routing Priority

When a patient texts in, checked in this order:
1. Active review sequence? → review reply handler
2. Active no-show sequence? → no-show reply handler (enters booking at stage S3)
3. Active recall sequence? → recall reply handler (full booking state machine)
4. No active sequence? → speed-to-lead AI pipeline

### New Recall Campaigns

Repeat Part 2, Step 5: get a fresh CSV export → import → review → launch.

### Adding Staff Logins

Create new auth user in Supabase + new `user_profiles` row (same practice_id).

### Updating Practice Info

Update the `practices` row directly in SQL Editor. Changes take effect immediately — the AI prompt builder and templates pull from the database at runtime.

---

## Reference: practice_config JSON

```json
{
  "services_offered": ["hygiene_cleaning", "comprehensive_exam", "filling", "crown",
    "root_canal", "extraction", "whitening", "implant_consult",
    "perio_maintenance", "emergency"],

  "providers": [
    {"name": "Dr. Sarah Williams", "title": "DDS", "specialties": ["general"]},
    {"name": "Jessica Martinez", "title": "RDH", "specialties": ["hygiene_cleaning"]}
  ],

  "tone_notes": "Warm, community feel.",
  "insurance_note": "We accept most PPO plans.",
  "new_patient_special": "$99 exam and X-rays",
  "booking_notes": "",

  "pricing_overrides": {
    "dental_implant": {"low": 2000, "high": 5000, "unit": "per implant"}
  },

  "google_review_url": "https://g.page/r/.../review",
  "referral_offer": "a complimentary exam",
  "referral_incentive": "a $100 gift card drawing",
  "review_survey_delay_hours": 2,

  "branding": {
    "logo_url": "https://...",
    "primary_color": "#1E40AF",
    "accent_color": "#059669",
    "sidebar_bg": "#151A1F",
    "sidebar_text": "#E8ECF0",
    "practice_display_name": "Bright Dental",
    "login_headline": "Welcome to Bright Dental"
  }
}
```

### Provider Title Matching

The system uses these patterns to find doctor/hygienist names for templates:
- Doctor: title matches `/dentist|doctor|dds|dmd/i` → fallback: `practices.owner_name`
- Hygienist: title matches `/hygienist|rdh/i` → fallback: `"your hygiene team"`

### business_hours JSON

```json
{
  "monday":    {"open": "08:00", "close": "17:00"},
  "tuesday":   {"open": "08:00", "close": "17:00"},
  "wednesday": {"open": "08:00", "close": "17:00"},
  "thursday":  {"open": "08:00", "close": "17:00"},
  "friday":    {"open": "08:00", "close": "16:00"},
  "saturday":  null,
  "sunday":    null
}
```

24-hour format. `null` = closed.

---

## Gotchas

1. **Twilio Messaging Service overrides phone number webhook.** The inbound URL must be set on the Messaging Service, not the individual phone number. If inbound SMS isn't hitting your webhook, this is why.

2. **Use Supabase SQL Editor for all setup.** Local pooler connections drop randomly.

3. **Supabase query limit is 1000 rows.** Use `count: 'exact', head: true` for accurate counts on large tables.

4. **Express body limit is 5mb.** Already configured — large CSVs are fine.

5. **Timezone must be IANA format.** `America/Chicago`, not `CST` or `-06:00`.

6. **Missing user_profiles row = ghost user.** They can log in but see zero data (RLS blocks everything).

7. **Missing providers = generic templates.** Doctor voice says "your dentist" instead of "Dr. Williams." Always configure providers.

8. **No Google Review URL = review sequences dead-end.** Score 4-5 patients won't get a review link.

9. **Recall opt-out is permanent.** Patient texts STOP → `recall_opt_out=true`. They never get another recall message. This is by design (compliance).

10. **Staff notifications go to `practices.phone`.** Currently single-recipient. If the practice wants notifications to a different number, update this field.

11. **Use Cloudflare tunnel for local testing** (`node scripts/cf_tunnel.mjs`). Localtunnel has interstitial pages that block Twilio webhooks.

12. **Phone numbers must be E.164 format** (`+1XXXXXXXXXX`) in both the database and CSV imports. The parser normalizes CSV phones automatically.

13. **When in doubt, turn the feature OFF.** If the practice says "not sure" whether Weave handles no-show follow-ups, set `sync_noshow=false`. Double-texting is worse than missing a feature. You can always flip it on later with a single SQL update.

14. **Recall is always safe to enable.** No existing platform (Weave, RevenueWell, etc.) does what DentiFlow's recall engine does — multi-voice, multi-day, conversational booking from a recall list. There's no overlap risk here. Recall + speed-to-lead are always ON regardless of what else the practice uses.

---

## Checklist

### Client Intake
- [ ] All practice info collected (see Part 1 table)
- [ ] All services/messaging info collected
- [ ] All reviews/referrals info collected
- [ ] All branding info collected
- [ ] Existing texting platform questions answered (no-show, reviews, other overlaps)
- [ ] Patient recall CSV received

### Database Setup
- [ ] Practice row created (save UUID)
- [ ] Auth user created in Supabase Auth
- [ ] user_profiles row links user to practice
- [ ] Verified: user can log in and see dashboard

### Twilio
- [ ] Local phone number purchased
- [ ] Number added to Messaging Service sender pool
- [ ] Practice record updated with twilio_phone

### PMS Integration
- [ ] pms_integrations row created with correct sync flags (based on existing platform answers)
- [ ] Webhook URL + API key shared with practice/vendor
- [ ] (Or) Practice trained on manual Mark No-Show / Complete buttons as fallback
- [ ] Confirmed: no double-texting with existing platform

### Patient Import
- [ ] CSV imported via /api/recall/import
- [ ] Import results reviewed (counts, voice tiers, locations)
- [ ] Import quality confirmed

### Verify & Go Live
- [ ] Preflight checks pass
- [ ] Test messages simulated (SMS_LIVE_MODE=false)
- [ ] SMS_LIVE_MODE=true, server restarted
- [ ] Real test SMS sent + delivery confirmed
- [ ] Recall campaign launched

### Handoff
- [ ] Dashboard URL + credentials shared with practice
- [ ] Branding displays correctly
- [ ] Practice understands: dashboard is for monitoring, system runs on autopilot

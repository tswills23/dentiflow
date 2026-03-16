# Client Onboarding — SOP

## Overview

Steps to onboard a new dental practice onto DentiFlow.

## 1. Supabase Setup

### Create Practice Row
```sql
INSERT INTO practices (name, owner_name, phone, email, timezone, booking_platform, brand_voice, twilio_phone, practice_config, business_hours)
VALUES (
  'Practice Name',
  'Dr. Owner',
  '+1XXXXXXXXXX',
  'office@practice.com',
  'America/Chicago',
  'dentrix_ascend',
  'warm_professional',
  '+1TWILIO_NUMBER',
  '{"services_offered": ["hygiene_cleaning", "comprehensive_exam", "filling", "crown", "root_canal", "extraction", "whitening", "implant_consult", "perio_maintenance", "emergency"], "providers": [{"name": "Dr. Smith", "title": "DDS", "specialties": ["general"]}]}',
  '{"monday": {"open": "08:00", "close": "17:00"}, "tuesday": {"open": "08:00", "close": "17:00"}, "wednesday": {"open": "08:00", "close": "17:00"}, "thursday": {"open": "08:00", "close": "17:00"}, "friday": {"open": "08:00", "close": "14:00"}, "saturday": null, "sunday": null}'
);
```

### Create Dashboard Login
1. Create auth user in Supabase Auth (email + password)
2. Link to practice:
```sql
INSERT INTO user_profiles (auth_user_id, practice_id, role)
VALUES ('<AUTH_USER_UUID>', '<PRACTICE_UUID>', 'admin');
```

## 2. Twilio Setup

1. Buy a local phone number in Twilio Console
2. Set SMS webhook URL: `https://your-domain.com/webhooks/sms` (POST)
3. Register for A2P 10DLC (required for business SMS)
4. Update practice row with the Twilio number

## 3. Initial Patient Import

1. Export overdue patients from PMS as CSV
2. Format with columns: firstName, lastName, phone, lastVisitDate
3. Upload via API:
```
POST /api/recall/ingest
{
  "practiceId": "<PRACTICE_UUID>",
  "patients": [...]
}
```

## 4. Verify Setup

1. Check health endpoint: `GET /health`
2. Run preflight checks (see `directives/preflight.md`)
3. Send test outreach with SMS_LIVE_MODE=false
4. Verify messages appear in console log
5. Switch SMS_LIVE_MODE=true when ready for live

## 5. Dashboard Access

1. Share dashboard URL with practice staff
2. Login credentials: email + password set in step 1
3. Dashboard shows: leads, conversations, appointments, metrics

## White-Label Branding (Optional)

Add branding to practice_config:
```sql
UPDATE practices
SET practice_config = practice_config || '{
  "branding": {
    "primary_color": "#1E40AF",
    "accent_color": "#059669",
    "logo_url": "https://...",
    "practice_display_name": "Practice Name",
    "login_headline": "Welcome back"
  }
}'::jsonb
WHERE id = '<PRACTICE_UUID>';
```

## Checklist

- [ ] Practice row created in Supabase
- [ ] Auth user created and linked via user_profiles
- [ ] Twilio number purchased and webhook configured
- [ ] A2P 10DLC registration submitted
- [ ] Initial patient CSV imported
- [ ] Preflight checks pass
- [ ] Test outreach sent (SMS_LIVE_MODE=false)
- [ ] Dashboard login verified
- [ ] SMS_LIVE_MODE switched to true
- [ ] First live outreach sent

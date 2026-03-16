# Booking Agent Demo Flow — SOP

## Overview

Happy-path demo of the SMS booking agent. Shows a recall patient going from Day 0 outreach to confirmed appointment in 4 messages.

## Setup

1. SMS_LIVE_MODE=false (console output only)
2. Practice must have `twilio_phone` set
3. Use test phone numbers (555 prefix)

## Demo Script

### Step 1: Ingest Test Patient
```
POST /api/recall/ingest
{
  "practiceId": "<UUID>",
  "patients": [{
    "firstName": "Demo",
    "lastName": "Patient",
    "phone": "5550009999",
    "lastVisitDate": "2025-06-01"
  }]
}
```
Expected: `{ "imported": 1, "skipped": 0, "errors": [] }`

### Step 2: Send Day 0 Outreach
```
POST /api/recall/outreach
{ "practiceId": "<UUID>" }
```
Expected: Console shows simulated SMS like:
> "Hi Demo, this is Sarah at Practice Name. Just checking in to help you stay on track. Would this week or next week make more sense to come in?"

### Step 3: Patient Replies "next week works"
```
POST /webhooks/sms
Content-Type: application/x-www-form-urlencoded

From=+15550009999&To=+15551110000&Body=next week works for me
```
Expected: Intent = booking_interest, stage → S3_TIME_PREF
Console shows reply asking for preferred time (morning/afternoon).

### Step 4: Patient Replies "mornings are better"
```
POST /webhooks/sms
Content-Type: application/x-www-form-urlencoded

From=+15550009999&To=+15551110000&Body=mornings are better
```
Expected: Intent = preferences, stage → S4_AVAILABILITY
Console shows 3 morning time slots.

### Step 5: Patient Replies "option 1"
```
POST /webhooks/sms
Content-Type: application/x-www-form-urlencoded

From=+15550009999&To=+15551110000&Body=option 1
```
Expected: Intent = slot_selection, stage → S5_CONFIRMATION
Console shows confirmation message with slot details.

### Step 6: Patient Replies "yes"
```
POST /webhooks/sms
Content-Type: application/x-www-form-urlencoded

From=+15550009999&To=+15551110000&Body=yes confirm it
```
Expected: Intent = confirm, stage → S6_COMPLETED
Console shows booking confirmation. Sequence status = completed.

## Cleanup

Delete test patient and sequence after demo:
```sql
DELETE FROM recall_sequences WHERE patient_id IN (SELECT id FROM patients WHERE phone = '+15550009999');
DELETE FROM patients WHERE phone = '+15550009999';
```

## Notes

- The 60-second SMS cooldown may block rapid-fire demo steps. Wait 60s between steps or temporarily adjust the cooldown constant.
- All messages appear in console.log when SMS_LIVE_MODE=false
- Check `recall_sequences` table to verify state machine transitions

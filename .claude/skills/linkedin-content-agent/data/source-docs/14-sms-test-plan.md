# Dentiflow -- 48-Hour Recall SMS Copy Test Plan

**12+ Month Overdue Patients -- Doctor Voice**
**500 Patients | 2 Groups of 250 | 3-Day Sequence**

Prepared for Practice Review

---

## Test Structure

500 patients split into 2 equal groups of 250. One variable tested: Day 0 opener style. All other elements held constant across both groups.

| Element | Group A | Group B |
|---------|---------|---------|
| Day 0 Variable | Reason-based opener | Empathy-based opener |
| Voice | Doctor | Doctor |
| Day 1 | Same (consequence frame) | Same (consequence frame) |
| Day 3 | Same (offer -- non-responders only) | Same (offer -- non-responders only) |
| CTA Escalation | Reply → Soft CTA → Close | Reply → Soft CTA → Close |
| Sequence | Day 0, Day 1, Day 3 | Day 0, Day 1, Day 3 |

**What we're measuring:** Does a reason-based opener ("going through records") or an empathy-based opener ("life gets busy") drive more replies from 12+ month overdue patients?

The winner becomes the baseline control for all future tests.

---

## Day 0 -- Openers (Reply-Optimized, No CTA)

The job of Day 0 is simple: make the patient feel remembered, cared about, and safe to reply. No scheduling language. No booking CTA. Just a human check-in from their doctor.

### Group A -- Reason-Based Opener

**Psychology:** Gives the patient a reason for the outreach ("going through records"). Answers the unspoken question "why is my dentist texting me right now?"

> **GROUP A -- DAY 0**
>
> Hi [Name], this is Dr. [Last Name] from [Practice Name]. I was going through some patient records and noticed it's been some time since we've seen you. Just wanted to make sure everything's okay -- how are you doing?

### Group B -- Empathy-Based Opener

**Psychology:** Leads with empathy and removes guilt before the patient feels it. Normalizes the gap. Says "I'm not judging you for being gone this long."

> **GROUP B -- DAY 0**
>
> Hi [Name], this is Dr. [Last Name] from [Practice Name]. I know life gets busy and visits can slip -- it happens. Just wanted to reach out and make sure you're doing okay. How have things been?

---

## Day 1 -- Consequence Frame + Soft CTA

Day 1 is identical for both groups. The patient has seen Day 0 and either replied (in which case they're in the booking flow) or hasn't. Day 1 introduces clinical consequence framing -- not fear, but implication. The CTA is soft: asking about their schedule, not demanding a booking.

### Combined Consequence Frame (Both Groups)

> **BOTH GROUPS -- DAY 1**
>
> Hi [Name], Dr. [Last Name] again. One thing I see often -- patients feel fine for a while, but small dental issues don't always show symptoms until they've already progressed. I'd rather we catch anything early while it's simple to handle. What does your schedule look like this week or next?

### Backup Day 1 (For Future Testing)

Pure clinical version -- more direct, slightly more urgent. Kept in reserve for future A/B test against the combined version above.

> **BACKUP -- DAY 1**
>
> Hi [Name], Dr. [Last Name] again. The tricky thing about dental health is that small issues don't always show symptoms until they've already progressed. I'd rather catch something early than deal with something bigger down the road. When would be a good time to come see us?

---

## Day 3 -- Offer (Non-Responders Who Opened Only)

Day 3 only goes to patients who opened Day 0 and/or Day 1 but did not reply. These patients are interested enough to read but something is holding them back. The offer's job is to remove that last barrier.

- Patients who already replied are in the booking flow -- they do not receive Day 3.
- Patients who never opened have a bad number or aren't seeing SMS -- the offer won't help.

**Why the offer lives on Day 3 and not earlier:** By Day 3, care and consequence have been established. The offer doesn't lead the conversation -- it closes it. This keeps the doctor's authority intact and positions the offer as generosity, not desperation.

### Option 3a -- Normalize Gap + Doctor Waived Cost

**Psychology:** Directly addresses the most likely barrier -- coming back after a long time feels like a big deal. The doctor personally waiving the cost makes it feel like a gift, not a promotion.

> Hi [Name], Dr. [Last Name] one more time. I know getting back in after a while can feel like a big thing -- I want to make it easy. I've asked my team to waive the cost of your first visit back. No strings. I just want to make sure everything looks good. Would this week or next work better for you?

### Option 3b -- Scarcity + Generosity

**Psychology:** Limited spots creates urgency. "Set aside for patients I haven't seen in a while" makes it personal and exclusive.

> Hi [Name], Dr. [Last Name] again. I had my team set aside a few spots this month specifically for patients I haven't seen in a while -- no cost for the visit. I'd really like you to be one of them. What works better for you -- this week or next?

### Option 3c -- Acknowledge Hesitation + Remove Barrier

**Psychology:** Names the patient's internal friction out loud ("hardest part is just getting back on the schedule"). Feels understanding, not salesy.

> Hi [Name], Dr. [Last Name] here. I know sometimes the hardest part is just getting back on the schedule. I want to take one thing off your plate -- your first visit back is on us. Would mornings or afternoons be easier for you?

### Option 3d -- Consequence Callback + Complimentary

**Psychology:** Ties back to the Day 1 consequence frame. "I don't want too much time to pass" reinforces clinical urgency while the offer removes the barrier.

> Hi [Name], Dr. [Last Name] one last time. I don't want too much time to pass without at least taking a look at things. I've set aside a couple of complimentary visits for patients like you who I haven't seen in a while. Would this week or next be better?

---

## Reply Handling (Both Groups, All Days)

Once a patient replies, the system responds immediately on the same channel. The following scripts cover every common reply type. All replies are patient-care-first -- no business-serving language.

### Patient Says Yes / Picks a Time

> Perfect -- I'll have my team get you scheduled right away. You'll get a confirmation shortly. Looking forward to seeing you, [Name].

### Patient Says "Not Right Now" / "Maybe Later"

> Completely understand, [Name]. No pressure at all. We'll be here whenever you're ready. Just text back anytime and we'll get you right in.

Patient exits the sequence immediately. No additional messages sent. Patient enters deferred follow-up pool for future outreach.

### Patient Asks About Cost / Insurance

> Great question. My team can walk you through everything before your visit so there are no surprises. Want me to have them give you a quick call, or would you prefer a text with the details?

### Patient Asks "What's This About?" / "Why Are You Reaching Out?"

> It's just been a while since I've seen you, and I like to personally check in with patients I haven't seen in some time. Nothing urgent -- just want to make sure everything's looking good. Would you like to come in?

### Patient Says Stop / Unsubscribe

> Done -- you've been removed and won't receive any more messages from us. If you ever want to come back in, just call us directly anytime.

---

## Day 3 Segmentation Logic

| Patient Status After Day 1 | Day 3 Action | Rationale |
|---|---|---|
| Replied (any day) | No Day 3 message | Already in booking flow |
| Opened but didn't reply | Send Day 3 with offer | Interested but stuck -- offer breaks inertia |
| Never opened / not delivered | No Day 3 message | Bad number or not seeing SMS -- offer won't help |
| Said "not now" or deferred | No Day 3 message | Entered deferred pool -- respect the boundary |
| Unsubscribed / STOP | No Day 3 message | Removed from all sequences |

---

## Full Sequence Overview

| Day | Purpose | CTA Level | Notes |
|-----|---------|-----------|-------|
| Day 0 | Personal check-in | None -- earn the reply | Variable tested: reason vs. empathy opener |
| Day 1 | Consequence frame | Soft -- ask about schedule | Same for both groups |
| Day 3 | Offer + close | Direct -- this week or next | Non-responders who opened only |

---

## Notes for Practice Review

**On voice:** All messages use doctor voice. This is intentional -- 12+ month overdue patients need the highest authority sender to re-engage. The doctor's name carries trust that office staff cannot replicate in a cold text.

**On the attraction offer (Day 3):** Four offer options are presented above. The practice should select one based on what feels authentic to how the doctor communicates and what the practice is comfortable offering. The offer only goes to patients who opened messages but didn't reply -- it is not sent to the full list.

**On clinical framing:** No message uses the word "exam," "baseline," or "comprehensive." The clinical need is real, but those terms trigger avoidance in long-overdue patients. The consequence frame in Day 1 creates the same urgency without the clinical language.

**On CTA escalation:** Day 0 has no booking CTA. Day 1 introduces a soft CTA. Day 3 includes a direct binary choice. This mirrors how trust and urgency build over a short sequence -- patients who have been gone 12+ months need to re-engage emotionally before committing to a schedule.

**On compliance:** All messages are sent to existing patients of the practice only. Opt-out requests are honored immediately. No messages are sent after a patient says "not now" or any variation of deferring.

---

## What We Need From the Practice

1. Select preferred Day 0 opener (Group A or Group B -- or confirm we test both).
2. Select preferred Day 3 offer (Option 3a, 3b, 3c, or 3d).
3. Confirm the doctor's name and practice name for template personalization.
4. Confirm the complimentary visit offer is approved (Day 3 only, non-responders only).
5. Provide the patient list (500 records with first name and mobile number).

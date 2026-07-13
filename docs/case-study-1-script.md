# Case Study #1 — Full Script

**Status:** Draft — combined two-round numbers (657 / 32). A/B "vs 0" framing removed.
**Target runtime:** ~8 minutes
**Companion docs:** [case-study-1-village-recall.md](case-study-1-village-recall.md) (plan + locked numbers) · [case-study-1-interview-script.md](case-study-1-interview-script.md) (Scott + Dr. Phillip on-camera Q&A) · [case-study-1-sms-threads.md](case-study-1-sms-threads.md) (real threads)

---

## Production notes for Trevor

- **Screen recording**: use Loom or similar at 1080p, system audio off, narration only
- **Cuts**: Scott's interview clips at 0:00 + close. Dr. Phillip quote slide near the end.
- **B-roll**: real dashboard, real template editor, real SMS thread screenshots (from companion doc). DON'T use stock footage.
- **Voiceover style**: conversational, not announcer-y. "I'll just walk you through what we did."
- **Bracketed `[X]` markers** = pending — confirm/fill before recording.

---

## 0:00–0:45 — Cold open (Scott interview clip)

Scott's intro answer from the interview ([case-study-1-interview-script.md](case-study-1-interview-script.md), Q1) — co-owner of 32 Dental first, former CFO/CEO of Familia Dental second.

**Cut to title card:**
> **"Case Study: How 32 Dental Reactivated Dormant Patients with Dentiflow"**
> **3-location PPO group · two outreach waves · 657 dormant patients**

---

## 0:45–1:30 — Setup (Trevor voiceover, screen showing 32 Dental locations + patient list dashboard)

> *"Quick setup. 32 Dental is a three-location PPO group in Elk Grove Village, Illinois. Like most PPO practices, they have a backlog of dormant patients — people who haven't been in for a cleaning in 9+ months. Hundreds of them across the group.*
>
> *They'd been running the standard playbook: postcard recall, the occasional reminder text. Some came back. Most didn't. The list just kept growing.*
>
> *So we ran our recall sequence on that dormant list — 657 patients across two waves. No discount blast. A sequence of texts that reads like a real front-desk person reaching out. Then we tracked what happened.*
>
> *Here's what we built."*

---

## 1:30–6:30 — The work (Trevor voiceover + screen recording)

### 1:30–2:30 — What we actually sent

> *"Most dental SMS tools — Weave, NexHealth, RevenueWell — send something like this once and stop:*
>
> *'32 Village Dental in Elk Grove Village has missed seeing your smile! For a limited time, we're offering 30% off your recommended treatment plan—call us today...'*
>
> *One message. Discount. Link. Then nothing.*
>
> *Here's what we sent instead — three messages over three days, each from a different angle. Day 0, Day 1, Day 3."*

[Show actual templates from [src/services/recall/templates.ts](../src/services/recall/templates.ts) — partner-approved copy, real ones]

> *"Notice what's different. No discount upfront. No urgency. The first message just acknowledges they've been away and opens a door. The hard ask comes later, after we've earned a reply. This is exactly how a good front-desk person would reach out if they had time to manually text every dormant patient."*

### 2:30–5:00 — Real conversation threads

[Screen shows anonymized SMS threads from case-study-1-sms-threads.md, scrolling through each]

> *"This isn't a mockup. These are real conversations from real patients during the test. Names and phone numbers anonymized.*
>
> *Here's a patient who booked..."*

**[Thread 1 — Booked. Walk through the back-and-forth visually, narrating the patient's silence on Day 0, the second touch on Day 1 with a link, the final ask on Day 3, and the "Yes" reply.]**

> *"This patient never replied to Day 0. Didn't reply to Day 1 either. Day 3 hit, and that's when they engaged. If we'd stopped at one message — like the standard blast would have — we'd never have gotten them. That booking would not exist."*

**[Thread 2 — Declined.]**

> *"Not every patient is going to come back. This one engaged, told us they'd found another dentist, and we acknowledged it and let them go. No hard sell. No follow-up. The list stays clean."*

**[Thread 3 — Opted out.]**

> *"And here's one where the patient asked to be removed from the list. TCPA-compliant, immediate exit, never message again."*

### 5:00–6:30 — The dashboard + numbers

[Screen shows the dashboard funnel]

> *"OK, here's where it lands. 657 dormant patients, two waves, same kind of patients from the same backlog the practice had basically given up on. Here's the funnel."*

**Big on-screen table:**

| Dormant recall funnel | Combined (2 waves) |
|---|---:|
| Dormant patients texted | 657 |
| Booking-link clicks | **145 (~22%)** |
| Confirmed bookings | **32 (~4.9%)** |

> *"About 22% of the patients we texted clicked the booking link. Almost 5% of the entire dormant list booked a real appointment.*
>
> *For context: industry-typical recall click rates are 2 to 5 percent. Industry-typical dormant-to-booked conversion is 1 to 3 percent. We hit roughly 22 and 5 — multiples of the standard.*
>
> *In dollar terms: 32 appointments at an average of about $250 a visit is $8,000 in new production — off a list that was generating nothing. The texting cost was about $55. That's $8,000 in new production for $55 in texts. And that's before counting the lifetime value of the patients who now stay on the books going forward."*

---

## 6:30–6:45 — Clinical sign-off (still photo + on-screen quote, or Dr. Phillip interview clip)

[Still photo of practice or Dr. Phillip, or his interview clip]

> **"`[DR. PHILLIP QUOTE — pending, his own words]`"**
>
> **— Dr. Phillip `[LAST NAME — confirm]`, Co-founder & Practicing Dentist, 32 Dental**

---

## 6:45–7:45 — Close (Scott interview clip)

Scott's close from the interview ([case-study-1-interview-script.md](case-study-1-interview-script.md), Q6) — "you already paid to acquire these patients, they're just sitting there, I ran it on my own practice." Measured urgency, personal vouch, soft CTA.

---

## 7:45–8:00 — CTA card

**Full-screen card:**

> **Run this on your dormant patient list.**
>
> **We do all the work — you keep every booking. If it doesn't book patients worth more than it costs, you don't pay.**
>
> **Book a 15-min call: `[CALENDAR/BOOKING URL — confirm]`**
>
> **`[LANDING PAGE URL — confirm]`**

---

## 1-page written companion (for the landing page)

Below is the version that lives ABOVE the video on the landing page, for people who skim before they watch.

---

### How 32 Dental Reactivated 32 Dormant Patients from 657 Texts

**A real recall test on a 3-location PPO group's dormant list. No discount blast — a sequence that reads like a real front-desk text.**

#### What we did
We ran a 3-voice SMS sequence (Day 0, Day 1, Day 3 — a different angle each time, no discount upfront) on 657 dormant patients across two waves. The kind of patients the practice had stopped chasing.

#### What happened

| Dormant recall funnel | Combined (2 waves) |
|---|---:|
| Patients texted | 657 |
| Booking-link clicks | **145 (~22%)** |
| Confirmed bookings | **32 (~4.9%)** |

32 dormant patients booked a real appointment from a list that was generating nothing.

#### What that means
- **~22% link-click rate.** Industry typical for dental recall is 2–5%.
- **~4.9% dormant → booked.** Industry typical is 1–3%.
- **$8,000 in new production for about $55 in texts** — 32 appointments × ~$250 average; $54.38 actual Twilio send cost across both waves.

#### The video below shows
- Real (anonymized) patient conversation threads
- The exact templates we used vs. the industry-default discount blast
- The dashboard and the funnel data
- Scott Wills — co-owner of 32 Dental and former CFO + CEO of Familia Dental — on why this works
- Dr. Phillip `[LAST NAME — confirm]`'s clinical sign-off

#### **Want to run this on your dormant list?**
We're taking on `[NUMBER OF PRACTICES — confirm]` more practices for pilots this quarter — money-back guarantee. No contract. **Book a 15-min call:** `[CALENDAR URL — confirm]`

---

## Bracketed unknowns — fill before recording

| Token | What it is | How to fill |
|---|---|---|
| `[DR. PHILLIP LAST NAME]` | Lower-third + quote attribution | Ask Scott or Shane (confirm spelling — "Phillip," two L's) |
| `[DR. PHILLIP QUOTE]` | One sentence, his own words | From his interview, or written + approved by him |
| `[CALENDAR/BOOKING URL]` | Where the CTA points | Whatever scheduler you use (Cal.com, Calendly, etc.) |
| `[LANDING PAGE URL]` | Where the case study lives | dentiflow.ai/case-study-1 or similar |
| `[NUMBER OF PRACTICES]` | "Taking on N more practices for pilots" | Match your real capacity — recommend 3 to create urgency without overcommitting (3-concurrent-pilot cap) |

---

## Numbers — single source of truth

Locked combined figures (from [case-study-1-village-recall.md](case-study-1-village-recall.md), DB-verified 2026-06-11):

- **657** dormant patients texted (200 wave 1 + 457 wave 2)
- **145** booking-link clicks (~22%)
- **32** confirmed bookings (~4.9%)
- **$8,000** in new production at ~$250/appt — **confirmed** (32 bookings × ~$250).
- Send cost: **$54.38** actual Twilio spend across both waves (R1 $25.26 + R2 $29.12; 2,674 outbound msgs, all billed; from `messages.price`). Headline: **$8,000 in new production for ~$55 in texts.** Don't reintroduce the old "~$6 / ~400x" figure — it was wrong.

**Do not reintroduce the A/B "vs single message / vs 0" framing.** We state our own results.

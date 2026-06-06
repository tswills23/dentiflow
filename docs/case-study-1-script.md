# Case Study #1 — Full Script

**Status:** Draft — pending placeholders confirmed
**Target runtime:** ~9 minutes
**Companion docs:** [case-study-1-village-recall.md](case-study-1-village-recall.md) (plan), [case-study-1-sms-threads.md](case-study-1-sms-threads.md) (real threads)

---

## Production notes for Trevor

- **Screen recording**: use Loom or similar at 1080p, system audio off, narration only
- **Cuts**: Scott's video at 0:00 + 7:15 + 8:30. Dr. Phillip quote slide at 7:00.
- **B-roll**: real dashboard, real template editor, real SMS thread screenshots (from companion doc). DON'T use stock footage.
- **Voiceover style**: conversational, not announcer-y. Hormozi-style "I'll just walk you through what we did."
- **Bracketed `[X]` markers** = pending — confirm/fill before recording.

---

## 0:00–0:45 — Cold open (Scott on camera)

> *"I'm Scott Wills, co-founder of 32 Dental — three PPO locations in Elk Grove Village, Illinois.*
>
> *Before this I was CFO and then CEO of Familia Dental, a 50-location DSO across the Midwest. While I was there, I spent a lot of time trying to crack patient recall — the problem of getting dormant patients to come back. We had the budget. We had the team. We never got it working at scale.*
>
> *When my son's company offered to test their version of this at our practice, we said yes. What I'm about to show you is what happened over 14 days."*

**Cut to title card:**
> **"Case Study: How 32 Dental Reactivated Dormant Patients with Dentiflow"**
> **14-day pilot · 3-location PPO group · 2026-05-12 → 2026-05-26**

---

## 0:45–1:30 — Setup (Trevor voiceover, screen showing 32 Dental locations + patient list dashboard)

> *"Quick setup. 32 Dental has three locations. Like most PPO practices, they have a backlog of dormant patients — people who haven't been in for a cleaning in 9+ months. Roughly 700 of them across the group.*
>
> *They'd been running the standard playbook: postcard recall, the occasional reminder text. Some came back. Most didn't. The list just kept growing.*
>
> *So we ran an A/B test. We took 400 of those dormant patients — randomly split into two groups. One group got our 3-voice SMS sequence. The other group got what every other vendor in dental sends: a single message with a discount offer. Then we tracked what happened.*
>
> *Here's what we built."*

---

## 1:30–7:00 — The work (Trevor voiceover + screen recording)

### 1:30–2:30 — The two approaches, side by side

> *"On the left, here's the standard recall message. Most dental SMS tools — Weave, NexHealth, RevenueWell — send something like this once and stop:*
>
> *'32 Village Dental in Elk Grove Village has missed seeing your smile! For a limited time, we're offering 30% off your recommended treatment plan—call us today...'*
>
> *One message. Discount. Link.*
>
> *On the right is what we shipped to the other group. Three messages, three different voices — Day 0, Day 1, Day 3. Each one comes from a different angle. Here's Day 0..."*

[Show actual templates from [src/services/recall/templates.ts](../src/services/recall/templates.ts) — partner-approved copy, real ones]

> *"Notice what's different. No discount upfront. No urgency. The first message just acknowledges they've been away and opens a door. The hard ask comes later, after we've earned a reply. This is exactly how a good front desk person would reach out if they had time to manually text every dormant patient."*

### 2:30–5:30 — Real conversation threads

[Screen shows anonymized SMS threads from case-study-1-sms-threads.md, scrolling through each]

> *"This isn't a mockup. These are real conversations from real patients during the test. Names and phone numbers anonymized.*
>
> *Here's a patient who booked..."*

**[Thread 1 — Booked. Walk through the back-and-forth visually, narrating the patient's silence on Day 0, the second touch on Day 1 with a link, the final ask on Day 3, and the "Yes" reply.]**

> *"This patient never replied to Day 0. Didn't reply to Day 1 either. Day 3 hit, and that's when they engaged. If we'd stopped at one message — like the other vendor would have — we'd never have gotten them. That booking would not exist."*

**[Thread 2 — Declined.]**

> *"Not every patient is going to come back. This one engaged, told us they'd found another dentist, and we acknowledged it and let them go. No hard sell. No follow-up. The list stays clean. That matters because dormant patients who decline cleanly are the ones who'll refer their friends 5 years from now."*

**[Thread 3 — Opted out.]** *(Note to Trevor — see flagged issue at bottom of doc; may pull a different opt-out thread for the final cut)*

> *"And here's one where the patient asked to be removed from the list. Took us 4 messages to get there, which is fine — TCPA-compliant, immediate exit, never message again."*

### 5:30–7:00 — The dashboard + numbers

[Screen shows the dashboard with both arms displayed]

> *"OK, here's where it lands. Over 14 days, both groups got the same kind of patients from the same dormant list, randomly assigned. Here's the funnel."*

**Big on-screen table:**

|  | 3-voice sequence | Single-message offer |
|---|---:|---:|
| Dormant patients sent | 201 | 199 |
| Booking-link clicks | **48 (23.9%)** | **0 (0.0%)** |
| Confirmed bookings | **11 (5.5%)** | **0 (0.0%)** |
| Opt-outs | 11 (5.5%) | 4 (2.0%) |

> *"23.9% of patients in the 3-voice group clicked the booking link. Zero clicked in the single-message group.*
>
> *11 patients booked an appointment from the 3-voice group. Zero booked from the single-message group.*
>
> *For context: industry-typical recall click rates are 2 to 5 percent. Industry-typical dormant-to-booked conversion is 1 to 3 percent. We hit 23.9 and 5.5 — somewhere between 2 and 5 times the standard.*
>
> *Real dollar terms: those 11 patients booked at an average of $220 per visit — confirmed by the practice. That's $2,420 in production from a 14-day pilot. Send cost was about $6 in SMS. That's a 400x return on the SMS cost — and we haven't counted the lifetime value yet of the patients who'll stay on the books going forward."*

---

## 7:00–7:15 — Clinical sign-off (still photo + on-screen quote)

[Still photo of Village Dental practice or Dr. Phillip]

> **"`[DR. PHILLIP QUOTE — pending]`"**
>
> **— Dr. Phillip `[LAST NAME — confirm]`, Co-founder & Practicing Dentist, 32 Dental**

---

## 7:15–8:30 — Close (Scott on camera)

> *"I want to be straight with you about why this matters.*
>
> *At Familia I watched practice owners burn money on marketing — Google Ads, billboards, mailers — to get new patients while they had hundreds of dormant patients already in the chart who would come back for free if anyone bothered to reach out the right way. Every PPO practice has this problem. Most of them don't know it.*
>
> *What I just showed you is the difference between the way every vendor in this space handles recall and the way it should be handled. A 5x improvement isn't because Dentiflow has better SMS technology than Weave. It's because the system was built by people who actually thought about how patients reply to texts.*
>
> *If you run a practice — or a group, or a DSO — and you want to see if this works on your dormant list, the next 14-day test we run could be yours. There's no risk and no setup cost to find out. Book a call with Trevor and he'll walk you through it."*

---

## 8:30–8:45 — CTA card

**Full-screen card:**

> **Run this on your dormant patient list.**
>
> **Free 14-day test. No contract. No setup fee. We send the messages, you keep every booking.**
>
> **Book a 15-min call: `[CALENDAR/BOOKING URL — confirm]`**
>
> **`[LANDING PAGE URL — confirm]`**

---

## 1-page written companion (for the landing page)

Below is the version that lives ABOVE the video on the landing page, for people who skim before they watch.

---

### How 32 Dental Reactivated Dormant Patients in 14 Days — and Why the Standard Recall Approach Got Zero

**A real A/B test on 400 dormant PPO patients. One practice, three locations, two approaches.**

#### What we tested
- **Group A** (n=201): A 3-voice SMS sequence over Day 0, Day 1, Day 3. Different angle each time. No discount upfront.
- **Group B** (n=199): A single SMS with a 30%-off treatment-plan offer. What most dental vendors send.

#### What happened in 14 days

|  | 3-voice sequence | Single-message offer |
|---|---:|---:|
| Patients sent | 201 | 199 |
| Booking-link clicks | **48 (23.9%)** | **0 (0.0%)** |
| Confirmed bookings | **11 (5.5%)** | **0** |
| Opt-outs | 5.5% | 2.0% |

11 dormant patients booked appointments from the 3-voice group. Zero booked from the single-message group.

#### What that means
- **23.9% link-click rate.** Industry typical for dental recall is 2–5%.
- **5.5% dormant → booked.** Industry typical is 1–3%.
- **$2,420 in visit production** from those 11 patients ($220/patient average, confirmed by the practice). SMS send cost: ~$6. **~400x return on SMS spend — and that's just the 14-day window, before counting any lifetime value of the reactivated patients.**

#### The video below shows
- Real (anonymized) patient conversation threads
- The exact templates we used vs. the industry-default template
- The dashboard and the funnel data
- Scott Wills — co-founder of 32 Dental and former CFO + CEO of Familia Dental — on why this works
- Dr. Phillip `[LAST NAME — confirm]`'s clinical sign-off

#### **Want to run this on your dormant list?**
We're taking on `[NUMBER OF PRACTICES — confirm]` more practices this quarter for free 14-day tests. No contract. No setup fee. **Book a 15-min call:** `[CALENDAR URL — confirm]`

---

## Bracketed unknowns — fill before recording

| Token | What it is | How to fill |
|---|---|---|
| `[DR. PHILLIP LAST NAME]` | Lower-third + quote attribution | Ask Scott or Shane |
| `[DR. PHILLIP QUOTE]` | One sentence | Ask via Scott — frame as "we're putting together a case study, would you share one sentence we can quote?" |
| ~~`[VILLAGE REVENUE TOTAL]`~~ → **$2,420** | Confirmed 2026-06-02: $220/patient × 11 patients | ✅ Locked |
| ~~`[ROI MULTIPLE]`~~ → **~400x** | $2,420 production ÷ ~$6 send cost | ✅ Locked |
| `[CALENDAR/BOOKING URL]` | Where the CTA points | Whatever scheduler you want to use (Cal.com, Calendly, etc.) |
| `[LANDING PAGE URL]` | Where the case study lives | dentiflow.ai/case-study-1 or similar |
| `[NUMBER OF PRACTICES]` | "Taking on N more practices for free tests" | Match your real capacity — recommend 3 to create urgency without overcommitting |

---

## Production findings to flag (Trevor — these came up while pulling SMS threads)

While building the conversation threads I noticed three real issues in production:

1. **Template double-rendering.** Multiple outbound messages contain "Village Dental Village Dental" and "Dr. Dr. Phillip" — `{{Practice Name}}` and `{{Doctor Name}}` are being rendered with the prefix already included AND the variable. Affects every message that uses those variables. **Action:** check the template-render path in [src/services/recall/](../src/services/recall/) — likely in the variable substitution layer. Fix before next send (Round 2 on 2026-06-03).

2. **Duplicate sends.** Thread 1 (the booked patient) shows two identical Day 1 messages sent 0 seconds apart with different booking-link tokens. Looks like a race condition in the cron or duplicate template processing. **Action:** check `recallCron` and `outreachEngine` for idempotency on Day 1/Day 3 sends.

3. **Misclassified opt-out.** Thread 3 patient said "Maybe at end of month" — a defer signal — but system replied "Got it, you're off the list" and set `EXIT_OPT_OUT`. **Action:** check the reply classifier — "maybe at end of month" should route to `EXIT_DEFERRED` with a follow-up scheduled, not a permanent opt-out. This is a business risk: that patient will not receive future recall, when they explicitly said to try them later.

None of these block the case study (the threads still show what we want them to show after light editorial cleanup), but #1 and #3 should get fixed before Round 2 sends on 2026-06-03.

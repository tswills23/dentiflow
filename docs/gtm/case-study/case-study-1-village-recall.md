# Case Study #1 — Village Dental Recall Results

**Status:** Draft plan — not yet shipped
**Date:** 2026-06-02 (data updated 2026-06-11 — combined two rounds)
**Owner:** Trevor
**Goal:** Ship a credibility-building case study that books 15-min sales calls from PPO dental practice owners and group/DSO operators.

---

## Headline claim

> **"32 dormant patients booked from 657 texts. A recall sequence that reads like a real front-desk text, not a discount blast."**

Honest framing: combined results from two rounds at one PPO practice group (Village Dental), Round 1 launched 2026-05-12, Round 2 launched 2026-06-03.

---

## Data we have (verified from production DB on 2026-06-11)

Source: 3-voice recall sequence (Day 0/1/3) run on Village Dental dormant list across two rounds. Bookings confirmed via Dentrix Ascend schedule cross-reference (`scripts/recall-dentrix-xref.mjs`); funnel pulled from `recall_sequences`. Round 1 also ran an `offer_only` control arm — dropped from the public framing; we state our own results rather than a head-to-head.

| Metric | Round 1 (5/12) | Round 2 (6/3) | **Combined** |
|---|---:|---:|---:|
| Dormant patients sent | 200 | 457 | **657** |
| Booking-link clicks | 48 | 97 | **145 (~22%)** |
| Confirmed bookings | 11 | 21 | **32 (~4.9%)** |

**Key ratios (combined):**
- ~22% link-click rate (industry typical 2–5%)
- ~4.9% dormant → booked (industry typical 1–3%)

**Round 2 denominator note:** 457 = enrolled patients with `last_sent_at` ≥ 2026-06-03 (330 unique phones; difference is household members sharing a number). Verified, exact — chosen over the rounded "~500 sent" figure to keep every number defensible.

**Revenue (revised 2026-08-03 — Trevor):**
- 32 bookings × ~$300 average = **$9,600 in new production.**
- Texting cost: **$54.38** actual Twilio spend across both waves (R1 $25.26 + R2 $29.12; 2,674 outbound msgs, all billed; summed from `messages.price`).
- **Headline number: $9,600 in new production.** ⚠️ The old "$9,600 for ~$55 in texts" ratio is **retired from all ad creative** — Trevor's 2026-08-03 rule: never anchor to cost, only to results. The $55 remains true and usable on a sales call; it must not appear in an ad.
- (Revision history: R1 alone was $2,420 at $220/appt, practice-verified 2026-06-02. Combined was recorded 2026-06-12 as $8,000 at ~$250 avg; **revised 2026-08-03 to $9,600 at ~$300 avg** on Trevor's instruction. The $250 figure is superseded.)

---

## Testimonial lineup

Two voices total. Trevor is the only Dentiflow-side voice.

| Voice | Title (for lower-third) | What they cover | Asset format |
|---|---|---|---|
| **Scott Wills** | Co-founder, 32 Dental \| Former CFO + CEO, Familia Dental | DSO authority + operator POV — "I tried to build this at Familia and couldn't" | 2–3 min video |
| **Dr. Phillip `[LAST NAME — confirm]`** | Co-founder + Practicing Dentist, 32 Dental | Clinical sign-off | 1-sentence written quote + still photo |

Shane (third 32 Dental co-founder) intentionally not in v1.

---

## ~9-minute screen-recording structure

| Time | Section | Voice | Content |
|---|---|---|---|
| 0:00–0:45 | Cold open | Scott | "I'm Scott Wills, co-founder of 32 Dental. Before this I was CFO and then CEO of Familia Dental — 50 locations across the Midwest. I tried to build a recall system like this at Familia. Couldn't crack it at scale. When this company approached us about testing their recall system at our practice, we said yes. Here's what we got." |
| 0:45–1:30 | Setup | Trevor | 32 Dental — 3 PPO locations in Elk Grove Village. Dormant patient list. What postcards / Weave-style recall wasn't doing. How the 3-voice sequence works. |
| 1:30–7:00 | The work | Trevor (screen recording) | Real dashboard, the actual 3-voice SMS templates (Day 0/1/3), 3 anonymized real conversation threads, the booking-link click data, the combined two-round funnel walkthrough |
| 7:00–7:15 | Clinical quote | Dr. Phillip's quote on screen | One sentence over still photo of practice |
| 7:15–8:30 | Close | Scott | DSO/operator perspective on what this means + CTA framing — "If you run a practice or a group, the next test we run should be on your dormant list." |
| 8:30–8:45 | CTA card | — | Calendar link, dentiflow.ai URL `[CALENDAR/BOOKING URL — confirm]` |

---

## Critical path to ship

### Track A — Asks of others (start today)

1. **Scott (Dad)** — book 30-min on-camera session this week. Also ask him to have Village's front desk export the 11 booked patients' visit production from Dentrix.
2. **Dr. Phillip (via Scott)** — ask for one sentence to quote. Frame: *"For a case study we're putting together on the recall results at Village, would you share one sentence we can quote? I can draft something if it's easier."*

### Track B — Work Trevor / Claude do this week (no external dependencies)

3. Pull + anonymize 3 real SMS threads from production DB (1 booked, 1 declined, 1 opt-out)
4. Draft full ~9-min script with bracketed placeholders for all unverified facts

### Track C — Final production (depends on A + B)

5. Trevor records screen-share walkthrough (~1 hour with retakes)
6. Cut Scott's video + Dr. Phillip quote slide into the recording
7. Build landing page (email gate → unlocks video + 1-pager, tracked CTA → calendar)
8. Ship to first audience

---

## Bracketed unknowns (do not fabricate)

- `[DR. PHILLIP LAST NAME — confirm]` — needed for lower-third + quote attribution
- `[DR. PHILLIP QUOTE — pending]` — comes from the ask
- ~~`[VILLAGE REVENUE TOTAL]`~~ → **$9,600** (32 × ~$300; revised 2026-08-03 from the 2026-06-12 figure of $8,000 at ~$250; R1 alone was $2,420)
- `[CALENDAR/BOOKING URL — confirm]` — wherever the CTA points
- `[LANDING PAGE URL — TBD]` — where the case study lives

Every unverified fact must appear as a bracket until confirmed. No plausible-sounding placeholders.

---

## Realistic timeline

| Day | Milestone |
|---|---|
| 2026-06-02 (today) | Trevor sends 2 asks (Scott, Dr. Phillip via Scott). Claude starts SMS pull + script draft. |
| Day 1–2 | SMS threads + draft script delivered. Trevor reviews. Front-desk revenue export requested. |
| Day 3–5 | Scott records video. Dr. Phillip sends written quote. Front-desk export returned. |
| Day 6–7 | Trevor records screen walkthrough. Landing page built. |
| ~2026-06-10 | Ship v1. First distribution wave. |

---

## Distribution plan (Day 8+)

Three channels at launch:

1. **Warm referral asks** — Scott + Shane + Dr. Phillip each send to 5–10 dentist contacts. Script: *"We put a recall system in place at our practice. Here's what it did. Who do you know that would want to see this?"*
2. **LinkedIn** — one post per week for 3 weeks, each anchored in a specific stat from the case study, linking back to the landing page
3. **Cold outreach test** — ~100 cold emails or DMs to PPO practice owners in the Midwest, using the case study as the lead magnet

---

## What this case study will NOT claim

- ❌ "We helped a dental group recover $X" — only state the real number from the front-desk export
- ❌ "Scaled to multiple practices" — it's 3 locations of 1 group
- ❌ "Average across our customer base" — it's the launch customer
- ❌ Any quote from Scott or Dr. Phillip not actually said by them
- ❌ Statistical significance claims — sample size doesn't support them; the ratio speaks instead

---

## Future versions (planned, not yet built)

| Version | Target ship | Data anchor |
|---|---|---|
| **v1** | ~2026-06-10 | Combined Village results — Round 1 (5/12) + Round 2 (6/3), 32 bookings (this doc) |
| **v2** | ~2026-07-08 | Round 2 results — 503 untouched Village patients sent on 2026-06-03, 30-day data window |
| **v3** | ~2026-08-15+ | Unscheduled treatment campaign — each booking worth $1K–$5K, not $200 hygiene. Where the revenue numbers get big. |

Each new version is a fresh reason to re-message every dentist who saw the previous one.

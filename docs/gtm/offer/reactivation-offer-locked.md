# REACTIVATION OFFER — LOCKED (Front Door SKU)

**Status:** LOCKED 2026-08-05. This is the complete, self-contained spec for the reactivation
offer. Written to be handed to a fresh session with no other context.

**Scope:** This file governs the **front-door reactivation SKU only**. It supersedes §1, §3, §4,
§5, §7 and §9.1 of [dentiflow-offer-master.md](./dentiflow-offer-master.md) for this SKU. The master
still governs Stage 2 / system architecture (§10), pricing-evolution triggers (§11), and the
rejected-options log (§13). **The master has not yet been updated to match this file — do that
before treating the master as canonical again.**

**The system offer (post-30-day upsell) does not exist yet and must not be advertised.**

---

## 1. THE OFFER

> **The 30-Day Empty Chair Sprint — we take 500 patients from one location's overdue list, our AI
> runs two-way text conversations with them, and books the ready ones into the reactivation blocks
> you set aside. Fewer than 12 booked in 30 days and we keep working free until you get there.
> $2,000. After that, less than the price of one hygiene visit per month to catch every patient who
> leaves without their next appointment on the books.**

### Terms

| | |
|---|---|
| **Name** | The 30-Day Empty Chair Sprint |
| **Unit** | 1 location. Always. Same price whether they run 3 offices or 7 |
| **Segment** | 500 patients. Never smaller. Never larger without a fee |
| **Price** | **$2,000 flat, one-time** |
| **Duration** | 30 days from first send |
| **Performance guarantee** | Fewer than 12 booked in 30 days → we keep working that location free until 12 |
| **Unconditional guarantee** | Full refund inside the first 14 days, any reason, no conversation |
| **Counting method** | A booking = appointment scheduled within 30 days of first send, attributable to a link click or reply thread. Agreed in writing before the first send |
| **Clock starts** | First send. Not payment, not signature |
| **Continuity ("Chair Watch")** | Nearest $50 **below** one hygiene visit at their fee schedule, per location, per month. Starts day 31 at full price |
| **Rollover credit** | The $2,000 credits toward the **system install only** — never toward Chair Watch |
| **Only downsells** | Split-pay (2 × $1,100). Nothing else. Never a smaller segment, never a discount |
| **Capacity** | 3 sprints at a time. True constraint — state it truthfully, never oversell it |

### Chair Watch pricing table

| Their hygiene visit (prophy + exam + BW) | Chair Watch / location / month |
|---|---|
| ~$180 | $150 |
| ~$240 | $200 |
| ~$300 | $250 |
| ~$360+ | $300 |

Rule: nearest $50 **strictly below** one hygiene visit. That's what makes a single caught patient
worth more than the month. Their number, not ours — the price stops being negotiable when it's a
formula.

### Effort required from the buyer (say this out loud — it's a selling point)

Three things, total:
1. Export one file from their PMS
2. Approve the copy, once
3. Set two 3-hour reactivation blocks per week

---

## 2. AVATAR

**Owner or managing partner of a 3–7 location PPO group.** Established, producing, with visibly
leaky hygiene columns — and who wants nothing to do with fixing it personally. This owner pays
more, churns less, and never takes it in-house.

### Qualification gates (application form)

- PPO practice
- **500+ overdue patients at the target location**
- Owner or managing partner — decision-maker on the call
- Can approve a paid engagement with a money-back guarantee
- Willing to do a 20-min call, provide an export, and set reactivation blocks
- **"What do you charge for a cleaning, exam, and x-rays?"** — required. Prices Chair Watch, pre-computes sprint ROI, and acts as a wealth filter

Auto-decline below the floor.

### Copy target

Gut-punch the specific picture: *"holes in your hygiene columns while 500 of your own patients sit
overdue."* Never generic "grow your practice."

---

## 3. MECHANISM — Two-Way Recall

**Naming decision, 2026-08-05.** "Ledger-to-Chair" was proposed as a replacement and **rejected as
the ad-facing name.** A mechanism's job is to explain why everything they tried failed and why this
works. "Two-Way Recall" does that in three words — the one-way/two-way contrast needs no explanation
and survives a three-second scroll. "Ledger-to-Chair" names a path but needs a paragraph to land:
fine on a call, useless in a headline. **The real upgrade was the three named stages below, not the
name.** Use "Ledger-to-Chair" as the *process* name on a landing page, VSL, or sales call if you want
one. Never as the ad-facing mechanism.

### The three stages

**1 — Ledger Sweep.** We pull every overdue patient out of their PMS and score them: months since
last visit, remaining insurance benefits, diagnosed treatment sitting unscheduled, historical
production. The list stops being a blob and becomes a ranked queue. **And we blend every wave** —
roughly 60% recently-overdue, 40% deep-overdue, same recipe every time — so we never burn the best
patients in wave one and the rate holds in month four.

**2 — The Conversation Layer.** The AI opens a real two-way text thread and answers the three
things that actually stop a lapsed patient from rebooking: *what's this going to cost me, does my
insurance still work, when can I actually come in.* It handles the reply, the follow-up question,
and the reschedule.

**3 — Chair Lock.** The patient picks a time from the **reactivation blocks the practice set
aside**, and it lands on their schedule. Every booking attributed back — which patient, which
dollar — on a live dashboard.

### The mechanism paragraph (use verbatim in ads, landing page, and on the call before price)

> Most recall is one-way. Postcards, no-reply blasts, a call list your front desk never finishes.
> One-way fails for one reason: the patient's actual blockers — *what's this going to cost me, does
> my insurance still work, I can't deal with scheduling right now* — never get answered. So they do
> nothing. And you conclude it doesn't work.
>
> We run **Two-Way Recall**, and it's three stages. We sweep your ledger and rank every overdue
> patient by value and readiness. Then the AI opens a real two-way text conversation — and when they
> reply, it answers like your best front-desk person. Then it locks the chair: the patient picks a
> time from the blocks you set aside, and it lands on your schedule.
>
> At a 7-location PPO group we took 657 patients off their overdue list — about 17% of it. 145
> clicked the booking link — 22%, against an industry-typical 2 to 5. 32 booked. About $9,600 in
> production.

### Why reactivation blocks matter (mechanism support, usable in copy)

- Works with **any** PMS, day one — no integration dependency
- Makes "books onto your schedule" literally true
- **Guarantees supply.** The #1 silent killer of reactivation is no availability
- Commitment device — a doctor who sets aside chairs is invested before the first text sends
- Kills the front-desk objection: "we only book into the windows you gave us"

**Operating spec:** two 3-hour blocks per week per location (~6 hygiene slots, sized to ~24
expected bookings/month). Practice picks the days. **Unfilled slots release back to the front desk
48 hours out** — non-negotiable, this is what stops them resenting empty reserved time.

---

## 4. LOCKED CLAIMS — THE ONLY NUMBERS ANY AD MAY USE

Verified against production DB 2026-06-11, bookings cross-referenced against Dentrix Ascend
schedule, Twilio spend summed from `messages.price`. Combined two waves (Round 1 launched
2026-05-12, Round 2 launched 2026-06-03).

| Fact | Approved phrasing |
|---|---|
| Patients texted | **657 overdue patients** |
| Link clicks | **145 clicks (~22%)** — industry typical 2–5% |
| Bookings | **32 booked (~4.9%)** — industry typical 1–3% |
| Production | **~$9,600 in new production** (32 × ~$300 avg; revised 2026-08-03 — the old $8,000 at ~$250 is SUPERSEDED) |
| Avg per booking | **~$300** |
| Timeframe | across two waves at one PPO group |
| Sequence | **3-voice SMS sequence** (Day 0 / Day 1 / Day 3) that reads like a real front-desk text |
| Total overdue list | **3,926 across the 3 locations** — 657 worked = **~17% of the list** |
| Practice | **3 locations of a 7-location PPO group — 32 Family Dental, Elk Grove Village, IL** |
| Scott | **Scott Wills — Co-founder, 32 Family Dental; former CFO & CEO of Familia Dental (~50-location DSO)** |
| Dr. Phillip | **Dr. Phillip `[LAST NAME — CONFIRM]` — Co-founder & practicing dentist, 32 Family Dental** |

**Public name is "32 Family Dental."** Never "Village Dental" or "32 Dental" in anything outward-facing.

### Derived numbers (safe — arithmetic on the above)

- **$14.61 in production per overdue patient texted** ($9,600 ÷ 657)
- **~1,309 overdue patients per location** (3,926 ÷ 3) — confirms a 500-patient sprint is ~38% of a typical location's list
- **3,269 patients still untouched** at that group after both waves
- **500 patients ≈ 24 expected bookings ≈ ~$7,200** at the observed rate
- **12-booking guarantee floor ≈ $3,600** at $300/visit

### Sales-call only — NEVER in an ad

- **Text cost: ~$55** ($54.38 actual, 2,674 outbound messages). **Permanently retired from all ad creative** per Trevor's 2026-08-03 rule — never anchor a result to a cost. Still true and usable on a sales call.
- Projected value of the 3,269 untouched patients: **~$47,800** (3,269 × $14.61). Frame as arithmetic on the call ("at the rate we saw"). **Keep it out of all creative** — it's a predictive dollar claim.

### Guardrails (non-negotiable)

- ❌ No "vs 0" / A/B / control-arm framing. State our own results only
- ❌ No statistical-significance or "predictive" claims
- ❌ No "average across our customers" — this is one group
- ❌ No competitor takedowns. Weave / NexHealth / RevenueWell only as "the industry default"
- ❌ No fabricated quotes. Scott and Dr. Phillip never state dollar figures themselves
- ❌ No invented numbers. Anything unconfirmed stays `[BRACKETED]`
- ❌ **No dollar promises to the viewer.** The $9,600 is the case study's result; the guarantee is about *their* sprint
- ❌ **No cost anchored to a result.** The ~$55 text cost never appears beside a production figure in an ad — every number in an ad must be something the practice *gets*, never a spend figure (Trevor, 2026-08-03)
- ✅ Let the ratios carry it — 4.9% vs 1–3%, 22% vs 2–5%

---

## 5. AD-COPY RULES (non-negotiable)

- **No price anywhere** in ads, creative, or landing page. The ad sells the application. The application sells the call. The call sells the sprint.
- **"Two-Way Recall" mechanism language in at least one live variant at all times.** Guarantee-led and result-led variants run beside it.
- **Never "Get Offer" CTA with dollar language.** Apply Now / Learn More / Sign Up only.
- **Visibility:** Dentiflow Page + Business Manager asset only. **No Trevor anywhere** — no on-camera, no personal profile, no "my son," no Dentiflow→32 Dental relationship shown. Scott is the only face. Founder's local market excluded from targeting.
- **Compliance:** B2B audience, no PHI, no personal-attribute implication, guarantee wording consumer-claims-safe.

---

## 6. CLAIM BOUNDARY — what's true today

| ✅ Say this | ❌ Not yet |
|---|---|
| "Books them onto your schedule" | "Writes directly into your PMS" |
| "Into the reactivation blocks you set aside" | "Two-way sync with Dentrix / Open Dental" |
| "Lands in your schedule, verified against your PMS" | "Integrated with your practice management software" |
| "One location, 500 patients, 30 days" | Anything implying a simultaneous multi-location rollout |

**Two hard product gates:**
1. **Multi-location isolation has not shipped** (per-location phone/name/email separation). Sell single-location sprints only. Isolation is on the clock — day 30 of the first sprint.
2. **Open Dental direct booking is built but untested.** Reactivation blocks make "books onto your schedule" honest regardless, so this is an efficiency upgrade, not a blocker.

---

## 7. POSITIONING

### Category

**Not recall software.** Recall software is a $99/month checkbox inside Weave and every group
already has it. The category is **dormant ledger recovery** — a done-for-you service that recovers
production a practice already paid to acquire and lost. The comparison set is a hygiene coordinator
they'd have to hire, or the money staying lost.

> "We're not recall software. We're the people who go get the patients your recall software already
> failed to bring back."

### Differentiation narrative

> Everybody in this category sells *sending.* Blast software, postcards, a call list your front desk
> starts and never finishes.
>
> Sending was never the problem. Your patients got the message. They just had a question nobody
> answered — what's this going to cost, does my insurance still work, when can I actually come in —
> and a message that can't answer gets ignored.
>
> We don't sell sending. **We sell the conversation after the send.** Our AI answers the question,
> handles the objection, offers the time, and locks the chair.

### Why now

Every month an overdue patient stays overdue, they drift further from the practice and closer to
the office down the street. Unused insurance benefits reset every December. A patient gone eighteen
months converts materially worse than one gone six. **The list isn't sitting still — it's decaying.**

Plus real scarcity: 3 sprints at a time, one operator. True constraint, stated truthfully. No fake
countdown timers.

### Buyer psychology levers in play

| Lever | Where it lives |
|---|---|
| Loss aversion / sunk cost | "You already paid to acquire every patient on that list" |
| Certainty over promise | Found money vs. speculative new-patient growth |
| Risk reversal | Two stacked guarantees, different fears, different clocks |
| Anchoring | The ~$9,600 case-study number lands before any price is discussed |
| Paid = qualified | $2,000 filters owners from tire-kickers and finances the ad spend |
| Real scarcity | 3 concurrent sprints |
| Small step, not big leap | One location, one month, one export |

---

## 8. MESSAGING ASSETS

### Short-form value stack (ads / landing page)

> 500 overdue patients worked · Two-way AI conversations, not blasts · Books into the blocks you set
> aside · Every booking verified against your schedule · Live dashboard · One export and one
> approval is your entire job · First send in 72 hours · 12 patients in 30 days or we keep working
> free

### Elevator pitch (60 seconds)

> Every location you run has 500-plus patients who stopped coming and never came back. You already
> paid to get every one of them.
>
> Most groups try to win them back with a postcard or a no-reply text blast. It doesn't work, and
> there's a specific reason — one-way messages never answer the thing that's actually stopping the
> patient. So they do nothing.
>
> We run Two-Way Recall. Three steps: we sweep your ledger and rank every overdue patient by value
> and readiness, our AI opens a real two-way text conversation and answers their questions like your
> best front-desk person, then it locks the appointment into the blocks you set aside.
>
> We ran it inside a 7-location PPO group. Started with 3 of their offices — 657 patients off a
> 3,926-patient overdue list, so about 17% of it. 145 clicked the booking link — 22%, against an
> industry-typical 2 to 5. 32 booked. About $9,600 in production.
>
> That's exactly how I'd start with you. One location. 500 patients. If we don't book at least 12 in
> 30 days, we keep working free until we do.

### Headline bank

1. **Your locations have 500 patients each who already paid you once.**
   *We'll get 12 of them back on your schedule in 30 days — or we work free until we do.*
2. **657 overdue patients. 145 clicked. 32 booked.**
   *Here's the exact system, running in your office in 72 hours.*
3. **Postcards don't answer questions. Ours does.**
   *Two-way AI conversations with every past-due patient on your list.*
4. **12 patients in 30 days. Guaranteed.**
   *You export one file. You approve the copy. You pick the blocks. That's your entire job.*
5. **The most valuable list in your practice is the one nobody's calling.**
   *We sweep it, work it, and book it.*
6. **Holes in your hygiene column. 500 of your own patients past due.**
   *Thirty days.*
7. **Your front desk was never going to finish that call list.**
   *Ours doesn't get interrupted.*
8. **We put 32 patients back on one group's schedule.**
   *Every one of them had already stopped coming.*
9. **The cheapest new patient you'll ever get is one you already had.**
   *500 of them, worked in 30 days, guaranteed.*
10. **Tell us which chairs you want filled.**
    *We'll fill them with patients you already have.*
11. **We worked 17% of one group's overdue list. It produced about $9,600.**
    *The other 83% is still sitting there. So is yours.*
12. **657 of 3,926 patients. 32 back on the schedule.**
    *We're not a blast. We're the conversation after it.*

### Risk-reversal statement

> **Twelve booked patients in 30 days, or we keep working free until you get there.** At your own
> average visit value, that floor is more than what you paid us. And if you decide in the first two
> weeks that you don't like how we work, for any reason at all, you get every dollar back. We agree
> on what counts as a booking in writing, before a single text goes out.

### CTA framing

> "Either we put 12 of your own patients back on your schedule in the next 30 days — patients you
> already paid to acquire — or you don't pay. All I need is the export, a green light on the copy,
> and two blocks a week. Which location do you want us to start with?"

---

## 9. OPEN ITEMS

| # | Item | Blocks |
|---|---|---|
| 1 | Dr. Phillip last name + quote | Case-study video assets |
| 2 | Multi-location isolation ship | Any multi-location sale |
| 3 | Open Dental booking test | Stronger integration claims |
| 4 | Update [dentiflow-offer-master.md](./dentiflow-offer-master.md) to match this file | Master is currently stale AND self-contradictory (200 vs 300 segment size in different sections) |
| 5 | Build the system offer (post-30-day upsell) | Gated per master §10 — six modules live, per-module guarantee math, isolation |

**Cleared 2026-08-05:** Scott signed off on stating "7-location group" publicly · exact list count
confirmed at 3,926 · public name is **32 Family Dental**.

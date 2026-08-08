# Dentiflow Paid-Ads Campaign — The AI Reactivation Pilot

> **Offer terms are governed by [dentiflow-offer-master.md](../offer/dentiflow-offer-master.md)** (single source of truth as of 2026-07-07). This doc is campaign EXECUTION — creative, targeting, budget, funnel build. Where the two conflict on offer terms, the master wins. Key deltas from the master: the offer is named around the **Two-Way Recall** mechanism, "AI" stays out of the offer name (test in hooks only), and the rollover-to-continuity close is the DEFAULT, not a fallback.

**Status:** Campaign execution plan — ready to build funnel assets and launch.
**Offer:** Paid pilot ($1,250 one-time) → $499/mo continuity → full-system upsell. **No free offer.**
**Budget:** $1,000/mo test budget, Meta first.
**Companion docs:** [case-study-1-meta-ads.md](../case-study/case-study-1-meta-ads.md) (proof-layer creative C1–C10 + locked fact sheet), [offer-stack-stage1.md](../offer/offer-stack-stage1.md) (superseded free-test offer — economics/constraints context still valid), [case-study-1-village-recall.md](../case-study/case-study-1-village-recall.md) (case-study source of truth).

> **Visibility rule (standing):** Everything runs from the Dentiflow business Page + Business Manager.
> No Trevor face, name, or personal profile anywhere. No Dentiflow→32 Dental relationship shown.
> Scott Wills is the only approved on-camera face.

---

## 1. The offer (locked)

> **The 200-Patient AI Reactivation Pilot — $1,250 one-time.**
> We take 200 patients from your overdue list. Our AI texts them, answers their replies like your best
> front-desk person, and books the ready ones back onto your schedule. If it doesn't book patients worth
> more than the pilot costs, you get every dollar back. Want it on your whole list after? **$499/mo.**

**Rules that make it work:**

- **No price in ads or on the landing page.** Price is presented only on the sales call, immediately
  after the case-study proof ("$9,600 in production for ~$55 in texts... the pilot is $1,250").
  Qualification happens on the application form, not via price.
- **"AI" claim boundary (honest today):** the AI texts overdue patients, handles their replies
  conversationally, and drives them to book **via booking link**. Never claim autonomous PMS/API booking
  until the Ascend integration is live. If a prospect asks "is it really AI?" the answer must hold up.
- **What the practice does:** one overdue-patient export from their PMS + approve the message copy.
  That's their entire job.
- **Segment does triple duty:** caps solo delivery time, makes the guarantee mathematically safe, and
  builds the upsell ("that was 200 patients — you have [X] more").

### Guarantee terms (operationalized)

**"If fewer than 5 patients book within 30 days of the first send, full refund."**

5 bookings × ~$300 avg production ≈ $1,250 — the pilot literally pays for itself or it's free.

Why 200 patients and why 5 (case-study base rate 4.9% booked, ~$300 avg production):

| Segment size | Expected bookings | Refund risk on "≥5 or refund" |
|---|---|---|
| 100 | ~5 | ~40% — unsafe |
| 150 | ~7.4 | ~14% — marginal |
| **200** | **~9.8** | **~4% — safe** |

- **200 is the minimum segment.** If their export skews very stale (24+ months lapsed), upsize the
  segment to 250 or reset expectations on the call — decided at onboarding, never in the ad.
- Booking = an appointment scheduled in their PMS within 30 days, attributable to the outreach
  (link click or reply thread). Agree on the counting method on the onboarding call, before the send.
- A guarantee routinely honored builds the brand; one routinely refunded burns cash and reputation.
  Do not shrink the segment to close a deal.

---

## 2. The funnel — each asset sells only the next step

**Ad → case-study landing page → application form → instant auto-response → ONE after-2pm/weekend call
(close + onboard) → pilot delivers → $499/mo continuity → module upsells.**

The ad sells the application. The page sells the call. The call sells the pilot. The pilot sells
continuity. Continuity sells the system. No asset skips a step; no asset mentions price.

### 2a. Landing page — `dentiflow.ai/case-study-1`

Hormozi layout #3: **headline + sub-headline + image + 3 bullets + form.** Must match the ad 1:1
(same words, promise, visual).

- **Headline:** "$9,600 in new production from ~$55 in texts — off one practice's overdue list."
- **Sub:** "Our AI texted 657 overdue patients at a 3-location PPO group. 145 clicked. 32 booked.
  Now it can run on yours."
- **Image:** cleaned SMS-thread proof (apply the 4 render fixes from the shooting script) or the
  657→145→32 stat block.
- **3 bullets:** AI does the outreach *and* the replies — your team does nothing · Runs on 200 of your
  overdue patients first · If it doesn't book patients worth more than it costs, full refund.
- **No price on the page.**

### 2b. Application form (the Meta conversion event)

The form carries ALL qualification — it's what makes the one-call close possible:

1. Are you a PPO dental practice? (Y/N)
2. Roughly how many overdue/dormant patients are in your PMS? (<300 / 300–1,000 / 1,000+)
3. Are you the owner or decision-maker? (Y/N)
4. This is a paid pilot with a money-back guarantee — are you the person who can approve it? (Y/N)
5. Willing to do a 20-min call and provide a patient export? (Y/N)
6. Name · practice name · mobile · email

Auto-disqualify (polite decline page) on: <300 overdue, not decision-maker.

### 2c. Instant response — dogfood speed-to-lead

On submit, an automated SMS + email fires **immediately** (founder is at his day job 6am–2pm; the
funnel must not go quiet for 5 hours):

> "Got your application — here's the full case study while you wait: [URL]. Grab a time that works
> for you this evening or this weekend: [calendar link]."

Calendar shows **only after-2pm CT weekday + weekend slots.** This is also the credibility demo:
*the thing that answered you in 4 seconds is the product.*

### 2d. The one-call close (20–30 min — no discovery call, no follow-up call)

| Beat | Time | What happens |
|---|---|---|
| **Confirm** | ~5 min | Re-verify the form: PPO, list size, decision-maker on the line. "Before I walk you through it — you said about [X] overdue patients, right?" |
| **Proof** | ~5 min | Walk the case study: 657 texted, 145 clicked (~22%), 32 booked (~4.9%), ~$9,600 production, ~$55 in texts. Let the numbers do the selling. |
| **Offer** | ~5 min | The 200-Patient Pilot: what the AI does, what they do (one export + copy approval), the guarantee ("fewer than 5 bookings in 30 days, every dollar back"), **then the price — $1,250, first time they hear it, anchored right after the $9,600.** |
| **Close + onboard on the spot** | ~10 min | Take payment. Request the overdue export before hanging up ("can you have your office manager pull it tomorrow?"). Set the copy-approval step. Mention $499/mo exists only if asked — it's the after-pilot conversation. |

They hang up with the pilot already in motion. Nothing is deferred to a second call.

**Objection anchors:**
- *"How do I know it'll work on MY patients?"* → "That's exactly what the guarantee is for. If it books
  fewer than 5, you pay nothing. The risk is ours."
- *"Is this really AI?"* → "Yes — it reads each patient's reply and answers like a front-desk person
  would. Booking happens through a link today; the patient never knows they're not texting a human."
- *"Why only 200 patients?"* → "It's the proof batch. If it works on 200, $499/mo runs it on all of them,
  every month."
- *"Can you just send me info?"* → "The case study IS the info — you've seen it. The only question left
  is whether your list behaves like theirs, and the pilot answers that with zero risk to you."

---

## 3. Money & metrics ($100M Leads — Money & Metrics applied)

**Client-financed acquisition (the reason the paid pilot beats the old free offer):**
- Pilot GP ≈ $1,250 − ~$50 COGS (texts on a 200 segment) ≈ **$1,200 day-one gross profit.**
- **Self-funding loop: ONE pilot/mo covers the entire $1,000 ad month.** The machine runs indefinitely
  at 1 close/mo. Two closes = ~6:1 on the month before any continuity revenue.

**LTGP:CAC:**
- Continuity $499/mo at ~85% margin ≈ $425/mo GP. Assume 50% of pilots convert to continuity, ~8-mo
  average life → expected continuity GP ≈ $1,700/pilot. **LTGP ≈ $2,900.**
- Hormozi bar (CAC ≤ LTGP÷3) → **CAC ceiling ≈ $950/customer.**

**$1,000/mo allocation:**
- ~$33/day continuous. One campaign, one ad set (Advantage+ broad), 6–8 diverse creatives via Dynamic
  Creative, optimizing for the **Lead** (application) event.
- Refresh concepts every 2–3 weeks. One deliberate test per week (Hormozi cadence).
- Honest month-1 range at dental-B2B CPMs: **15–40 applications → 6–15 qualified → 3–8 calls →
  1–3 pilot sales.**
- Capacity check: 1–3 pilots/mo fits solo after-2pm delivery with the **3-concurrent-pilot cap**. If
  month 1 lands at the top of the range, the calendar is the constraint before the ad account is.

**Decision gates — pre-committed BEFORE the money is spent:**

| Outcome after month 1 (~$1,000) | Diagnosis | Next move |
|---|---|---|
| ≥1 pilot sold | Funnel works | Hold/raise budget funded by pilot fees; spin new hooks on the winning angle |
| Qualified applications, no close | **Sales problem, not ads** | Fix call script / guarantee framing / price anchoring. Do NOT touch targeting |
| Clicks but no qualified applications | LP/form problem | Rework LP promise-match, form friction level |
| No cheap clicks at all | Creative/hook problem | Swap first lines from the hook bank before killing any concept |

Month 1 is Track + Lose tuition that self-liquidates at a single sale. The deliverable either way is a
real **cost-per-qualified-application** number and a clear read on which gate you're in.

---

## 4. Creative — wave 1 (offer-led) + proof layer

The proof-layer concepts **C1–C10 and copy banks in [case-study-1-meta-ads.md](../case-study/case-study-1-meta-ads.md)
remain valid** — they back these up. Lead with the offer, close with the proof. All claims stay inside
that doc's **locked fact sheet** (§2 there) — non-negotiable.

Six offer-led concepts, each a different Hormozi call-out × value element so they don't cluster.
Design square (1:1) + vertical (4:5/9:16) statics of each; readable sound-off at thumbnail size.
**No price in any creative.**

### O1 — Guarantee-as-hero *(if-then call-out · risk reversal)*
- **HERO:** Our AI books your overdue patients back — or it's free.
- **SUB:** Done-for-you AI reactivation. Money-back guarantee.
- **Primary text:** "We take a segment of your overdue list. Our AI texts them, answers their replies
  like a real front-desk person, and books the ready ones back on your schedule. If it doesn't book
  patients worth more than the pilot costs, you get every dollar back. At one PPO group: 657 overdue
  patients texted, 32 booked, ~$9,600 in new production for ~$55 in texts. Apply below — takes 60 seconds."

### O2 — AI-does-the-labor *(label call-out · ease · front-desk WHO)*
- **HERO:** Your front desk can't chase 400 overdue patients. The AI texts all of them tonight.
- **SUB:** It answers their replies, too. Your team does nothing.
- **Primary text:** "Reactivating overdue patients works — nobody has time to do it. Our AI does the
  outreach AND the conversation: it texts your overdue patients, replies like your best front-desk
  person, and books the ready ones. One PPO group got 32 patients back (~$9,600 in production) from one
  overdue list. Money-back guarantee. Apply below."

### O3 — Sunk-cost reframe *(yes-question · PAST timeline — strongest new angle)*
- **HERO:** You already paid to acquire every patient in your overdue report.
- **SUB:** Getting them back costs text messages.
- **Primary text:** "Every name in your overdue report is a patient you already spent money to acquire.
  They didn't leave — they just stopped being reminded. Our AI re-opens the conversation and books the
  ready ones back. 657 texted at one PPO group → 32 booked → ~$9,600 in production, for about $55 in
  texts. If it doesn't book, you don't pay. Apply below."

### O4 — Competitor drift *(yes-question · negative FUTURE · rival WHO)*
- **HERO:** Every month they stay overdue, the practice down the street gets another shot at them.
- **SUB:** Your patients don't stay yours by default.
- **Primary text:** "Overdue patients don't stay dormant forever — eventually someone reminds them to
  book, and it's whoever texts first. Our AI reaches yours before that happens: it texts, handles the
  replies, and books the ready ones. Real result at one PPO group: 32 booked from 657 texted, ~$9,600 in
  production. Money-back guarantee. Apply below."

### O5 — Empty-columns *(label · dream outcome · hygienist WHO)*
- **HERO:** Holes in your hygiene schedule this week? Your own overdue list can fill them.
- **SUB:** AI reactivation — booked from patients you already have.
- **Primary text:** "The fastest way to fill hygiene columns isn't new-patient ads — it's the overdue
  patients already in your PMS. Our AI texts them, answers their questions, and books the ready ones.
  One PPO group put 32 patients (~$9,600) back on the schedule for ~$55 in texts. If it doesn't book,
  it's free. Apply below."

### O6 — Ridiculous-result *(ridiculous-result call-out · the locked ratio as pure curiosity)*
- **HERO:** $9,600 of dentistry from $55 in text messages.
- **SUB:** One PPO group's overdue list. Real numbers.
- **Primary text:** "Not a projection — a real result. 657 overdue patients at a 3-location PPO group got
  a text sequence that reads like a real front desk. 145 clicked (~22%). 32 booked (~4.9% — typical is
  1–3%). ~$9,600 in new production for about $55 in text cost. Now it runs on AI, and it can run on your
  list — with a money-back guarantee. See how it works below."

### Wave-1 launch matrix (Dynamic Creative ON, 1 ad set)

| Ad | Concept | Destination | Notes |
|---|---|---|---|
| A1 | O1 Guarantee-as-hero | Instant Form | The risk-reversal headline — expected volume leader |
| A2 | O3 Sunk-cost reframe | Landing page | The freshest angle — watch it closely |
| A3 | O2 AI-does-the-labor | Instant Form | The "AI" hook, ease element |
| A4 | O6 Ridiculous-result | Landing page | Pure curiosity → proof page does the selling |
| A5 | C9 Founder-note (low-fi static, from meta-ads doc) | Landing page | Native-feel diversity; update its copy to pilot framing |
| A6 | V1 Proof-flash video (from meta-ads doc, no face) | Instant Form | Format diversity for the algorithm |

Wave 2 (weeks 3–4): O4, O5, C5 SMS-thread proof, V2 Scott cut, carousel for the retargeting pool.

### Hook bank (~20 first lines — swap these before killing any concept)

The first line of primary text is the single biggest lever. All stay inside the locked fact sheet.

1. We texted 657 overdue patients. 32 booked.
2. $55 of text messages turned into ~$9,600 of dentistry.
3. You already paid to acquire every patient in your overdue report.
4. Your front desk doesn't have time to chase 400 overdue patients. The AI does.
5. How many patients haven't you seen in 18 months? The number is bigger than you think.
6. Your overdue list is the cheapest production you'll book this year.
7. Every month a patient stays overdue, another practice gets a shot at them.
8. Holes in your hygiene columns? Your own chart can fill them.
9. Most recall is a discount blast nobody answers.
10. One generic recall text gets ignored. A conversation gets a booking.
11. Overdue patients don't leave — they just stop being reminded.
12. A former 50-location DSO CFO tested this on his own practice.
13. You're paying for new patients while hundreds sit overdue in your chart.
14. The patients most likely to book aren't strangers — they're already in your PMS.
15. What would 10 reactivated patients do to this month's production?
16. Recall texts that read like your front desk — not like a robot.
17. 22% of overdue patients clicked the booking link. Typical is 2–5%.
18. 4.9% of a dormant list booked. Typical is 1–3%.
19. Your hygiene schedule has holes. Your overdue report has the fix.
20. If your overdue report has 300+ names on it, read this.

### CTA bank (application-funnel aligned)

| Meta CTA button | Closing line | Destination |
|---|---|---|
| **Apply Now** | "Takes 60 seconds — see if your practice qualifies." | Instant Form |
| **Learn More** | "See exactly how it worked." | Landing page |
| **Sign Up** | "Apply for the pilot." | Landing page form |

Never "Get Offer" with dollar language; never promise the viewer a specific result — the $9,600 is the
case study's result, the guarantee is about *their* pilot.

---

## 5. Targeting & campaign structure

- **1 campaign · Leads objective · 1 ad set · Advantage+ broad**, seeded with a dental-operator interest
  stack (dental practice owner, DSO, practice management, Dentrix, Eaglesoft, Open Dental, Weave, dental
  CE) — then let it expand. The self-qualifying hooks do the real targeting; don't fragment $1k/mo.
- **Destination test:** Instant Form vs landing page as separate ads in the same set. Judge on
  **cost-per-QUALIFIED-application** (passes the form gates), never raw CPL.
- **Geo:** Midwest first (matches the proof + Scott's network). **Exclude the founder's local market.**
  Expand on winners.
- **Retargeting:** none in month 1 (pool too small). From month 2, ~10% of budget on site visitors +
  50%-video viewers, served the C10 carousel + V2 Scott cut.
- **Reading cadence:** first read day 3–5; don't fiddle daily; kill an ad only after swapping its first
  line once; refresh with new *concepts* (not restyles) every 2–3 weeks.

---

## 6. The upsell ladder — earned, then paid-retargeted

1. **Pilot → continuity (built-in):** "That was 200 patients. You have [X] more. $499/mo runs it on all
   of them, every month." Rollover mechanic if needed to close: credit the pilot fee toward the first
   month(s).
2. **Continuity → next module:** offered only when the practice *feels* the next leak ("they book but a
   third no-show," "they come in but we get no reviews"). Deliver-only-what's-built ladder:
   **AI recall → speed-to-lead → dashboard.** Reviews, no-show, and AI voice join as they ship — never
   sell a module that can't be turned on.
3. **Paid-ads role at scale:** custom audience of pilot buyers + continuity customers served
   rest-of-the-system creative after their recall win — Hormozi's "New," funded by pilot cash.

---

## 7. Guardrails (non-negotiable)

- **Claims:** locked fact sheet only ([case-study-1-meta-ads.md](../case-study/case-study-1-meta-ads.md) §2). No
  "vs 0"/A-B framing · no dollar promise to the viewer · no competitor takedowns · no invented numbers ·
  "AI texts, replies, and gets them booked" — never "books directly into your PMS" (not yet true).
- **Delivery:** 3 concurrent pilots max. 200-patient minimum segment. Guarantee counting method agreed
  before the send.
- **Twilio (April-8 rules):** 1 msg/sec, balance + suspension-risk check before every new practice's
  send. All recall-launch gates apply to pilot sends: `--location` required, sequences created paused,
  patient count shown and explicitly confirmed before anything sends.
- **Visibility:** Dentiflow Page/BM only; no Trevor anywhere; local geo excluded; Scott = only face.
- **Compliance:** B2B audience, no PHI, no personal-attribute implication; guarantee wording
  consumer-claims-safe.
- **Employment clause:** confirm SourceClub's agreement permits the side business **before spend** —
  this predates and trumps everything.

---

## 8. Pre-launch checklist

**Build (in order):**
- [ ] Landing page live at `dentiflow.ai/case-study-1` (layout §2a, no price)
- [ ] Application form with qualification gates (§2b) + polite-decline path
- [ ] Instant SMS + email auto-response wired (§2c) + after-2pm/weekend calendar
- [ ] Dentiflow business Page + Business Manager + Pixel + CAPI installed
- [ ] Payment link ready for the close call (Stripe or equivalent)
- [ ] Wave-1 creatives designed (A1–A6, square + vertical)

**Verify (before a dollar is spent):**
- [ ] SourceClub employment clause confirmed clear
- [ ] Funnel dry-run: test application → lead lands → instant response fires → calendar slots correct
- [ ] Lead event confirmed in Meta Test Events (Pixel AND CAPI)
- [ ] AI-SMS path run end-to-end on a small internal list at 1 msg/sec
- [ ] Guarantee terms + counting method written into the onboarding template

**Launch:**
- [ ] Ads submitted for review at $0 budget → approved → live at ~$33/day
- [ ] First read day 3–5 on cost-per-qualified-application
- [ ] Month-1 decision gates (§3) — pre-committed, no mood-based reads

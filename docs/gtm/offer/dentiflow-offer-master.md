# Dentiflow Offer — MASTER (Single Source of Truth)

**Status:** CANONICAL as of 2026-08-05. All other docs defer to this one on offer terms.
If a campaign doc, script, or landing page conflicts with this file, this file wins.
**Owner:** Trevor

**Major revision 2026-08-05.** The front-door offer was re-architected: $1,250 → **$2,000**,
200/300-patient segment → **500**, 5-booking guarantee → **12**, $499/mo continuity → **Chair Watch**
(priced off their own hygiene fee). The reactivation SKU is now explicitly a **foot in the door** for
the system sale, not a revenue product in its own right. Every change and its reasoning is in this file.

**What defers to this doc:** [reactivation-offer-locked.md](./reactivation-offer-locked.md) (the
handoff-ready spec for the reactivation SKU — same terms, expanded messaging assets),
[dentiflow-ai-reactivation-ads.md](../ads/dentiflow-ai-reactivation-ads.md) (campaign execution),
[case-study-1-meta-ads.md](../case-study/case-study-1-meta-ads.md) (proof-layer creative),
`.claude/skills/ad-director/context/locked-facts.md` (the ad-generation fact fence), all
case-study distribution copy.

**Superseded:** [offer-stack-stage1.md](./offer-stack-stage1.md) (free-test era — do not use).
Anything dated before 2026-08-05 that names $1,250, a 200- or 300-patient segment, a 5-booking
guarantee, or $499/mo is stale.

---

## 1. The offer in one line

> **The 30-Day Empty Chair Sprint — we take 500 patients from one location's overdue list, our AI
> runs two-way text conversations with them, and books the ready ones into the reactivation blocks
> you set aside. Fewer than 12 booked in 30 days and we keep working free until you get there.
> $2,000 one-time. After that, less than the price of one hygiene visit per month to catch every
> patient who leaves without their next appointment on the books.**

The ad never says the price. The ad sells the application. The application sells the call. The call
sells the sprint. **The sprint sells the system.**

---

## 2. The strategic decision: reactivation is the front door, not the business

The full system is where the money is. It is also the wrong thing to advertise. Ads lead with
**one component — dormant-patient reactivation** — because:

1. **It's the only proven component.** One locked case study (657 texted → 145 clicked → 32 booked
   → ~$9,600 production, from a 3,926-patient list). Everything else is a promise; this is a receipt.
2. **It's a "found money" offer, not a "future growth" offer.** The practice *already paid* to
   acquire every name on that report. We recover sunk cost — certain money — instead of promising
   uncertain gains. Leaky-bucket offers beat inflated-claim offers at every scale.
3. **It self-qualifies.** "500+ overdue patients at one location" is only true of an established,
   producing practice. Meta optimizes toward the cheapest lead in any market — the problem callout
   itself is the wealth floor.
4. **Small step, not big leap.** We add bookings to an already-working practice. Highest-probability
   fulfillment promise there is, and at 500 patients the guarantee is mathematically safe.
5. **Conveyor belt.** One entry SKU means every client arrives with the same problem, the same
   onboarding, the same delivery, the same proof format. That's what makes solo, after-2pm delivery
   possible — and what makes the next case studies cheap to produce.

### The sprint's real job (decided 2026-08-05)

**The sprint is not a revenue product. It is a demonstration purchase whose real output is the right
to have the system conversation.** Three consequences that override older guidance in this file:

- **Optimize for yes-rate and time-to-close, not ACV.** Deal size comes from what's behind the door.
- **The door is flat-priced, never per-location.** $2,000 whether they run 3 offices or 7. Per-location
  pricing belongs on the system, not the entry — a 5-location group quoted $10,000 upfront is not a
  stupid-easy yes, which is the entire point of a front door.
- **The sprint's artifacts are system-sale collateral.** The Chair Report, the Whole-Ledger Audit, and
  the Conversation File must surface *other* leaks, not just recall results (§4). If the deliverable
  only ever reports recall, we've trained the client that recall is the whole relationship.

**Advertising a "system" in this market is a commodity claim.** Every dental vendor says
"all-in-one platform." Nobody else says "we'll put 12 of your own lapsed patients back on the
schedule in 30 days or we work free." The system gets sold *inside* the relationship (§9), never
inside the ad.

---

## 3. The named mechanism: **Two-Way Recall**

Dental recall is a sophistication-stage-3/4 market — every owner has heard recall promises from
Weave, RevenueWell, postcard vendors, and their own front desk. At this stage, claims and guarantees
alone underperform; the offer must carry a **mechanism**: why everything they tried failed, and why
this is different.

**Naming decision, 2026-08-05.** "Ledger-to-Chair" was proposed as a replacement and **rejected as
the ad-facing mechanism name.** A mechanism's job is to explain why everything they tried failed and
why this works. "Two-Way Recall" does that in three words — the one-way/two-way contrast needs no
explanation and survives a three-second scroll. "Ledger-to-Chair" names a path but needs a paragraph
to land: fine on a call, useless in a headline. **The genuine upgrade was the three named stages
below, not the name.** "Ledger-to-Chair" may be used as the *process* name on a landing page, VSL,
or sales call. Never as the ad-facing mechanism.

**The mechanism paragraph (use verbatim in ads, landing page, and on the call before the price reveal):**

> Most recall is one-way. Postcards, no-reply text blasts, a front-desk call list nobody finishes.
> One-way messages get ignored because the patient's real blockers — "how much will this cost?",
> "who is this?", "I can't deal with scheduling right now" — never get answered. So the patient does
> nothing, and the practice concludes recall doesn't work.
>
> We run **Two-Way Recall**: the AI opens the conversation, and when the patient replies, it answers
> like your best front-desk person — handles the cost question, the insurance question, the "can I
> come Saturday?" question — and walks them to a booked appointment. Then it books them into the
> blocks you set aside. That's why 657 texts produced 145 clicks and 32 booked patients, when a
> typical one-way blast books 1–3%.

### The three stages (longer-form copy, VSL, landing page, sales call)

1. **Ledger Sweep** — every overdue patient pulled and scored: months since last visit, remaining
   insurance benefits, diagnosed treatment sitting unscheduled, production history. The list stops
   being a blob and becomes a ranked queue. **Waves are blended** — roughly 60% recently-overdue,
   40% deep-overdue, same recipe every time — so we never burn the best patients in wave one and the
   booking rate holds in month four instead of decaying.
2. **The Conversation** — two-way AI text that answers the three real blockers and handles the reply,
   the follow-up question, and the reschedule.
3. **Chair Lock** — the patient picks a time from the reactivation blocks the practice set aside,
   and it lands on their schedule, attributed back on a live dashboard.

### Reactivation blocks (added 2026-08-05 — a real mechanism upgrade)

The practice sets aside **two 3-hour windows per week** for returning patients. We only book into
those. Unfilled slots release back to the front desk 48 hours out — non-negotiable, it's what stops
them resenting empty reserved time.

Why this matters more than it looks:
- **Works with any PMS, day one.** No integration dependency, so the addressable market isn't gated
  by an API.
- **Makes "books onto your schedule" literally true** without claiming a PMS write.
- **Guarantees supply.** No availability is the silent killer of every reactivation campaign — if the
  schedule is full, bookings can't happen and our guarantee eats it.
- **Commitment device.** A doctor who sets aside chairs is invested before the first text sends.
- **Kills the front-desk objection:** "we only book into the windows you gave us."

### Naming rules

- **"AI" stays out of the offer name.** Dentists don't wake up wanting AI — they want full hygiene
  chairs. AI is the *how*, never the *what*. Test it in hooks; the offer name never depends on it.
- **Claim boundary (non-negotiable):** ✅ "books them onto your schedule" / "into the blocks you set
  aside." ❌ "writes directly into your PMS" / "integrates with Dentrix or Open Dental." The Open
  Dental write path is built but **untested** — reactivation blocks make the strong claim honest
  regardless, so this is an efficiency upgrade, not a blocker.

---

## 4. The offer stack (what the prospect gets)

Presented on the call as a stack, not a feature list — each element answers a fear:

| Element | What it is | The fear it kills |
|---|---|---|
| 500-patient overdue segment | We select, score, and run 500 from their export at one location | "Will this spam my whole patient base?" |
| Done-for-you everything | One export, one copy approval, two blocks a week. That is their entire job | "I don't have time for another tool" |
| Two-Way Recall engine | AI outreach + AI reply handling, partner-reviewed message bank, safety rails (opt-out, emergency escalation, compliance validator) | "Will a robot embarrass my practice?" |
| Reactivation blocks | They tell us which chairs to fill; we only book into those windows | "Will this wreck my schedule?" |
| Booked-patient attribution | Named list of who booked, verified against their schedule, agreed counting method | "How do I know it worked?" |
| Live dashboard access | Watch clicks and bookings land in real time during the sprint | "How do I know anything is happening?" |
| The guarantee | Fewer than 12 in 30 days → we keep working free until 12. **Plus** a 14-day unconditional refund | "What if it doesn't work on MY patients?" and "are these guys amateurs?" |

**Bonuses — named at the close, each with its own line. Presented as bonuses, never silent scope,
because unnamed work adds zero perceived value.**

1. **The Chair Report** — end-of-sprint artifact: full funnel breakdown, named booked-patient list,
   and **the other leaks we saw while we were in there** (no-shows on their schedule, unscheduled
   treatment in the ledger, calls that went unanswered during the window). This is the system close
   in disguise.
2. **The Whole-Ledger Audit** — we size their *entire* overdue base **across every location**, plus
   the unscheduled-treatment value. Zero marginal cost: we parse the full export anyway. This is the
   number that later makes a system install feel small.
3. **The Conversation File** — anonymized transcripts of every AI conversation from their sprint,
   plus **the questions patients asked that nobody at the practice answered.** Doubles as the
   control-story asset for AI-hesitant owners and as the speed-to-lead pitch, written by their own
   patients.

**Design rule for all three:** every artifact must sell for us in a room we're not in. A 3–7 location
group has partners. Whatever we hand over gets forwarded — build it to survive that.

**Dream outcome:** production they already paid for, back on the schedule, with zero staff effort.
**Time-to-first-value:** first bookings typically within days of the first send — say this on the
call; speed is a value multiplier. First send inside 72 hours of receiving the export.
**Effort & sacrifice:** one export, one copy approval, two blocks a week. Protect this as the moat
deepens — every task removed from the practice justifies the next price tier.

---

## 5. Terms (locked 2026-08-05)

- **Sprint: $2,000 one-time.** One location, 500 patients, 30 days. **Same price whether they run 3
  offices or 7.** Presented only on the call, after the case-study proof. Never in ads, creative, or
  landing page.
- **Segment: 500 patients per location. Always.** Never smaller to close a deal, never larger without
  a fee. One segment size means one onboarding, one send plan, one guarantee calculation, forever —
  that's the conveyor belt. It also permanently ends the 200-vs-300 drift that broke earlier versions
  of this file.
- **Performance guarantee: fewer than 12 booked appointments within 30 days of first send → we keep
  working that location free until they hit 12.**
- **Unconditional guarantee: full refund inside the first 14 days, any reason, no conversation.**
- **Counting method agreed in writing before the first send:** a booking = appointment scheduled
  within 30 days of first send, attributable to a link click or reply thread. **The clock starts on
  first send** — not payment, not signature.
- **Continuity — "Chair Watch": the nearest $50 *below* one hygiene visit at their own fee schedule,
  per location, per month.** Starts day 31, full price. Roughly: $180 visit → $150/mo · $240 → $200 ·
  $300 → $250 · $360+ → $300.
- **Split-pay fallback: 2 × $1,100** (total $2,200) — the ONLY downsell. Terms change, the price never
  does, and pay-in-full stays the visibly better deal. Never a smaller segment, never a discount.
- **Capacity: 3 concurrent sprints.** Real scarcity — state it truthfully and never oversell past it.
- **Single location only** until multi-location isolation ships (§10 gate 3).

### Why $2,000 — the derivation

Everything prices off one verified number: **$9,600 ÷ 657 texted = $14.61 in production per overdue
patient contacted.**

| Step | Figure |
|---|---|
| Patients worked per location | 500 |
| Booking rate (verified: 32/657) | 4.87% |
| Expected bookings | **~24** |
| Avg production per booking (verified) | $300 |
| **Expected production per sprint** | **~$7,200** |
| Guarantee floor (12 × $300) | **$3,600** |
| Price | **$2,000** |

- **3.6:1 on expected production**, provable with their list size and our verified rate. Not a claim — arithmetic.
- **The guarantee floor is 1.8x the fee.** Worst case, they still make money. That sentence is only
  sayable because the price sits below half the floor. Price and guarantee are one decision, not two.
- **Under the single-signature threshold.** Cross $10k and you add a decision-maker and three weeks.
- **Paid = qualified.** A group that won't pay $2,000 will never buy the system.
- **~97% gross margin.** Marginal cost is ~$42 in texts (500 × $0.083), which is also why the
  guarantee remedy is "we keep working" rather than a refund — a miss costs ~$42, not $2,000.
- **It raises the ceiling behind it.** A $500 door makes a $5,000 install feel like a 10x leap; a
  $2,000 door makes it a 2.5x step. We are pricing the *next* sale right now.

**On price integrity vs. §11's trigger:** the old rule said don't raise the pilot until three
arms-length case studies land. The move from $1,250/300 patients to $2,000/500 patients is
**$4.17 → $3.00 per patient — a 28% cut in unit price.** More work, more money, cheaper per unit.
Price integrity is intact.

**Guarantee safety math** (normal approximation, n=500):

| True booking rate | Expected | Floor | ≈ Risk of a miss |
|---|---|---|---|
| 4.87% (verified) | 24.4 | 12 | **~0.4%** |
| 3.5% (cold list) | 17.5 | 12 | ~7% |
| 3.0% (worst case) | 15.0 | 12 | ~18% |

Even the worst case costs ~$42 in texts, so expected guarantee cost is single-digit dollars per
location. That is what makes a 12-booking promise affordable where 5 was leaving value on the floor.

**Do not script a fixed multiple.** Never say "double your money." Compute it live from their number:
*"twelve times your $280 is $3,360 against $2,000."* More persuasive, and it self-corrects at any fee
level. At hygiene fees under ~$170 the floor stops covering the fee — that's why the fee question is
a qualification gate (§7).

### The rollover credit — where it points

**The $2,000 credits toward the system install ONLY. Never toward Chair Watch.**

At $200/mo, a $2,000 credit buys ten free months of prevention — and worse, it *satisfies* them. They
take the free months, feel handled, and the system conversation never happens. The foot in the door
becomes the ceiling. Chair Watch is a $200 decision; it doesn't need a discount. The credit stays in
our pocket as the lever for the sale that actually matters.

### Debrief routing by list depth

The dormant list is finite, so the post-sprint move depends on how much is left:

| Their list at that location | Debrief route |
|---|---|
| **~500–800** | Skip Chair Watch. Go straight to the system conversation. Not enough inventory to justify a retainer, and selling one sets up a month-4 cancellation that poisons the system sale |
| **800+** | Chair Watch is legitimate. Offer it, or use it as the decoy that makes the install the serious choice |

---

## 6. Why each piece exists (the psychology map)

| Lever | Where it shows up |
|---|---|
| **Loss aversion / sunk cost** | "You already paid to acquire every patient on your overdue report." Recovering a loss beats an equivalent gain — this is the lead frame in copy. |
| **Certainty over promise** | Found money (patients they own) vs. speculative growth (new-patient ads). We sell the sure thing. |
| **Stacked risk reversal** | Two guarantees, two different fears, two different clocks. The 14-day out kills "are these guys amateurs"; the 12-booking floor kills "will it work on MY patients." The 14-day window closes *before* the result is known, so it can't be gamed for attribution. |
| **Anchoring** | The $9,600 case-study number lands ~60 seconds before "$2,000." |
| **Their number, not ours** | Chair Watch is a formula off their own fee schedule, and sprint ROI is computed live from their inputs. Nobody negotiates against arithmetic they supplied. |
| **Price below one unit of value** | Chair Watch sits under the value of a single hygiene visit, so the product cannot have a losing month. Same logic as the sprint's floor exceeding its fee. |
| **Commitment device** | Setting aside blocks invests the doctor before the first text sends. |
| **Default effect** | The system install is the natural next step at debrief, not an upsell decision. |
| **Paid = qualified** | $2,000 keeps the funnel full of owners, not tire-kickers, and finances the ads. |
| **Real scarcity** | 3 concurrent sprints is true. Truth scales; fake countdown timers don't. |

---

## 7. Qualification floor (application form gates)

PPO practice · **500+ overdue patients at the target location** · owner or managing partner ·
can approve a paid engagement with a money-back guarantee · willing to do a 20-min call, provide a
patient export, and set aside two blocks a week · **must state their hygiene visit fee** ("what do
you charge for a cleaning, exam, and x-rays?"). Auto-decline below the floor.

**The fee question does triple duty:** it prices Chair Watch, it pre-computes sprint ROI before the
call starts, and it's a wealth filter that costs the applicant nothing to answer.

**The gate stays at 500, deliberately.** An earlier proposal to raise it to 800 (so every client has
month-2 continuity inventory) was rejected — it solves for the retainer, and the retainer isn't the
point. The gate's job is to make it stupid easy to say yes. List depth is handled by debrief routing
instead (§5).

**Golden segment to write copy at:** owner or managing partner of a **3–7 location PPO group** —
established, high-producing, visibly leaky hygiene schedule, wants *nothing to do with doing it
themselves*. This owner pays more, churns less, and never takes it in-house. Gut-punch that picture
("holes in your hygiene columns while 500 of your own patients sit overdue"), never generic
"grow your practice."

---

## 8. The call: one-call close + component routing

20–30 minutes, no discovery call, no follow-up call:

1. **Confirm** (~3 min) — re-verify form answers; decision-maker on the line.
2. **Diagnose** (~5 min) — one question: *"Across your locations, where does it leak worst — patients
   who stop coming back, calls nobody answers, or booked patients who no-show?"* Write it down; it's
   the system conversation later, not today's sale. Then the math question: *"How many patients are
   past due at your biggest location, and what's a hygiene visit worth to you?"* Say both numbers
   back — **they are the proof, not ours.**
3. **Mechanism** (~5 min) — the Two-Way Recall paragraph (§3), *before* price. It converts "sounds
   too good" into "oh, that's why it works."
4. **Proof** (~3 min) — 657 / 145 / 32 / ~$9,600, from a 3,926-patient list. Then get in front of the
   relationship: *"Full transparency — this was run at a group I have a relationship with. That's
   exactly why I can show you every message we sent and every conversation the AI had. Want to see
   the threads?"* Then show them. Demonstration beats testimonial.
5. **Their number** (~2 min) — computed live: *"You said 600 past due and $280 a visit. We work 500.
   At the rate we saw, that's roughly 24 bookings, about $6,700."* Never promise it — show the
   arithmetic on their inputs and let them decide.
6. **Stack + guarantee** (~4 min) — walk the stack (§4), name every line, then both guarantees, then
   the counting method. **Volunteer the definition of success before they ask** — with one case
   study, that's the strongest trust move available.
7. **Price + close** (~5 min) — $2,000, anchored after the $9,600 and after their own number. Take
   payment, request the export before hang-up, set copy approval and blocks.

**Routing rule:** whatever leak they named in step 2 becomes the system pitch at debrief — never a
module that can't be turned on, and never route away from the sprint itself. Reactivation is the
entry SKU for everyone, because it's the one with the guarantee and the proof.

---

## 9. Ascension ladder

**No middle SKU.** A "roll the sprint out to your other locations" tier was rejected — it competes
with the system install and caps us at sprint money. When they want the rest of the group worked,
that's what the install buys.

| Step | What | Price | Job |
|---|---|---|---|
| 1 | **Empty Chair Sprint** — 1 location, 500 patients, 30 days | $2,000 flat | Earn trust. Produce the Whole-Ledger Audit |
| 2 | **Chair Watch** — every patient who leaves without a next appointment | Nearest $50 below one hygiene visit, per location/mo | Stay wired in. ~99% margin |
| 3 | **System install** — covers all locations, sweeps the rest of the ledger | $2,000 credits in | Where the money is |

**Chair Watch is a utility, not a partnership.** Sell it in 60 seconds at debrief. No QBRs, no
strategy calls, no monthly check-in. The moment it becomes The Relationship, the client feels handled
and the system sale dies. Bill it, run it, keep the system conversation on its own track. **The
monthly report must keep the other leaks visible** — bookings caught, running unscheduled-treatment
total, missed calls if we can see them.

**What Chair Watch actually catches** — this definition is load-bearing. "Newly overdue" alone is
~20–25 patients/month, which at a ~5% booking rate is roughly break-even against the fee, and a
break-even product gets cancelled in month three. The definition is **every patient who leaves
without their next appointment on the books:**

| Monthly inventory | Rough volume per location |
|---|---|
| Newly lapsed (blew past their recare date) | ~20–25 |
| Walked out at checkout without rebooking | ~15–30 |
| Cancelled or failed, never rescheduled | ~10–20 |
| Left with diagnosed treatment they never scheduled | varies — **highest dollar value** |

That's 50–75 patients a month and the treatment slice converts at crown money, not cleaning money.
*(Verify the checkout-rebooking and unscheduled-treatment feeds exist in the PMS export before
selling on them — if they're a build, say so.)*

**Location → group is blocked until multi-location isolation ships** (§10 gate 3). Sell single-location
sprints and ship isolation during the first 30 days.

---

## 10. Stage 2 — full build-out architecture (PRE-DESIGNED, GATED OFF)

**Decided 2026-07-10; still the plan.** Once the full system ships, the default post-sprint close
becomes the system install. This is the pre-committed design so it doesn't get re-litigated
deal-by-deal — but **nothing here is sellable until the gates clear.**

**Gates (all required):**
1. All six modules built and live: recall, speed-to-lead, no-show recovery, reviews/referrals, AI
   voice receptionist, dashboard
2. System-level guarantee math done — per-module expected-value table, same rigor as the sprint's
   12-booking floor
3. Multi-location isolation shipped before any group/DSO sale

**What changes and what doesn't:**
- **The sprint stays the front door, unchanged** — same ad, same $2,000, same guarantee. Cold traffic
  still can't be sold a $5k install. The sprint's job is already "paid diagnostic + trust engine for
  the system sale" (§2) — Stage 2 just gives it something bigger to hand off to.
- **The debrief pitch order flips: premium first.** The install is presented as the *recommendation*,
  built from their diagnosis answers and their own sprint numbers. Chair Watch becomes the deliberate
  fallback and works as the decoy. Sorting frame: "keep patching this one leak, or fix the boat?"
- **Rollover mechanic already points here:** the $2,000 credits toward the install.

**Positioning rule (the most important line in this section): price against payroll, never software.**
At a few hundred a month the buyer compares us to Weave and we win. At $3–5k/mo we cannot win a
software comparison — so run the staffing comparison instead: a full-time front desk employee costs
roughly $3,500–4,500/mo fully loaded *(validate locally before quoting)*, works 8 hours, and never
chases the overdue list. The system is an **AI front office** — answers every call, texts every
overdue patient, chases every no-show, asks for every review, 24/7. Against a hire, the retainer is
cheap.

**Terms (all figures are PROPOSALS — set final numbers from real attributable-production data):**
- **Install: ~$5,000 one-time**, sprint fee credited in.
- **Retainer tiered by practice size:** ~$2,500–3,500/mo single location; scales per location for
  groups. A blanket $3–5k on small practices will churn on ROI; tiering is not optional.
- **Founding-client cohort:** first 3–5 system clients at ~$3k/mo locked, in exchange for the case
  study. The early deal's real product is proof.

**Why Stage 2 is the only model that fits the capacity constraint:** solo after-2pm delivery can
white-glove ~8–12 accounts. At Chair Watch pricing that's a few thousand a month forever; at
$3.5–4k/mo it's $30–45k/mo inside the same hours. The premium model is the only architecture where
revenue isn't capped by the calendar.

**System-level guarantee: do not wing it.** "The system pays for itself or we keep working free"
needs a per-module expected-value table built from real data before it enters any script. The
sprint's guarantee works because 500 × 4.87% makes a miss a sub-1% event. Stage 2 gets the same
treatment or no guarantee is offered beyond the sprint's. **This is the long pole** — a $5,000 offer
with no guarantee is a trust downgrade from a $2,000 offer that has one.

---

## 11. Pricing evolution (pre-committed triggers — don't re-litigate in the moment)

$2,000 + Chair Watch is **proving-ground pricing**. Category kings are the most expensive in their
niche; price is the flywheel's initial condition. But premium pricing needs proof volume we don't
have yet.

| Trigger | Move |
|---|---|
| Yes-rate on qualified calls under ~30% after 10 calls | Drop the sprint to $1,500 and re-measure. **Price moves on data, not on the first three "let me think about it"s** |
| 3 arms-length (non-32 Family Dental) sprint case studies delivered | Raise the sprint to ~$2,500–3,000. Keep the guarantee math — raise the floor proportionally only if verified avg production supports it |
| 10+ proof assets / waitlist forming | Raise Chair Watch's index (e.g. *at* one hygiene visit rather than below it); introduce module tiers |
| Open Dental / Ascend write path live and tested | Price the deeper DFY in — every task removed justifies a tier, and the claim boundary (§3) relaxes |
| All six modules live + guarantee math done | Activate Stage 2 (§10): debrief pitches the install first, Chair Watch becomes the decoy |

Rule: grow revenue by **raising price and attaching modules**, not by adding client count past what
solo after-2pm delivery can hold. Never estimate the new numbers — pull avg production and conversion
from actual sprint data before each move.

---

## 12. Ad-copy rules (non-negotiable)

- **No price anywhere** in ads, creative, or landing page.
- **Claims: locked fact sheet only** — 657 / 145 (~22%) / 32 (~4.9%) / ~$9,600 / 3,926 total list
  (~17% worked). No "vs 0" A/B framing. No dollar promises to the viewer — the $9,600 is the case
  study's result; the guarantee is about *their* sprint.
- **No cost anchored to a result.** The ~$55 text cost is permanently retired from all ad creative
  (Trevor, 2026-08-03). Every number in an ad must be something the practice *gets*, never a spend
  figure. The $55 remains true and usable on a sales call.
- **"Two-Way Recall" mechanism language** in at least one live ad variant at all times.
- **Never "Get Offer" CTA with dollar language.** Apply Now / Learn More / Sign Up only.
- **Visibility:** Dentiflow Page/BM only, no Trevor anywhere, Scott is the only face, founder's local
  market excluded.
- **Public name is "32 Family Dental."** Never "Village Dental" or "32 Dental" in outward-facing copy.
- **Compliance:** B2B audience, no PHI, no personal-attribute implication, guarantee wording
  consumer-claims-safe. All Twilio April-8 safety rules apply to every send.

---

## 13. What was considered and rejected (so it stays rejected)

| Option | Why not |
|---|---|
| Free test / free trial lead offer | Retired 2026-07. No wealth floor (Meta optimizes to broke), delivery drowns solo capacity, and paid cash finances the ads. |
| Advertising "the full AI revenue system" | Commodity claim in a stage-3/4 market; big leap for a cold stranger; nothing to guarantee; delivery not fully built. |
| Speed-to-lead as the lead offer | Built, but unproven, harder to attribute fast, and doesn't self-qualify. First attach, not the entry. |
| Audit / assessment lead magnet | Adds a funnel step and sells thinking instead of outcome. |
| Discounted sprint to close hesitators | Never. Price integrity is the category-king flywheel. The guarantee is the concession; split-pay changes terms, not price. |
| Automatic "both" guarantee for the *same* failure (refund + keep-working) | Rejected 2026-07-13. Buys zero conversion, costs a refund plus a free-work obligation, and rewards attribution disputes. **Note:** the current two-guarantee structure is different and survives this objection — different fears, different clocks, and the 14-day window closes before the result is known. |
| Pre-price annual anchor | Rejected 2026-07-13. The case-study anchor does the job; keep the price reveal clean. |
| Next-cohort hold + free audit for "not now" prospects | Rejected 2026-07-13. |
| **Per-location sprint pricing ($2,000 × N locations)** | **Rejected 2026-08-05.** A 5-location group quoted $10,000 upfront is not a stupid-easy yes, and the front door's only job is the yes. Per-location pricing belongs on Chair Watch and the system, not the entry. |
| **Smaller "half" segment (250 patients) as a downsell** | **Rejected 2026-08-05.** Shrinking the segment breaks the guarantee math, which is the only thing holding the promise up. Split-pay is the only downsell. |
| **Rolling the $2,000 credit into Chair Watch** | **Rejected 2026-08-05.** It buys ~10 free months and, worse, satisfies them — they feel handled and the system conversation never happens. The credit points at the install only. |
| **Raising the qualification gate to 800+ overdue** | **Rejected 2026-08-05.** It solves for continuity inventory, and continuity isn't the point. The gate's job is an easy yes. List depth is handled by debrief routing (§5). |
| **Renaming the mechanism to "Ledger-to-Chair" in ads** | **Rejected 2026-08-05.** "Two-Way Recall" self-explains in three words and survives a 3-second scroll; "Ledger-to-Chair" needs a paragraph. The real upgrade was the three named stages, not the name. Ledger-to-Chair is fine as the process name on a call or landing page. |

# Competitor teardown — reading someone else's ads and taking what transfers

Used by `recon` mode. The goal is never "make a similar ad." It's **extract the structure that's
already been paid for, and rebuild it on our own proof.**

---

## 1. The longevity signal — the whole reason this works

The Meta Ad Library shows **"Started running on <date>"** on every active ad. That single field is
the most valuable competitive-intelligence data point available for free, because:

> **Nobody funds a losing ad for three months.** An ad that's been running continuously since
> February is not someone's clever idea. It's a P&L decision that keeps getting re-approved.

Longevity is a **survivorship filter someone else paid for.** You're reading the output of a test
budget you didn't spend.

**How to read an advertiser's account from the outside:**

| What you see | What it means |
|---|---|
| An ad active **90+ days** | Profitable. This is the control. Study it hardest. |
| An ad active **6+ months** | A category-defining winner. Rare. Read every word. |
| **Multiple active copies** of the same creative | They're scaling it — duplicated into more ad sets |
| **30 ads all started within the same week** | A test batch. Proves nothing yet. Ignore. |
| An advertiser with **50 active ads, 3 of them old** | Those 3 are the control set; the other 47 are challengers |
| Same headline, many creative variants | The *headline* is the winner, and they're hunting for the image |
| Same image, many copy variants | The *image* is the winner. Different lesson entirely. |

**The rank-by-age move:** for any advertiser, sort their active ads by start date and read the
oldest five. That's their proven library. Everything newer is a hypothesis.

⚠️ **Methodological limit — know this before drawing conclusions.** For non-political commercial
ads outside the EU/UK, the Ad Library shows **only currently-active ads.** There's no archive of
what they *stopped* running. So:
- You can measure minimum lifespan, never actual lifespan
- You **cannot** see their failures, which means you can't tell what they tried and abandoned
- Absence of an angle doesn't mean it failed — it may never have been tried
Treat every teardown as "here's what's working for them," never "here's what doesn't work."

---

## 2. Where to look — ranked by how much the signal transfers

**The ranking principle: buyer match beats offer match.** An angle is a hypothesis about what a
specific person wants. An angle that survived six months against *a dental practice owner* has been
validated on our exact buyer. That's stronger evidence than the same structure proven on a medspa
owner, because buyer psychology is the variable doing the most work.

**Tier 1 — direct competitors.** ⭐ (The industry default: Weave, RevenueWell, NexHealth, Dental
Intelligence, Solutionreach, Podium, Lighthouse 360, Swell.)
Identical buyer, identical skepticism, identical objection set, and enormous test budgets. When one
of their ads has run for months, **the angle is proven against our buyer** — which desire it hits,
which objection it defuses, which callout gets a practice owner to stop. That's the single most
valuable thing a teardown can tell us.

Two things to know going in, neither of which reduces the value:
- Their ads skew **brand/feature-led** because they're selling a platform, not an outcome. That
  means the *angle* is often proven while the *execution* is beatable. **This is the opportunity:**
  we can take an angle they validated and run it with a named mechanism, a receipt, and a guarantee —
  which is the exact thing a platform ad structurally can't do.
- **Never name them in our copy.** "The industry default" is the approved construction, regardless
  of what the teardown finds.

**Tier 1b — agencies and consultants selling *to* dental owners.**
Same buyer, and their copy is direct-response native rather than brand-led. Best single source for
callouts, objection pre-handles, and how to gate for practice size.

**Tier 2 — same offer shape, different vertical.**
Database-reactivation offers sold to medspas, gyms, chiropractors, home services. The offer
architecture is identical to ours and the copy is hard DR. Use it for **structure** — beat order,
guarantee shape, proof placement. Discount its angle findings: an angle that works on a gym owner
may not survive contact with a PPO practice owner.

---

## 3. The teardown grid — what to extract from each ad

For every ad worth tearing down, fill this in. Anything you can't fill in is a finding too.

```
ADVERTISER · started <date> · <N> days active · <N> active variants
FORMAT: static / video / carousel · aspect ratio · creative style

── STRUCTURE ──────────────────────────────────────────
Callout type:        Label / Yes-question / If-then / Ridiculous result
First five words:    [verbatim]
Awareness stage:     which stage does it ENTER at
Sophistication move: claim / bigger claim / mechanism / elaborated mechanism / identification
Value element:       money·status·time·relationships / fear·pain·effort·risk
WHO:                 whose vantage point
WHEN:                past / present / future+ / future−
Beat order:          which beats are present, in what order
Word count:          [n]

── OFFER ARCHITECTURE ─────────────────────────────────
The promise:         what they actually claim
The mechanism:       do they name one? what is it?
Risk reversal:       guarantee? terms? placement in the ad?
Proof type:          numbers / case study / testimonial / logos / volume / none
The gate:            how do they qualify (or fail to)?
CTA:                 button + the mechanical line above it
Destination:         instant form / landing page / DM / call booking

── JUDGMENT ───────────────────────────────────────────
Why it survived:     the one variable you think is carrying it
What's weak:         where it would lose to us
Transferable:        the specific MOVE, stated without their words
Do NOT take:         what's theirs and must stay theirs
```

---

## 4. What transfers and what doesn't

**✅ Take freely — structure is not property:**
- Beat order and which beats they include or skip
- Callout type and how hard the gate is set in the first five words
- Where proof sits relative to the promise
- Offer architecture — guarantee shape, risk-reversal placement, what the CTA asks for
- Creative format and visual device (inset image, highlight circle, native styling)
- Which objection they pre-handle, and where

**❌ Never take:**
- **Their words.** It's their copy, and a buyer who has seen their ad twenty times reads a
  near-verbatim rebuild as a knockoff. The angle transfers; the execution has to be ours — see §5.
- **Their claims and numbers.** We have a locked fact set. Their proof is not our proof, and
  importing a competitor's statistic is a fabrication under our own gates.
- **Their mechanism name.** We have Two-Way Recall. Adopting someone else's named mechanism forfeits
  the only differentiation layer that works in a stage-3/4 market.
- **Their offer terms.** Ours are set in `context/locked-facts.md` and change only by Trevor.

**⚠️ Adapt, don't import:**
- Register and tone — a medspa reactivation ad can be louder than a dental vendor ad, because our
  buyer is making a trust purchase over their patient list
- Claim aggression — most DR advertisers make claims we're not allowed to make
- Anything that would fail our hard gates. Gates outrank a good teardown finding, always.

---

## 5. Iterating on a proven angle — the actual method

The goal is **not** a similar-looking ad. It's: *they proved this angle moves our buyer — now run it
with our weapons.* A competitor's long-running ad tells you the destination; it doesn't tell you the
best vehicle, because they were constrained by what a platform can honestly claim.

**The four-step iteration:**

1. **Name the underlying desire or objection** the angle is actually hitting. Not the words — the
   thing. "Your front desk isn't making the calls" is surface; the desire underneath is *I don't
   want to manage this and I don't trust it's happening.*
2. **Check what constrained them.** Incumbent software sells a tool the practice still has to
   operate, so their ads promise capability. They usually can't promise an *outcome*, can't show a
   named booked-patient list, and can't offer a booking guarantee.
3. **Rebuild the angle on our advantages** — Two-Way Recall as a named mechanism, the 657→145→32→
   ~$9,600 receipt, the 12-booking guarantee, the reactivation blocks, done-for-you delivery.
   Same proven desire, an offer they structurally can't match.
4. **Change the surface deliberately.** Different first five words, different creative device,
   different vantage point. Not to avoid Meta — to avoid reading as a knockoff to a buyer who has
   seen their ad twenty times. Being the obvious derivative of the market leader is a positioning
   loss, not a delivery problem.

**Where we beat them, and should lean:** they sell a platform, we sell a specific outcome with a
receipt attached. Their risk reversal is a free trial or a demo; ours is bookings-or-free. Their
proof is logos and customer counts; ours is one verified list of named patients. Any angle they've
proven, we can usually run harder.

**The one real limit:** don't ship near-verbatim copies of a live competitor ad. Not for delivery
reasons — because it's their copy, and because a buyer who's seen both reads us as the imitator. The
angle is fair game; the execution has to be ours.

**Still run the separation test** from `knowledge/angle-matrix.md` — but against *our own batch*, so
we don't end up with three ads occupying one cell. That's the within-account clustering effect, and
it's real.

---

## 6. Getting the ads in — what actually works

Meta blocks automated access. Verified from this machine, 2026-08-05:
- Direct fetch of `facebook.com/ads/library/...` → **403**, even with a browser user-agent
- Rendering proxy → **200, but page shell only** — the ad grid loads via a second async call
- **Ad Library API** → free, but requires government-ID verification + a developer app, and
  **US commercial coverage is incomplete.** The complete archive is the EU/UK DSA one, which our
  US-only competitors don't appear in. Weak path for this use case.

**What does work, in order of preference:**

1. **Screenshots.** ⭐ Paste them straight into chat — images are read natively, and you get the
   creative *and* the copy *and* the "Started running" date in one artifact. This is the best input
   by a distance, because the visual is half the ad and no text paste preserves it.
2. **Pasted ad text** + the start date and advertiser name. Fast, loses the creative.
3. **A link, with a screenshot as backup.** Always worth trying the link first — access conditions
   change, and a different URL shape may behave differently than the ones tested.

**Ad Library URL recipes** (for Trevor's browser, sorted so the oldest ads surface):
- All active ads for one advertiser: search the page name → open their page → filter Active
- Keyword across all advertisers: `facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=<term>&search_type=keyword_unordered`
- Useful search terms for Tier 1: *reactivation campaign · database reactivation · dormant patients ·
  past patients · win back customers · fill your schedule*

**What to capture per ad, minimum:** advertiser name · start date · full primary text · headline ·
CTA button · the creative itself.

---

## 7. Output — what `recon` produces

Never a summary of what competitors are doing. Always:

1. **The ranked list** — every ad torn down, sorted by days active, with the one variable you
   believe is carrying each one
2. **The pattern** — what the survivors have in common that the rest don't. This is the finding.
   If three 90-day ads all lead with a guarantee and none of the new ones do, that's the report.
3. **What we're missing** — the structural move present in their proven set and absent from ours
4. **What we do better** — where our proof or mechanism beats theirs, so we lean harder there
5. **The build recommendation** — the specific ads to make, mapped to angle-matrix cells, with the
   separation check already run against the source
6. **Explicitly: what not to copy, and why**

Log every torn-down ad to `data/swipe.md` with its teardown grid. An unannotated swipe file is a
scrapbook — the grid is what makes it reusable six months from now.

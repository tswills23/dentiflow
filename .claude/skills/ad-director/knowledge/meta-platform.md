# Platform mechanics — how Meta actually delivers this ad

Not a lens. The physical constraints the creative has to survive.

Deep source in-repo: [docs/gtm/ads/meta-campaign-build.md](../../../../docs/gtm/ads/meta-campaign-build.md)
(full build checklist), [docs/gtm/case-study/case-study-1-meta-ads.md](../../../../docs/gtm/case-study/case-study-1-meta-ads.md) §1.

> ⚠️ Platform behavior changes. Anything here older than ~6 months should be re-verified with
> WebSearch before it drives a spend decision. Date-stamp what you add.

---

## The creative-is-the-targeting era (Andromeda, per docs as of 2026)

Meta reads the ad itself and decides who sees it. Two consequences that drive everything:

1. **Conceptual diversity beats volume.** Meta collapses look-alike ads into one entity — 30
   near-identical ads perform like 1. You win by feeding **conceptually different** ideas.
   Target **8–12 distinct concepts**.
2. **Creative is ~70–80% of performance.** Budget and audience tweaks barely move the needle.
   Effort goes into angles and hooks, not audience micromanagement.

**What "conceptually different" means:** different tension, different persona, different emotion,
different visual. Three ads about the front desk are one ad. Use `knowledge/angle-matrix.md` to
force separation.

## Account structure (current build)

- **Objective:** Leads. Test Instant Form vs. landing page as separate ads in the same set,
  compared on cost-per-*qualified*-call, not cost-per-lead.
- **Campaign:** one campaign, Advantage+ audience. Seed broad (dental practice owner, DSO,
  practice management, Dentrix, Weave, dental CE), then let it expand.
- **Ad sets:** 1–2. Don't over-segment — pooled signal beats clean segments.
- **Ads:** 4–5 live per ad set, drawn from distinct concepts.
- **Geo:** start Midwest (matches the proof), expand on winners. **Founder's local market excluded**
  (visibility constraint).
- **Refresh:** new concepts every 2–3 weeks. Kill clustered/dead ads.

## Before you spend a dollar

From `meta-campaign-build.md` §0 — verify all of these:
1. Thank-you page exists and the calendar points at it.
2. Conversion event fires on the thank-you page (not the button click).
3. Event verified in Events Manager with a real test submission.
4. CAPI wired if you want downstream (show/close) signal back into optimization.

**An ad account optimizing toward a broken event will spend the whole budget learning nothing.**
Check this first on any "our ads aren't working" question, before touching creative.

## Learning phase and statistical honesty

- An ad set needs meaningful conversion volume before delivery stabilizes. Reading results before
  that is reading noise.
- At our budget, **most "winners" and "losers" in week one are not real.** Say so out loud rather
  than prescribing a change off 40 impressions. See `knowledge/diagnosis.md` for minimum volumes.
- Don't restart learning unnecessarily — significant edits (budget, targeting, creative swap on a
  live ad) reset it. Add a new ad instead of editing a running one.

---

## Working with Andromeda (Suby, 2026 — see `docs/reference/sabri-suby-meta-ads-analysis.md`)

**Statics over video.** Andromeda demands a volume of fresh creative that video production can't
match — a full creative team still can't keep up. Statics are cheaper, faster, and (his read,
unverified) favored by the algorithm because more can be served per session. For us statics are
also the natural format: our proof *is* a conversation, and SMS threads read instantly as static.

**The identity-trigger / niche-insertion move.** Andromeda reads the image, copy, offer, and
landing page to decide who to serve. So **to reach a different person, change the creative, not the
audience settings.** Take a winner, duplicate, swap one identity word. Our version is *sub*-niche:
PPO · DSO · group practice · multi-location · specific PMS names. Cheapest test in the account.

**Long copy is targeting data, not just persuasion.** Short copy gives Meta a small context window,
which limits who it can find for you. Long copy tells the algorithm precisely who you want.
→ We currently write 230–250 words ≈ 1,300–1,500 characters against a 2,200-character limit. We're
leaving ~40% of the available context unused. **A long variant is worth testing** — but 230–250 is
a locked Trevor directive, so ask before shipping one.

**Broad targeting + hyper-specific creative.** Interest-stacking is the wrong lever. Test:
duplicate the best interest-stacked ad, strip targeting to a country, run 7 days, compare CPA.

**Ad → landing page congruence.** If the page doesn't match what was clicked, they bounce — you get
great CTR, cheap clicks, and CPA in the toilet. **Meta is the best headline split-tester available
to us:** a headline is exposed to ~1,000× more people than ever reach the page, so headline data
reaches significance far faster on Meta than on the page. Run many headline variants, then mirror
the winner into the page headline, sub-headline, and lead-in. Claimed lift: 15–20% minimum.
*This is the highest-ROI, zero-cost item on our list.*

**Retarget with a different offer, not the same one louder.** The #1 reason someone didn't convert
is that the offer wasn't right for them. The retargeting stack, in order:
1. **Objection-handling ad** — built from real reasons real prospects gave for not booking
2. **Proof / testimonial carousel**
3. **A different offer**
4. **An audit** — makes the call valuable whether or not they buy

We currently have **no retargeting ads at all.** That's the biggest structural gap in the account.

**Clone the winner; don't ride it.** Riding one winner until it fatigues concentrates all
performance in a single ad. Generate variants off the winner (body copy → headlines → creative),
pool into a CBO, let Meta allocate. ⚠️ **Scale caveat:** his version ships hundreds of variants. At
our budget that means every ad gets $3 and learns nothing. **Generate the pool, ship 4–5 at a time.**
The "zombie campaign" (re-running zero-spend ads in their own ad set) only makes sense at spend
levels we're not at.

**Don't make ads look like ads.** Mimic what's natively consumed in the niche. The burner-account
tactic — clean IG/TikTok account, follow every page in the niche, watch what the algorithm surfaces —
works, but our niche's content pool is small. One afternoon, not a standing process.

**Optimize blended economics, not ad-account ratios.** Founders throttle spend to protect a ROAS
percentage. Wrong metric. Find break-even ROAS, then scale toward it; a 10→5 ROAS drop while going
from $1k to $100k/mo makes far more money. For us the operative number remains **cost per qualified
call that shows** (agrees with the Gordon lens).

**Cadence:** 1 hour/week on fresh creative, 3 hours/month personally reading the numbers.

> ⚠️ Suby's magnitudes ($200M/$300M spend, "5x from a lead-in change," "20% more winners") are
> unverified marketing claims from videos selling his own tool. The frameworks stand on their logic;
> never quote the numbers.

---

## Fatigue

Fatigue is measured, not felt. Watch **frequency rising while CTR falls**. The team gets sick of an
ad long before the market does (Ogilvy lens agrees). Kill on data.

Under Andromeda the defense against fatigue is **creative volume**, not budget management. If
frequency is climbing, the answer is new concepts, not a bid change.

## Compliance

- B2B audience. No PHI, ever.
- **No personal-attribute implication** — never imply you know something about the viewer's health,
  finances, or personal circumstances. Meta's special-category rules. "Your overdue list" is about
  their *business*, which is fine; anything that reads as knowing something personal is not.
- Guarantee wording must stay consumer-claims-safe.
- Dentiflow Page + Business Manager only. Never a personal profile.

# Lens 3 — Hormozi: value equation, callouts, offer mechanics

**The one question:** Is the offer's value maximized, and does the hook call out the right person
hard enough that the wrong person scrolls past?

Deep source in-repo (read when you need the full system, not every time):
- [docs/gtm/ads/meta-ads-hormozi-system.md](../../../../docs/gtm/ads/meta-ads-hormozi-system.md) — WHAT/WHO/WHEN
  system + 30-hook bank, already mapped to dental recall
- [docs/reference/100m-offers-summary.html](../../../../docs/reference/100m-offers-summary.html),
  [docs/reference/100m-leads-summary.html](../../../../docs/reference/100m-leads-summary.html),
  [docs/reference/100m-money-models-summary.html](../../../../docs/reference/100m-money-models-summary.html)
- [docs/gtm/offer/dentiflow-offer-master.md](../../../../docs/gtm/offer/dentiflow-offer-master.md) — our offer, already built

---

## The value equation

```
              Dream Outcome  ×  Perceived Likelihood of Achievement
Value  =  ────────────────────────────────────────────────────────────
                 Time Delay  ×  Effort & Sacrifice
```

Every ad either raises a numerator or lowers a denominator. Name which one, per ad. An ad that
doesn't move any of the four is decoration.

**Where Dentiflow sits on each, and the copy line that carries it:**

| Term | Our position | Copy that moves it |
|---|---|---|
| **Dream outcome** | Production they already paid for, back on the schedule | "Holes in your hygiene columns, filled by patients you already own" |
| **Perceived likelihood** | *Our strongest lever.* One real receipt + a guarantee | 657 → 145 → 32 → ~$9,600. The named booked-patient list. The guarantee. |
| **Time delay** | First bookings within days of first send (Day 0/1/3) | "First bookings usually land in the first week" |
| **Effort & sacrifice** | One CSV export + copy approval. That's the whole job. | "Your team does one thing: send us an export" |

**Direction of attack:** in a skeptical stage-3/4 market, the denominator moves are undervalued and
the *likelihood* term does the heaviest lifting. Most vendors compete on dream outcome (bigger
promise). We compete on likelihood (proof + guarantee) and effort (done-for-you). That's the
positioning edge; don't let a variant drift into promise-inflation to sound more exciting.

---

## Callouts — the hook's real job

The hook's job is **not** to be interesting. It's to make the right person feel *addressed* and
make everyone else scroll. A hook that appeals to everyone gets shown to everyone, and Meta will
happily find you the cheapest, brokest, least-qualified version of "everyone."

**Four callout types** (full 30-hook bank in `meta-ads-hormozi-system.md` §4):

| Type | Mechanic | Dental example shape |
|---|---|---|
| **A — Label** | Put them in a group they already identify with | "PPO owners with 400+ overdue patients:" |
| **B — Yes question** | Implied yes; gets them nodding | "Is your hygiene schedule full next Tuesday?" |
| **C — If-then** | Conditional; self-selects the wealth/scale floor | "If you've got 3 locations and one recall list nobody works…" |
| **D — Ridiculous result** | A bizarre/rare outcome that creates curiosity | "32 patients rebooked and nobody in the building made a phone call" |

**The wealth floor is set by the callout, not the targeting.** Under Andromeda, the creative *is*
the targeting (see `knowledge/meta-platform.md`). "300+ overdue patients" in the first five words
does more qualification work than any audience setting available in Ads Manager.

**Rule:** the callout + gate lands in the **first five words**. Not the first sentence. The first
five words.

---

## WHAT / WHO / WHEN — the angle-generation system

The system that keeps you from writing the same ad twelve times. Combine one from each column:

- **WHAT** — the eight value elements: toward (money, status, time, relationships) and away-from
  (fear, pain, effort, risk). Each has a different emotional register.
- **WHO** — status perspective: the owner, the front desk, the hygienist, the associate, the
  spouse, the patient. Same fact, different vantage → a genuinely different ad.
- **WHEN** — timeline: past (what already leaked), present (what's happening today), future+
  (what it becomes), future− (nightmare if nothing changes).

`4 callout types × 8 value elements × 6 personas × 4 timelines` is the combinatorial engine.
See `knowledge/angle-matrix.md` for how to sample from it without producing near-duplicates.

---

## Offer mechanics worth holding in mind (context only — never in an ad)

- **Guarantees convert the ad, not the close.** The guarantee's job is to make a stranger respond
  to a faceless brand with one case study. Ours is a *choice* structure (refund OR keep working
  free) because the remedies are substitutes and the choice saves relationships at the failure moment.
- **Naming the mechanism creates the category.** "Two-Way Recall" is a stage-3 sophistication move
  and an Ogilvy brand asset at the same time.
- **Real scarcity only.** 3 concurrent sprints is true. Truth scales; fake countdown timers don't.
- **Price never appears in the ad.** The ad sells the application; the application sells the call;
  the call sells the sprint.
- **The sprint is the foot in the door, not the revenue product.** Optimize ad copy for *yes-rate*,
  not deal size — the sprint's real output is the right to sell the full system.

---

## What this lens catches

- Hooks that call out everyone (= nobody), or bury the gate past word five
- Ads that move no term of the value equation
- Promise inflation creeping in to make a variant "punchier"
- A batch of three ads that are one ad wearing three hats (same WHO, same WHEN, same value element)
- Missing risk reversal in an ad asking a stranger for an application

## Verdict format

> **Hormozi:** [which value term / callout type / WHO-WHEN cell] · **Verdict:** pass / soft / fail ·
> **Highest-leverage fix:** [one thing]

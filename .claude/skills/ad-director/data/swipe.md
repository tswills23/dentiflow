# Swipe + VOC bank

Two sections. **VOC is the more valuable one** — it's the only source of the exact words the
buyer uses. Never paraphrase a VOC quote into marketing English; the register *is* the value.

---

## VOC — verbatim buyer language

Live source: the 10-stream voice-of-customer dossier →
[docs/gtm/ads/meta-ads-voc-batch.md](../../../../docs/gtm/ads/meta-ads-voc-batch.md) (every ad there cites the
verbatim quote that generated it — read those citations, not just the ads).
Pipeline: `scripts/reddit-voc.mjs` → `scripts/_reddit-voc/posts.jsonl`.

Format for new entries:

```
> "[verbatim quote]"
— [who: owner / front desk / hygienist / patient] · [source] · [date]
**What it reveals:** [the belief or emotion underneath]
**Usable as:** [hook / agitation / objection pre-handle / anti-disqualification]
```

<!-- add entries below -->

---

## Swipe — competitor teardowns

Method and rules: `knowledge/competitor-teardown.md`. **Sort by days active** — an ad running 90+
days is a P&L decision that keeps getting re-approved, not somebody's clever idea.

Format (the grid is what makes an entry reusable six months from now):

```
### [Advertiser] — "[working name]"
**Started:** [date] · **Days active:** [n] · **Variants live:** [n] · **Captured:** [date]
**Tier:** 1 (same offer shape, other vertical) / 2 (agency→dentists) / 3 (direct competitor)
**Format:** [static/video/carousel · ratio · creative style]

STRUCTURE — callout type · first five words · awareness stage entered · sophistication move ·
value element · WHO · WHEN · beats present · word count
OFFER — promise · mechanism (named?) · risk reversal + placement · proof type · gate · CTA · destination
JUDGMENT — why it survived (one variable) · what's weak · transferable move (in our words) ·
do NOT take
```

<!-- add entries below -->

---

## Category positioning teardown — 4 direct competitors (2026-08-05)

⚠️ **Source: landing pages, not ads.** Meta's Ad Library serves a bot challenge to automated
fetching, so the longest-running-ad analysis still needs screenshots. Landing-page messaging is a
strong proxy (ad→page congruence is standard practice) but it is *not* proof of what's in-market.

**Verbatim messaging captured:**

| | Lead headline | Proof | CTA | Mechanism named? | Risk reversal |
|---|---|---|---|---|---|
| **Weave** | "Simpler dental software. Better patient experiences." | Named practices: "saves Sonrisa Dental $50,000/yr" · "Smith Dental saw a 28% increase in new patients" · "15% increase in late payment collections" | Get a demo | No | **None** |
| **RevenueWell** | "The Complete Growth Platform For Dental Practices" | Aggregate: "11,200+ practices" · "445% average monthly ROI" · "432 New Patients Per Year" · "$144k Average Revenue Booked Annually" · "60% Increased Patient Retention" | Book a Demo | No | **None** |
| **NexHealth** | "Automate Your Front-Office. One clean system." | "10,000+ practices" · "75% of admin tasks automated" · "$60,000 saved in additional payroll" · "40% more positive reviews" | See Demo | No | **None** |
| **Dental Intelligence** | "Dentistry's All-in-One Practice Performance Platform" · "Practice Smarter.™" | "$180,000 in added practice revenue" (avg first year) · "10,000+ practices" | Get a Demo | No | **None** |

**The five findings:**

1. **Every one leads with the platform, not an outcome.** "All-in-one," "complete," "one clean
   system," "everything you need." That's a *stage-2* move (bigger claim = more features) made into
   a stage-3/4 market. See `knowledge/schwartz.md`.
2. **Every CTA is a demo. Zero risk reversal in the entire category.** Not one guarantee, not one
   performance promise, across four vendors. They ask for the prospect's time and offer nothing.
3. **Proof defaults to aggregate averages** — "445% average ROI," "$180,000 added revenue,"
   "10,000+ practices." Unverifiable, and it isn't *his* practice. Weave is the exception and does
   named-practice proof ("Sonrisa Dental, $50,000"), which is the stronger format.
4. **Nobody names a mechanism.** Four vendors, zero. Uncontested territory.
5. **They sell breadth; breadth is why they can't guarantee anything.** You cannot promise an
   outcome for a platform the practice still has to operate.

**Best proven line in the set — worth iterating on:**
> **RevenueWell:** *"Your Front Desk Is Already Great. Let's Get Them Out of the Weeds."*
> and *"You Didn't Go to Dental School for Marketing."*

Defuses front-desk blame while naming the pain. Homepage placement = it survived. Their resolution
is a tool ("out of the weeds"); ours is stronger — *nobody on your team touches it at all.*

**What this opens for us:** the category has ceded outcome-promising, risk reversal, named
mechanism, and single-problem focus. All four are exactly what our offer is built on.

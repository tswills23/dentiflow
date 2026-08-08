# Angle matrix — generating concepts that are genuinely different

The purpose is mechanical: Meta collapses look-alike ads into one entity, so near-duplicates waste
spend. This is the tool that forces separation.

Full original system: [docs/gtm/ads/meta-ads-hormozi-system.md](../../../../docs/gtm/ads/meta-ads-hormozi-system.md) §5.

---

## The four dimensions

Pick one cell from each. Change **at least two** dimensions between any two ads in a batch.

**1. CALLOUT TYPE** (how the hook grabs)
- A — Label ("PPO owners with 400 overdue patients:")
- B — Yes question ("Is your hygiene column full next Tuesday?")
- C — If-then ("If you've got 3 locations and one list nobody works…")
- D — Ridiculous result ("32 patients rebooked. Nobody made a phone call.")

**2. VALUE ELEMENT** (what it moves — Hormozi's eight)
- Toward: money · status · time · relationships
- Away from: fear · pain · effort · risk

**3. WHO** (whose vantage point the ad is written from)
- Owner · front desk · hygienist · associate · office manager · the patient

**4. WHEN** (the timeline it lives on)
- Past (what already leaked) · Present (what's happening today) · Future+ (what it becomes) ·
  Future− (nightmare if nothing changes)

`4 × 8 × 6 × 4 = 768 cells.` You need 8–12 live concepts. The constraint is never "we ran out of
ideas" — it's discipline about not writing the same one twice.

---

## Separation test — run before showing a batch

Two ads are **the same ad** if they share the same WHO *and* the same WHEN *and* the same value
element, no matter how different the words are. If a batch fails, change a dimension, not a
sentence.

Quick check for a batch of three:

| | Ad A | Ad B | Ad C |
|---|---|---|---|
| Callout type | | | |
| Value element | | | |
| WHO | | | |
| WHEN | | | |
| Awareness stage entered | | | |

At least two rows must differ across every pair.

---

## Cells already used (keep current — see `data/ads.jsonl` for what shipped)

The live/drafted ad set lives in
[docs/gtm/ads/meta-ads-launch-set.md](../../../../docs/gtm/ads/meta-ads-launch-set.md) and
[docs/gtm/ads/meta-ads-voc-batch.md](../../../../docs/gtm/ads/meta-ads-voc-batch.md) — 12 ads across two waves plus
call-out-type tests. Read those before generating "new" concepts so you don't hand Trevor an ad he
already has.

Known occupied territory (verify against the docs, they're the source of truth):
- Embarrassment / patient shame angle
- "Nobody has an hour to work that list" — front-desk time
- "The front desk hates that call list" — front-desk emotion
- Two-Way Recall mechanism ad (must stay live at all times)
- Scott / DSO authority
- Cancellation-permission / risk-reversal framing
- Seasonal softness (held)

---

## Under-served territory — where to look first for genuinely new angles

These are cells the current 12 don't occupy. Not a mandate to use them; a place to look.

- **WHO = hygienist** — her income depends on a full column she doesn't control. High-emotion,
  almost untouched.
- **WHO = associate** — production floor, someone else's schedule.
- **WHEN = past** — "the patients you already paid to acquire." Loss aversion is our strongest
  frame and it's underweighted in the current set.
- **Value = status** — how a full schedule reads to the owner's peers, staff, and spouse. The whole
  set currently runs on pain/effort/risk; status is untouched.
- **Value = relationships** — the patient who left because nobody followed up, not because they
  were unhappy.
- **Stage-5 identification plays** — sell recognition rather than outcome. Reaches the reader that
  proof ads bounce off (see `knowledge/schwartz.md`).
- **Retargeting-specific awareness** — everything currently written enters at problem-aware. The
  warm pool is product-aware and is being served cold-traffic copy.

## Rule for every generated batch

Show the separation table with the ads. If you can't fill it in, you wrote one ad three times.

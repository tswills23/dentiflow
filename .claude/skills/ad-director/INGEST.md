# Ingest — how this agent gets smarter

The knowledge base is not "everything about advertising." It's a **curated set of decision rules
that changed how we write ads.** Adding volume makes the agent worse; adding rules makes it better.

## The test before anything gets added

> Would this change what I write, or how I'd judge a piece of copy?

If no, don't add it. Interesting ≠ operative. Most of any course is not operative.

---

## Adding a video / course (the `/watch` path)

1. Run the `watch` skill on the URL with a task, not a request for a summary:
   > "Extract only the decision rules a copy director would apply. For each: the rule, when it
   > applies, what it replaces, and whether it contradicts anything in
   > `.claude/skills/ad-director/knowledge/`. Skip everything that's motivation, backstory, or
   > platform trivia."
2. Write the distillation to `docs/` (long-form analysis, like `sgs-course-analysis.md`).
3. Extract **only the operative rules** into the relevant lens file in `knowledge/`, or a new
   lens file if the source is a genuinely distinct evaluative frame.
4. If a new rule **contradicts** an existing one, do not silently overwrite. Add both with the
   conflict named, and ask Trevor which wins. Contradictions between practitioners are usually
   context differences (market, price point, sophistication stage), and naming the context is the
   actual knowledge.
5. Log it in `data/sources.md`.

## Adding a swipe file / competitor ad

Goes to `data/swipe.md` with: the ad, where it ran, what it does well, and **which lens it
demonstrates**. An unannotated swipe file is a scrapbook.

## Adding voice-of-customer language

VOC is the highest-value input there is — it's the only source of the exact words the buyer uses.
Goes to `data/swipe.md` under VOC, with the source cited so the register is auditable.
Existing pipeline: `scripts/reddit-voc.mjs` → `scripts/_reddit-voc/posts.jsonl` →
[docs/gtm/ads/meta-ads-voc-batch.md](../../../docs/gtm/ads/meta-ads-voc-batch.md).

**Rule: never paraphrase a VOC quote into marketing English.** The value is the register.

## Adding our own performance data

`data/performance.jsonl`, one row per read. Real numbers outrank every practitioner in the
knowledge base, including the ones this agent is named after.

## Adding a decision

`data/decisions.md`. One line, dated. Angles killed, winners found, constraints learned. This is
the file that stops the agent proposing something that already failed.

---

## Pruning

Once a quarter, or when a knowledge file exceeds ~200 lines: cut anything that hasn't influenced a
piece of copy. A lens file that's grown into an encyclopedia has stopped being a lens.

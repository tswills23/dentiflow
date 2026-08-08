# Decisions log

One line per decision. Dated. Newest at top. This is the agent's memory — read it before
generating anything so dead ideas don't come back.

Format: `YYYY-MM-DD — [decision] · because [evidence]`

---

- 2026-08-06 — **Competitor ad teardown run** (Weave 210 · RevenueWell 59 · NexHealth 70 · Dental Intel 9 active ads). Findings: category sells *front-desk workload*, not patient revenue — reactivation lane is open · **zero risk reversal in ~348 ads**, every CTA is Learn More→demo · longest-running creative in the category (8.5 mo) is a single huge statistic on a colored card · 338×600 vertical dominates long-runners. Full: `docs/gtm/ads/competitor-ad-teardown-2026-08.md`
- 2026-08-06 — **Ad Library pulls are automatable** via `docs/gtm/ads/ad-library-teardown-playbook.md` (puppeteer-core → local Chrome). Dedupe by image md5, never by ad copy. Page IDs: Weave 645129588924528 · RevenueWell 159518644107383 · NexHealth 2133698340041302 · Dental Intelligence 199793030173119
- 2026-08-05 — **Offer replaced: the 30-Day Empty Chair Sprint.** $2,000 one-time · one location · 500-patient segment · 12-booking guarantee (keep working free) + 14-day unconditional refund · continuity = "Chair Watch" priced below one hygiene visit. **Everything generated before this date is stale.**
- 2026-08-05 — **"Ledger-to-Chair" REJECTED as the ad-facing mechanism name; "Two-Way Recall" stands** · a mechanism must explain past failure in three words and survive a 3-second scroll. Ledger-to-Chair may be the *process* name on the landing page or call, never in an ad
- 2026-08-05 — **Reactivation blocks are live copy material** — practice sets aside two 3-hour windows/week; we only book into those · makes "books onto your schedule" literally true with no PMS integration, and kills the front-desk objection
- 2026-08-05 — **The 17% angle is live:** "We worked 17% of one group's overdue list. It produced about $9,600. The other 83% is still sitting there."
- 2026-08-05 — Claim boundary tightened: ✅ "books onto your schedule / into the blocks you set aside" · ❌ "writes directly into your PMS" or naming Dentrix/Open Dental — the OD write path is built but untested
- 2026-08-03 — Ingested Sabri Suby ×2. **Learn More CTA and 5th-grade reading level independently confirmed** — stop treating either as open · split-test evidence at scale
- 2026-08-03 — **Every ad must pass the three-criteria test** (pattern interrupt · burning intrigue · big specific benefit) on top of the 13 beats · an ad can be structurally complete and still give nobody a reason to stop
- 2026-08-03 — **Tabloid/"breaking news" register refused for the main ad set** · trust purchase; one test ad at most. Keep the structural moves, drop the register
- 2026-08-03 — Production figure locked at **$9,600** (32 × $300), replacing $8,000 · Trevor directive
- 2026-08-03 — **Never put a cost next to a result.** ~$55 text-cost anchor removed from all ad copy permanently · Trevor directive; proof stack is outcome-only
- 2026-08-03 — Ad body word count set to **230–250**, 13-beat SGS structure · Trevor directive
- 2026-07-30 — Public practice name = **32 Family Dental**, "3 locations of a 7-location PPO group." Familia name-drop approved · resolves the Scott-as-client framing
- 2026-07-07 — `docs/gtm/offer/dentiflow-offer-master.md` is the **single source of truth** on offer terms; campaign docs are execution only
- 2026-07-13 — Guarantee is a **choice** (refund OR keep working free), not both · remedies are substitutes; the choice converts would-be refunds into saved relationships
- (undated, standing) — **No "vs 0" A/B framing.** State our own results · locked case-study rule
- (undated, standing) — **"AI" stays out of the offer name.** May be tested in hooks only · dentists want full chairs, not AI

## Open — needs Trevor's call

- **Long-copy test** — Suby writes to 2,200 chars; our locked 230–250 words is ~1,300–1,500. Under
  Andromeda the unused characters are lost *targeting context*, not just lost persuasion. Test one
  long variant against the 250-word control? (Crosses a locked directive — ask first.)
- ~~**Recovery vs. avoidance framing**~~ — **RESOLVED 2026-08-06 by competitor evidence.** NexHealth
  has run pure recovery framing ("Collect What You've Already Earned" / "Turn Aging Balances Into
  Revenue") against our exact buyer since April, scaled in June. Avoidance framing appears in zero
  ads across ~348 sampled. **Write recovery, not avoidance.** See `docs/gtm/ads/competitor-ad-teardown-2026-08.md`.
- **Retargeting stack** — we have zero retargeting ads. Biggest structural gap in the account.
  Needs real objection data from actual sales calls before the objection-handling ad can be written.

## Killed / rejected

- Free trial — rejected (see `docs/gtm/offer/dentiflow-offer-master.md` §13)
- Single-send and offer-only recall variants — rejected; 3-voice Arm A won the A/B
- Smaller sprint segment as a closing concession — never. **500 at one location is the floor.**
- Multi-location or simultaneous multi-office rollout — never implied, until isolation ships
- Competitor takedowns by name — never. "The industry default" only.

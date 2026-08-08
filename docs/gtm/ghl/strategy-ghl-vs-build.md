# Strategy — GHL vs. Build Your Own CRM

**Date:** 2026-07-27
**Decision context:** Build-to-sell in 3–5 years · solo now, first dev hire ~6 months · target client trending toward small-to-medium groups · currently 1 client (32 Dental/Village), 0 arms-length
**Status:** **DECIDED 2026-08-05 — hybrid (rent the CRM, own layers 1/2/3/5).** Revisit per the triggers at the bottom.

**Two amendments to the reasoning below (2026-08-05):**
- **The HIPAA argument inverts.** §"Cost reality" claims riding GHL's BAA is worth more than $297/mo because otherwise you own breach liability. You already own it — PHI is already in Supabase and Twilio. GHL adds a *third* system holding PHI plus a non-cancellable $297/mo to cover the copy you created by adding it. Treat it as a cost, not a saving.
- **The build-side estimate was too high.** "9–18 months to parity" assumed building the staff inbox from zero. `dashboard/src/pages/Conversations.tsx` is already a working two-way threaded inbox with unread state and realtime. The real remaining delta is billing + staff mobile/push, not a CRM.

Decision was made with both amendments known, and with the accepted tradeoff that the hybrid is structurally **two surfaces** (GHL + Dentiflow dashboard), not one.

**The actual rationale (Trevor's, and it supersedes the acquirer argument):** *until there's a team to maintain the codebase, hybrid is the fastest path to $100k/mo.* Enterprise value at exit is not what's driving this — throughput is. Owning more surface area means owning more maintenance, and maintenance capacity is the binding constraint while solo with a day job. That makes the revisit trigger **team capacity**, not multiples.

---

## The verdict

**Rent the CRM. Own the engine, the PMS layer, and the client-facing reporting.**

Building your own CRM is negative-value work for a build-to-sell strategy. It spends your scarcest resource — your nights and weekends now, your first engineer in six months — rebuilding a commodity, while the things an acquirer actually pays for go unbuilt.

The strongest single argument: **a strategic acquirer would throw your CRM away.** Weave, Dental Intelligence, Planet DDS, Henry Schein One — every plausible buyer already has a platform. What none of them have is a validated two-way PMS write-back layer with a compliance-hardened conversation engine and verified booking attribution. That's what gets bought. A CRM is the one component you could build that a buyer would immediately discard.

---

## First: this isn't a binary

You framed it as GHL *or* build. That's the wrong axis. There's a stack, and the only real question is where you draw the line.

| Layer | What it is | Who should own it | Why |
|---|---|---|---|
| 1. Conversation engine | Validator, intent ordering, locked voice, kill switches | **You — permanently** | The regulatory moat. Cannot be rebuilt in GHL. Already decided. |
| 2. PMS integration | Read + write adapters, booking, slot re-verification | **You — permanently** | The actual asset. GHL is irrelevant here either way. |
| 3. Sequence orchestration | Day 0/1/3 timing, state machine, campaign logic | **You** | Keep logic in code, not in GHL workflows (see Disciplines). |
| 4. Staff surface | Inbox, contact timeline, calendar, pipelines | **GHL** | They're better at it than you will be. Not a differentiator. |
| 5. Client reporting | What the practice owner logs in and sees | **You** — this is the strategic one | Where the proof lives and where the brand lives. |
| 6. Agency ops | Managing 20 clients, onboarding, snapshots | **GHL** | Pure operational leverage. Zero strategic value in owning. |
| 7. Billing / subscriptions | Client invoicing, plan management | **GHL (SaaS mode)** | Solved problem. Don't rebuild Stripe plumbing. |

Layers 1–3 you already own and should never move. Layers 4, 6, 7 are commodity — renting them is strictly correct. **Layer 5 is the only genuinely contested one**, and it's the cheap one: you already have a React dashboard on Vercel. Extending it is a fraction of a CRM build and captures most of the enterprise value at stake.

That's the answer to "what would my own CRM have to replace": **just layer 5.**

---

## Cost reality (verified 2026-07-27)

### GHL

| Item | Cost | Scope |
|---|---|---|
| Starter | $97/mo | 3 sub-accounts max — too small past client #2 |
| Agency Unlimited | $297/mo | Unlimited sub-accounts + API. **Where you start.** |
| Agency Pro (SaaS Mode) | $497/mo | White-label + rebilling. Only needed when you resell. |
| HIPAA add-on | $297/mo | **Agency-level, covers all sub-accounts. Non-cancellable.** |
| Per practice | phone ~$2–3/mo + A2P fees (~$15 campaign vetting + monthly) + SMS rebill markup | Marginal |

Annual billing cuts roughly 17%.

**The important finding: HIPAA is a one-time fixed cost, not per client.** That was the number most likely to break GHL's economics at scale, and it doesn't.

| Stage | Fixed GHL cost | Clients | Cost per client | % of $499 revenue |
|---|---|---|---|---|
| Now (pre-patient-traffic) | $297 | 1 | $297 | — |
| Early (live traffic) | $594 | 5 | $119 | 24% |
| Medium | $794 | 20 | $40 | **8%** |
| Long | $794 | 50 | $16 | **3%** |

GHL gets *cheaper per client forever.* At 20+ clients it's a rounding error against revenue.

### Build your own

| Item | Cost | Note |
|---|---|---|
| First engineer | ~$60–100k contractor / $120–180k loaded FTE | *Market range, not a quote — validate before budgeting* |
| Build time to parity | 9–18 months of that engineer | Inbox, pipelines, calendar, campaign builder, multi-tenancy, billing |
| Infra | Low — Supabase/Railway scale fine | Not the issue |
| Maintenance | Permanent, never decreases | The real cost |
| HIPAA compliance | You own it entirely | Breach liability, audit logging, MFA, BAAs |
| SOC 2 (when groups ask) | ~$20–50k+ initial, then annual | *Market range* — groups will eventually ask |

The hidden one is the last two. Riding GHL's HIPAA infrastructure and BAA is worth more than the $297/mo suggests, because the alternative is you personally owning breach liability for patient data across every client.

---

## Time horizons

### Short term — now through client #5

**GHL wins, and it isn't close.**

Your binding constraint is not infrastructure. It's that you have one client and it's Scott's. You need arms-length proof and paying logos. Every hour spent building CRM plumbing is an hour not spent getting customer #2, and at this stage that trade is close to indefensible.

Cost is trivial ($297–594/mo) against the opportunity cost of your nights and weekends.

**The real risk in this window isn't GHL — it's over-configuring GHL before you know what practices actually need.** Build the master snapshot thin. Add only what a real client asks for.

### Medium term — under 20 clients

**GHL still wins on ops. This is where layer 5 starts to matter and where the first hire gets allocated.**

The single highest-leverage decision in this window: **your first engineer does not build a CRM.** They build PMS adapters (Ascend once the write paywall clears, then an aggregator for breadth) and the client reporting layer. That's the work that compounds into enterprise value.

At 20 clients × $499 = ~$10k MRR, GHL is ~8% of revenue. Acceptable and shrinking.

Watch for: snapshot drift across sub-accounts, onboarding time creeping up, and multi-location isolation — which is still half-done and blocks group deals.

### Long term — 20+ clients, group-weighted

**This is the only horizon where the build case has real teeth, and it's narrower than it looks.**

Groups are the specific stress point. A 5-location group is one contract but wants consolidated cross-location reporting, per-location data isolation, and a single owner-level view. GHL's sub-account model is built around one business per sub-account — group rollups get awkward. You'll feel this before you feel anything else.

But notice what the fix is: **a better reporting layer, which you own anyway.** Pull per-location data into your own dashboard, present the group view there. You don't need to replace the inbox or the calendar to solve the group problem. Layer 5 again.

That's the pattern across all three horizons: every pain point that looks like "we need our own CRM" is actually "we need our own reporting."

---

## Lens-by-lens

| Lens | GHL | Build own | Verdict |
|---|---|---|---|
| Speed to revenue | Live in days | 9–18 months to parity | **GHL, decisively** |
| Ease of use (you) | One dashboard, all clients | Whatever you build | **GHL** short/medium |
| Ease of use (practice staff) | Feature bloat; front desks aren't power users | Could be purpose-built and simpler | **Build**, marginally — but white-labeling narrows the gap |
| Build-out time per new client | Hours (snapshot clone) | Hours *after* months of building provisioning | **GHL** |
| PMS read/write | Irrelevant — lives in your backend either way | Identical | **Tie — this lens does not differentiate** |
| Cost to build | ~$600–800/mo fixed | 9–18 engineer-months | **GHL** |
| Cost to maintain | Flat, shrinks per client | Permanent and growing | **GHL** |
| Compliance burden | Ride their HIPAA + BAA | You own breach liability + SOC 2 | **GHL** |
| Margin at scale | 3–8% of revenue at 20–50 clients | Lower marginal, much higher fixed | **GHL** until very large |
| Platform risk | Real: pricing, terms, uptime, ToS | None | **Build** |
| Group/multi-location fit | Sub-account model strains | Purpose-built | **Build** — but solvable via reporting layer |
| Transferability in a sale | Standard platform, any operator can run it | Bespoke, founder-dependent | **GHL** (see below) |
| Enterprise value | Neutral *if* the line is drawn right | Higher only if you actually finish it | **Hybrid wins** |

Two lines worth pulling out.

**PMS integration does not differentiate.** You may be worried GHL limits your PMS ambitions. It doesn't. Adapters run in your backend regardless of what CRM sits on top. The only GHL-adjacent piece is syncing PMS data *into* GHL so sequences stop when someone books through another channel — a small sync job, not an architectural constraint.

**Transferability cuts against building.** For build-to-sell this matters more than founders expect: a bespoke system only you understand is a diligence *discount*. Buyers price key-person risk aggressively. Boring, standard, documented operational infrastructure that any operator can take over is an asset in a sale, not an embarrassment.

---

## Enterprise value — the deepest lens

You said build-to-sell, so this is the one that should drive the decision.

### What a buyer actually pays for, ranked

1. **ARR quality** — recurring, contracted, retained, growing
2. **PMS write-back integrations** — rare, hard, defensible, directly monetizable
3. **The safety/compliance engine** — TCPA + HIPAA-validated reply path is a regulatory moat
4. **Verified attribution data** — the PMS cross-reference proof no marketing dashboard can fake
5. **Customer base in a desirable vertical**
6. **Transferability** — runs without you

Notice what does not appear on that list: a CRM. Nobody is paying a premium for the thing they already have.

### The multiple question

Directional market ranges — validate with a banker or broker before you plan around them, they vary enormously by growth, retention, and buyer type:

- **Pure GHL agency** (snapshot + workflows + their AI, no owned IP): agency multiples. The buyer is purchasing a customer list. Low.
- **Full own-everything vertical SaaS:** highest multiples — *if you get there.* Solo with a day job, the realistic outcome is a beautiful platform with six customers, which is worth less than a scrappy business with forty.
- **The hybrid:** priced much closer to software than to services, because the IP that's hard to build is yours. GHL becomes a vendor line item in diligence, not a valuation cap.

**The critical insight: you already made the enterprise-value decision when you kept Conversation AI away from patients.** That was the one that mattered. If the agent had moved into GHL, your product would have become a snapshot and a prompt — reproducible by anyone else in that course, worth an agency multiple. Keeping the engine yours is what preserves the software valuation. The CRM decision is far lower stakes than it feels.

### What the GHL dependency costs you in diligence

It's a question you'll be asked, not a deal-breaker — provided you can answer it. Four things make it answerable, and all four are cheap if you do them from the start:

1. **Data mirroring** — every conversation also lands in your Supabase
2. **Direct contracts** — the practice contracts with Dentiflow, not through GHL
3. **Logic in code, not workflows** — GHL triggers; Dentiflow decides
4. **A written migration path** — you can articulate what replacing GHL would take

Get those right and GHL is a vendor. Get them wrong and it's a dependency that caps the price.

---

## The five disciplines

Cheap now. Each one preserves optionality and directly answers a diligence question.

**1. Mirror every conversation into Supabase.**
You're already logging. Keep the full corpus on your side. This single move converts GHL from a dependency into a replaceable UI, and the corpus is itself an asset — proof data, benchmarks, eventually training data.

**2. Contracts and billing relationships stay Dentiflow ↔ practice.**
Use GHL SaaS mode for convenience, but make sure the legal and payment relationship is yours. Verify how SaaS mode structures this before you turn it on.

**3. Never put business logic in GHL workflows.**
This is the subtle one. If you build 30 workflows encoding sequence logic, *that* becomes lock-in — untransferable, unversioned, invisible in a code review. GHL workflows should do one thing: fire a webhook at your backend. The decision always happens in your code, where it's versioned, testable, and yours.

**4. Transport stays an adapter.**
Already true in the architecture. Keep it that way — it's what makes "swap GHL out" a real option rather than a slogan.

**5. Client reporting stays on your branded dashboard.**
The client should log into Dentiflow to see results, not into a rebranded GHL. This is the brand surface, the proof surface, and the group-rollup solution. It's also the cheapest layer to own.

---

## Triggers to revisit

Don't re-litigate this on vibes. Revisit if any of these actually happen:

- **You have engineering capacity to maintain more surface area** — a dev hire, or the day job ends. This is the primary trigger (2026-08-05): the decision is capacity-bound, not economics-bound. Everything below is secondary.
- GHL fixed cost exceeds ~15% of revenue (won't happen past ~10 clients)
- Per-client onboarding still takes days despite a working snapshot
- A group deal is lost or blocked specifically by GHL's data model
- GHL materially changes pricing, terms, or ToS
- An acquirer or banker explicitly discounts the business for the dependency
- You cross ~50 locations under management and margin leakage becomes material
- GHL has a sustained outage that takes all clients down at once

Any single trigger = review. Two or more = start the migration you already wrote the path for.

---

## What this means for the next 90 days

The comparison changes almost nothing about what to do *now*, which is itself the finding.

1. **Ship the GHL master snapshot** — thin, per [ghl-master-snapshot-setup.md](./ghl-master-snapshot-setup.md)
2. **Prove the transport** — smoke test, then the router and inbound webhook
3. **Finish the Open Dental booking loop** and record it — this is the asset that sells the company, not the CRM
4. **Wire the data mirror from day one** — cheapest enterprise-value insurance you'll ever buy
5. **Fix multi-location isolation** — currently half-done and it blocks the group deals you're aiming at
6. **Do not build a CRM.** When your dev starts in ~6 months, they build PMS adapters and the reporting layer.

The thing that makes this business valuable is the last mile into the PMS. Everything else is scaffolding — rent it.

---

*Sources for GHL pricing: [GHL plans & pricing](https://www.ghlexperts.com/gohighlevel-plans-pricing) · [HIPAA compliance in HighLevel](https://help.gohighlevel.com/support/solutions/articles/48000983084-hipaa-compliance-with-highlevel) · [HIPAA add-on pricing and scope](https://ghllogic.com/is-gohighlevel-hipaa-compliant/). Acquisition multiples and salary figures are directional market ranges, not verified quotes.*

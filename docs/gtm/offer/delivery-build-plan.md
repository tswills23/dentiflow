# §4 — Delivery: how a practice actually gets deployed

*Replaces the previous §4 build plan. Paste-ready for the Google Doc.*

---

## The problem this section solves

In the course, the unit of delivery is obvious: a GoHighLevel **sub-account**. You clone a snapshot, configure it, hand the client a login, and every part of that client's system lives in one visible container. Provisioning is a five-minute action.

Dentiflow has no equivalent. A practice today is a partial database row plus a set of **global environment variables**, configured by hand. There is no container, no provisioning action, and nothing to point at and call "their instance."

That — not the engine — is the binding constraint on growth.

---

## You need less than a GHL sub-account, because GHL provides half of it

A sub-account bundles roughly ten surfaces. Under the architecture in §1, GHL already covers five:

| Surface | Provided by |
|---|---|
| Staff inbox and conversation history | GHL |
| Contact records | GHL |
| Calendar | GHL |
| Client day-to-day login | GHL |
| Billing | GHL |
| The engine — recall, no-show, reviews, referrals, replies, booking | Dentiflow (built) |
| PMS connection | Dentiflow (built) |
| Results dashboard | Dentiflow (partial) |
| Per-practice configuration | Dentiflow (partial) |
| **Provisioning and control** | **Dentiflow — does not exist** |

So this is not a CRM rebuild. It is the **provisioning and control layer**: the thing that turns a database row into a deployed, verified, running instance.

---

## The unit: a Practice Instance

Define it explicitly, because today it is implicit and that is the whole problem.

A **Practice Instance** consists of:

- **Identity** — practice record, hours, timezone, addresses, providers
- **Module flags** — which agents are enabled: recall, no-show, reviews, referrals, speed-to-lead, voice
- **Operational config** — send windows, rate limits, location scoping, LLM enablement, kill switches
- **PMS integration** — credentials plus a *verified* connection
- **Transport binding** — phone number, GHL sub-account ID, A2P status
- **Template variables** — practice name, hygienist name, booking URL, offer copy
- **Access** — who at the practice can log into the dashboard
- **Health state** — whether this instance is actually working right now

One object. **Provisioned as a unit, verified as a unit, launched as a unit, monitored as a unit.** That is what a sub-account gives them, and what Dentiflow currently lacks.

---

## What already runs without intervention

Worth stating clearly, because it is better than it feels. All of this runs on Railway continuously, with no laptop involved:

| Function | Cadence |
|---|---|
| Recall cron — Day 1/3 sends, sequence progression, exits | hourly, :00 |
| No-show cron | hourly, :05 |
| PMS sync — polls the PMS, dispatches no-show and review events | hourly, :10 |
| Review cron | scheduled |
| Inbound reply handling — intent classification, validator, LLM-or-template, send, staff escalation | instant, on webhook |
| Booking state machine | on demand |

The recall launch pipeline also already exists as authenticated API endpoints — `/api/recall/segment`, `/patients`, `/sequence`, `/launch` — with the count-first confirmation, location scoping and 1 msg/sec rate limit enforced *in the endpoint*, not the script.

**The runtime is already remote. What is local is the console: you are the user interface.**

---

## Build phases

### Phase 0 — Finish multi-location isolation

Everything else sits on data separation being correct. Building provisioning on half-finished isolation industrialises a bug across every future client, and small-to-medium groups are the target segment.

*Nothing else starts until this ships.*

### Phase 1 — Make the instance real in configuration

Today a practice is a partial row plus process-wide environment variables. Those env vars are the actual blocker: `RECALL_LOCATION_FILTER` and the `*_CRON_ENABLED` flags are global, so with two practices they apply to everyone or no one.

- Move every operational env var into per-practice configuration
- Add module flags, with each cron and service checking them before acting
- Define the complete instance schema

This is the phase that makes multi-tenancy true rather than nominal. It is also the ascension ladder in code — the pilot enables recall only, and each subsequent attach flips one flag.

### Phase 2 — Provisioning

One action that takes an intake and produces a complete, valid instance: practice record, module flags, PMS integration with verified connectivity, transport binding, template variables, dashboard user.

**Idempotent** — re-running repairs drift rather than duplicating. This is the snapshot-clone equivalent.

### Phase 3 — Preflight and launch console

A go/no-go readout per instance: PMS authenticating, slots returning, phone provisioned, A2P approved, patients loaded, copy variables set, test conversation passed, front-desk sign-off recorded.

Then launch behind the two-step count confirmation. The API already exists; this is a surface for it, plus an **audit log** of who launched what, when, to how many, at which location.

### Phase 4 — Operator console

Practice list with health at a glance: which instances are live, which are mid-onboarding, which have a broken sync or a stalled A2P registration.

This is what allows holding more than three practices without carrying the state in your head.

### Phase 5 — Client dashboard

The interpretation layer — what came in, what converted, what leaked, what it was worth, verified against the actual schedule. Group rollup for multi-location practices.

This is the surface clients see, and the one no competitor can build, because no competitor holds both sides of the data.

---

## Why this order

**Phases 0 and 1 are the real lever.** Practice #2 cannot be safely onboarded today — not because the engine is unready, but because enabling recall for a new practice means touching global environment variables that also govern Village. That constraint is invisible until it bites.

**Phases 2–4 convert time from operator to owner.** Every launch currently requires a terminal session, which caps throughput at roughly three concurrent pilots regardless of engine quality.

**Phase 5 is the sales asset**, and it is worth nothing without the clients to show it to.

---

## The honest comparison

A course student clones a sub-account in five minutes. Phase 2 gets Dentiflow to something equivalent — provision, configure, verify — and reaching it is weeks of work at current hours, not days.

What that buys: no configuration drift, one engine to improve rather than N copies, and a PMS connection they structurally cannot offer. Their five-minute clone is five minutes precisely because it is a copy of a machine that cannot see the practice's schedule.

---

## Open question to resolve before practice #2

Crons run in-process and Railway auto-deploys on every push to master. **If a deploy lands mid-send, what happens?** If the Day 0 blast is a loop inside the process and the container restarts partway through, does it resume, skip, or re-send?

Not verified — flagged, not asserted. With one practice the timing is controlled by hand; with three it will not be.

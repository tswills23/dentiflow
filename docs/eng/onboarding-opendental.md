# Onboarding Runbook — Open Dental (AI Recall Booking)

**Purpose:** Take an Open Dental practice from zero → **clean, front-desk-approved, AI-bookable recall availability**, wired to Dentiflow + GHL. Run this per practice. Do not go live until Step 5 sign-off is recorded.

**The one rule that makes this work:** the AI only ever offers slots the practice's *own* Web Sched config says are bookable. We inherit their vetted rules — we never invent availability. If it isn't configured here, the AI doesn't offer it; it hands off to a human.

Legend: `[ONE-TIME]` = done once for Dentiflow, not per practice. Everything else is per practice.

---

## Step 0 — Qualify (go / no-go before you sell delivery)

- [ ] PMS confirmed = **Open Dental** (ask directly; don't assume)
- [ ] Open Dental version is current enough for API v1 (recent release — confirm if very old)
- [ ] Hosting model identified: **self-hosted** (server in office) / **OD-hosted** / **third-party hosted** — determines eConnector handling
- [ ] Practice is on **active Open Dental support** (required for eServices + API; nearly all OD practices are)
- [ ] If self-hosted: a **Windows** machine (usually the server) is available for the eConnector (not Mac/Linux)
- [ ] Practice is willing to enable/keep **Web Sched Recall** (~$75/mo, or $165/mo bundle)

**If all checked → green light.** If not on support or refuses Web Sched → not a v1 fit.

---

## Step 1 — Plumbing: eServices + API access

**Open Dental side (practice):**
- [ ] Sign up for **Web Sched Recall** eService (or the eServices Bundle) — needs registration key + active support
- [ ] Book Open Dental's **free ~2.5-hour eServices install** appointment (installs eConnector + eServices). Let OD do this — don't hand-roll it.
- [ ] Confirm eConnector is running (green status in OD)

**Dentiflow API access:**
- [ ] `[ONE-TIME]` Developer API Key obtained from `vendor.relations@opendental.com` (1–3 business days) with scopes: appointments read+create, patients read (+create later), providers read, operatories read, appointment slots read
- [ ] Generate this practice's **Customer API Key** in the Open Dental Developer Portal (unique per customer/developer pair)
- [ ] Practice pastes the Customer API Key in **Setup → Advanced Setup → API** and enables it
- [ ] **BAA** signed with the practice
- [ ] Smoke test: `GET /patients` and `GET /providers` return 200 with the practice's real data (confirms auth + eConnector live)

---

## Step 2 — Configure CLEAN availability (the heart of this runbook)

This is where "clean every time" is won or lost. Configure inside Open Dental's **Web Sched Recall** setup.

- [ ] **Provider schedules** — every hygienist/provider who takes recall has accurate Schedule Setup (working days + hours). Openings come *only* from here.
- [ ] **Operatories** — flag exactly which chairs are **"Is Web Sched"** (whitelist). Typically the hygiene ops. Chairs left off are invisible to the AI.
- [ ] **Recall types** — prophy / child prophy / perio exist with the correct **time pattern + length** (e.g., 60 min prophy). Wrong length = wrong slots.
- [ ] **Provider matching rule** — choose: all providers / primary only / **last-seen hygienist** (recommended for continuity)
- [ ] **Search window** — start N days out (recommend ≥2 to avoid same-day chaos) and search ahead (recommend ~6–8 weeks)
- [ ] **Blockouts** — decide per blockout type whether the AI may schedule over it. Reserve lunch / meetings / emergency / new-patient blocks as **NOT** bookable.
- [ ] **Day/hour exclusions** — exclude any days/times recall should never be offered
- [ ] **Appointment type(s)** for Web Sched map to correct procedures + length

---

## Step 3 — Capture the human-only rules (the ones not in the software)

Interview the office manager. Every "we just know that…" rule is a landmine for auto-booking.

- [ ] Ask: any scheduling rules that live in someone's head? Examples to probe:
  - "No perio with Dr. ___"
  - "Hygiene double-books at 8/10/2" (wave scheduling)
  - "Fridays are half-day / Dr. ___ off"
  - "Hold one new-patient slot per day"
  - "New grad hygienist only does simple prophies"
- [ ] For each rule: encode it in Web Sched (blockout / appt-type / provider matching / schedule) **or** as a Dentiflow guardrail
- [ ] Anything that **can't** be encoded → explicitly **excluded from auto-book** → routes to human handoff

---

## Step 4 — Dentiflow wiring

- [ ] Create the practice's `pms_integrations` row: `pms_type = open_dental`, `client_id` = developer key (or env `OPENDENTAL_DEVELOPER_KEY`), `client_secret` = this practice's customer key, `api_base_url` = `https://api.opendental.com/api/v1`, `active = true`
- [ ] Map identities: OD **PatNum** ↔ Dentiflow patient ↔ GHL contact (backfill `pms_patient_id`)
- [ ] Map OD providers + operatories + recall types → Dentiflow provider/service records
- [ ] Configure transport = **GHL** for this practice (access token, location id) — see Path A
- [ ] Set booking scope for v1: **recall / hygiene, existing patients only**. New patients + operative → human handoff.

---

## Step 5 — Verify & sign off (the gate — DO NOT SKIP)

- [ ] Pull `SlotsWebSched` for the next 2–3 weeks via the adapter
- [ ] Generate a **preview**: "Here are the exact openings the AI will offer" (by provider / day / time)
- [ ] **Front desk / office manager reviews and confirms: "Yes, we'd book every one of these."** Record the sign-off (name + date).
- [ ] **Test booking end-to-end** with a test patient → verify it lands in OD with correct op, provider, time, length → then delete/mark it
- [ ] **Test the race:** manually book a slot in OD, confirm the AI re-verifies at booking time and drops it (offers alternatives)
- [ ] **Test opt-out** → sets permanent `recall_opt_out` + GHL DND
- [ ] **Test emergency/urgent reply** → routes to human handoff with `practice.phone`, AI stops auto-replying on that conversation

---

## Step 6 — Go-live controls

- [ ] Start **small**: one provider / limited hours / small patient batch
- [ ] Watch the first ~10 bookings live; daily reconcile AI-booked vs OD schedule for week 1
- [ ] Confirm the **kill switch** works: pause auto-booking fast (disable customer key write scope, or Dentiflow flag)
- [ ] Rollback plan documented (revert to link-out / human booking if needed)

---

## Step 7 — Drift prevention (ongoing)

- [ ] Re-run the Step 5 slot preview after ANY practice change: new provider, hours change, new operatory, recall-type change
- [ ] Periodic spot check of offered slots vs actual schedule (monthly)
- [ ] Any "the AI offered a slot we wouldn't book" report → treat as a config gap, fix in Web Sched, re-verify

---

## Edge cases → always hand to a human (never guess)

| Situation | AI action |
|-----------|-----------|
| Patient not found in OD (new patient) | Handoff — don't auto-create/book in v1 |
| Insurance / cost question | Reassure per script, pivot to time; escalate if pressed |
| Wants a provider/time with no open slot | Offer nearest alternatives; if none, handoff |
| Emergency / pain | Immediate handoff with `practice.phone`, stop auto-reply |
| Ambiguous reply | One clarifying question, then handoff |
| Slot taken mid-conversation | Re-offer alternatives; if none, handoff |

---

## Fail-safe principle

The failure mode must **always** be "offer fewer slots / hand to a human" — **never** "book a slot that collides or that the practice wouldn't honor." A missed booking is recoverable; a wrong booking burns trust. Design and configure to fail safe, not silent-wrong.

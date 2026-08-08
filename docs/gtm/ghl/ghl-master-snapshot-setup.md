# GHL Master Snapshot — Setup & Safety Config

**Purpose:** Build ONE master sub-account by hand, correctly, then clone it as a snapshot for every practice you onboard. Every setting here is inherited by every future client — get it right once.

**Status:** Not yet built. This is the checklist for the first pass.

**The rule this document exists to enforce:** on Twilio, Dentiflow was the only thing that could send a message. On GHL, GHL can send too — workflows, campaigns, and staff clicking send in the inbox. Every item marked **[SAFETY]** exists because of that.

---

## 1. Sub-account basics

- [ ] Sub-account created, named to a convention you can scale (`Dentiflow — <Practice Name>`)
- [ ] Timezone set to the practice's local timezone (drives all send-window logic)
- [ ] Business info filled — needed for A2P registration
- [ ] Phone number provisioned
- [ ] A2P 10DLC registration submitted (brand ~minutes, campaign vetting 10–15 days — start early)
- [ ] Privacy policy + terms URLs live and reachable (required on every campaign since 2026-06-30)

---

## 2. [SAFETY] Kill the things that can talk to patients

The agent is the only thing allowed to answer a patient. Everything else must be silent.

- [ ] **Conversation AI / AI Employee: DISABLED.** Non-negotiable. If it's on, patients get two replies and one of them bypasses the validator, the intent ordering, the locked voice, and all three kill switches. Also saves the $97/mo add-on.
- [ ] **No workflow sends SMS to a recall-eligible contact.** Dentiflow owns Day 0/1/3 timing. A GHL workflow doing the same thing is a double-send to a real patient.
- [ ] **Auto-responders off** (missed-call text-back, after-hours auto-reply, form auto-reply) unless explicitly routed through Dentiflow
- [ ] **Review-request automations off** — Dentiflow's review sequence owns this
- [ ] Document any workflow you DO enable, and what it's allowed to touch

---

## 3. [SAFETY] Opt-out parity

An opt-out has to be enforced on both sides or it isn't enforced.

- [ ] Inbound STOP → Dentiflow sets `recall_opt_out=true` **and** sets DND on the GHL contact
- [ ] Verify DND blocks workflow sends, not just manual sends
- [ ] Verify a DND contact still allows *inbound* messages to reach the webhook (you need to keep receiving, just never send)
- [ ] Decide the reverse direction: if staff manually sets DND in GHL, does that flow back to `recall_opt_out`? (It should — a patient who tells the front desk to stop counts.)
- [ ] Test: opt out a test contact, then try to send from a GHL workflow AND from Dentiflow. Both must fail.

---

## 4. Identity mapping

Three ids for the same human. Store all three or you'll re-lookup on every send.

- [ ] `ghl_contact_id` stored on the Dentiflow patient record — avoids a contact-upsert API call before every message
- [ ] PMS id (`PatNum` / Ascend id) stored as a **custom field** on the GHL contact, so staff can trace a conversation back to the chart
- [ ] Phone number is the join key on first contact — decide the normalization (E.164 everywhere)
- [ ] Custom fields to create on the master sub-account:
  - `pms_patient_id`
  - `dentiflow_patient_id`
  - `last_visit_date`
  - `months_overdue`
  - `recall_status`

---

## 5. Webhooks & API

- [ ] Inbound-message webhook → `https://<backend>/webhooks/ghl`
- [ ] Signature validation using `X-GHL-Signature` (renamed from `X-WH-Signature` on 2026-07-01 — if you see `X-WH-`, the docs are stale)
- [ ] Private Integration token generated, scopes: `contacts.readonly`, `contacts.write`, `conversations.readonly`, `conversations.write`, `conversations/message.readonly`, `conversations/message.write`
- [ ] Note the rate limit: 100 req/10s, 200k/day per sub-account
- [ ] Plan the OAuth marketplace-app swap for multi-practice (same Bearer, same endpoints — token source changes, code doesn't)

---

## 6. Calendar & pipelines (the reporting layer)

This is what the client actually looks at, and what justifies the price.

- [ ] Calendar configured so the PMS double-write lands somewhere GHL can count
- [ ] Pipeline stages that mirror the recall state machine (contacted → engaged → booked → completed)
- [ ] Decide what the client sees vs. what stays internal
- [ ] Dashboard/report configured on the master so every practice inherits the same view

---

## 7. HIPAA

- [ ] HIPAA add-on enabled **before any real patient traffic** — $297/mo, and it is **non-cancellable once enabled**
- [ ] BAA executed
- [ ] Do all testing on a non-HIPAA sub-account with your own phone number first, so you're not paying $297/mo during the build

---

## 8. Go-live gate (per practice, not just the master)

- [ ] Conversation AI confirmed off *in the cloned sub-account* (verify — don't assume the snapshot carried it)
- [ ] Opt-out tested end to end in the clone
- [ ] One real text sent to a staff member's phone and confirmed received
- [ ] Inbound reply confirmed hitting the Dentiflow webhook
- [ ] Only then: real patient list loaded

---

## Snapshot discipline

When you change the master, existing clones **do not** update. Keep a changelog here of what changed and when, so you know which practices are running which config.

| Date | Change | Practices needing manual backfill |
|---|---|---|
| — | initial build | — |

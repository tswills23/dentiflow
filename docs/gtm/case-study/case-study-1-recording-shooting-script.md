# Case Study #1 — Screen-Share Shooting Script

**Status:** Recording-ready. This is the doc you read from while recording.
**Covers:** The 1:30–6:30 screen-share spine (Trevor solo, no interview dependency).
**Companion docs:** [case-study-1-script.md](./case-study-1-script.md) (full video map) · [case-study-1-sms-threads.md](./case-study-1-sms-threads.md) (raw threads) · [src/services/recall/templates.ts](../../../src/services/recall/templates.ts) (template source)

This piece is the **spine of the whole video** — record it first, solo, no dependency on Scott or Dr. Phillip. The interview clips get cut *into* this later.

---

## ⚠️ Pre-flight — fix these BEFORE you record (each one shows on screen)

| # | Issue | Why it matters on camera | Fix |
|---|---|---|---|
| 1 | Raw threads have render bugs: "Village Dental Village Dental", "Dr. Dr. Phillip", two identical links back-to-back (Thread 1), a misfired "you're off the list" on a patient who only deferred (Thread 3) | Real, but reads as *broken software* — undercuts the whole case study | Use the **cleaned thread renders below** (Section C). Do NOT screen-record the raw doc. |
| 2 | Your VO mocks competitors' "30% off" blast — but your own **Day 3** template also says "30% off" | Attentive viewer catches the apparent contradiction | Narrate the distinction (Section B note). Frame: *we don't LEAD with discount; Day 3 removes the cost barrier after we've earned a reply.* |
| 3 | "Phillip" (two L's) vs "Philip" (one L) is inconsistent even inside the raw threads | Spelling flip-flop on screen looks sloppy | Lock one spelling everywhere on screen. **Recommend "Phillip"** — confirm with Scott. |
| 4 | Real Railway booking URL is visible in threads (`dentiflow-production.up.railway.app/r/...`) | Exposes infra; looks unpolished | Blur/crop the URL tail, or show only `…/r/[booking link]`. |

---

## Pre-flight — assets to have open in tabs before you hit record

1. **Competitor blast example** (Section A) — typed into a notes app or a mock SMS, ready to show.
2. **Your 3-voice templates** (Section B) — the rendered examples, ready on screen.
3. **Cleaned threads** (Section C) — three of them, in a clean SMS-style view (not the raw .md).
4. **The dashboard funnel** — real dashboard, filtered to the recall campaign, showing 657 → 145 → 32.
5. **Loom / screen recorder** at 1080p, system audio OFF, mic on, notifications silenced.

---

## SCENE 1 (1:30–2:30) — "What everyone else sends" vs "what we sent"

### A. Show the competitor blast first

**[ON SCREEN]** A single mock SMS:

> *32 Village Dental in Elk Grove Village has missed seeing your smile! For a limited time, we're offering 30% off your recommended treatment plan—call us today at 847-555-0199!*

**[SAY]**
> "Most dental SMS tools — Weave, NexHealth, RevenueWell — send something like this, once, and stop. One message. A discount. A link. Then nothing. On a dormant list, that mostly gets ignored."

### B. Then show YOUR sequence

**[ON SCREEN]** The 3-voice setup — make the "3 voices" visible (this is the differentiator):

> **Three voices, picked automatically by how long the patient's been away:**
> - **Office voice** — under 6 months
> - **Hygiene team voice** — 6–12 months
> - **Doctor voice** — 12+ months
>
> Each patient gets **three messages over three days** — Day 0, Day 1, Day 3 — same voice throughout.

**[ON SCREEN]** Walk one full arc — the **doctor voice** (most personal, best on camera). Rendered exactly as it sends:

> **Day 0** (no link, just opens a door):
> *Hey [Name], it's Dr. Phillip at Village Dental. I know it's been a while and that's totally fine. Had something I wanted to run by you though. You around?*
>
> **Day 1** (first ask + link):
> *Hey [Name], Dr. Phillip again. I'd rather you come in and leave with good news than keep waiting. Grab a time: [booking link]*
>
> **Day 3** (removes the cost barrier):
> *[Name], last thing from Dr. Phillip. I've taken 30% off your visit back. If there's ever a time to come in, it's now: [booking link]*

**[SAY]**
> "Here's what we sent instead. Three messages over three days, each from a different angle. Notice Day 0 — there's no discount, no link, no ask. It just acknowledges they've been away and opens a door. The first job is to earn a reply, not to close."

**⚠️ [SAY — the discount distinction, don't skip this]**
> "And yeah — Day 3 does include an offer to bring the cost down. The difference isn't 'no discounts ever.' It's that we don't *lead* with one. By Day 3, we've earned a conversation first — so the offer lands as a reason to act, not as the opening line a dormant patient scrolls right past."

---

## SCENE 2 (2:30–5:00) — Real conversation threads

**[SAY — intro]**
> "This isn't a mockup. These are real conversations from real patients during the recall. Names and numbers anonymized."

### C. The three cleaned threads (use these renders — NOT the raw doc)

#### Thread 1 — Booked *(the hero — walk this one slowly)*

```
Tue 7:58 AM   →  Hey [Name], hope things are good. Team at Village Dental
                 wanted to check in since you're due for a visit. You free to text?

Wed 8:00 AM   →  Hey [Name], Village Dental again. You probably feel fine — most
                 people do. That's actually when it's easiest to stay that way.
                 Pick a time: …/r/[booking link]

Thu 9:00 AM   →  Hey [Name], were you able to grab a time? Reply YES if you're all
                 set, or let us know if you need help.

Thu 10:19 AM  ←  Yes

Thu 10:19 AM  →  Perfect, see you then. Give us a call if anything changes.
```

**[SAY]**
> "This patient never replied to Day 0. Didn't reply to Day 1 either. Day 3 hit — and *that's* when they engaged. If we'd stopped at one message, the way the standard blast does, this booking would not exist. That's the whole point of the sequence."

#### Thread 2 — Declined *(the cleanest thread — shows the system knows when to let go)*

```
Tue 8:02 AM   →  Hey [Name], it's Dr. Phillip at Village Dental. I know it's been a
                 while and that's totally fine. Had something I wanted to run by you
                 though. You around?

Tue 10:21 AM  ←  Hi, yeah I'm around what's going on

Tue 10:21 AM  →  It's been a while since you've been in — we wanted to reach out
                 personally to get you taken care of. Let's get you back in for a
                 checkup. Does earlier or later in the week work better?

Tue 10:23 AM  ←  I don't need any service right now, thanks

Tue 10:23 AM  →  No worries — was it a timing thing or did you find somewhere else?

Tue 10:24 AM  ←  I'm going somewhere else
```

**[SAY]**
> "Not everyone comes back. This patient engaged, said they'd found another dentist — and we acknowledged it and let them go. No hard sell, no badgering. One soft question to learn why, then we stop. The list stays clean and nobody gets annoyed."

#### Thread 3 — Opted out *(keep short — just prove the compliant exit)*

```
Tue 8:39 AM   ←  Hello Doc. What's up?

Tue 8:39 AM   →  Haven't seen you in a while — wanted to reach out personally to get
                 you taken care of. Let's get you back in for a checkup. Does earlier
                 or later in the week work better?

Tue 8:44 AM   ←  I really like you guys, but I don't work in Elk Grove any longer…

Tue 8:45 AM   →  Got it, you're off the list. If you ever need us, just give us a call.
```

**[SAY]**
> "And when someone wants out, they're out. Immediate, TCPA-compliant, never messaged again. No tricks to keep them on the list."

> **⚠️ Note on Thread 3:** the raw thread has a misfire (system said "off the list" when the patient only deferred to end-of-month, then sent a correction). **Do not show that part on camera.** Crop to the clean exit above. If you want a true opt-out thread, pull one where the patient actually texted STOP.

---

## SCENE 3 (5:00–6:30) — The dashboard + the numbers

**[ON SCREEN]** Real dashboard, filtered to the recall campaign. Then the funnel table.

**[ON SCREEN — big table]**

| Dormant recall funnel | Combined (2 waves) |
|---|---:|
| Dormant patients texted | **657** |
| Booking-link clicks | **145 (~22%)** |
| Confirmed bookings | **32 (~4.9%)** |

**[SAY]**
> "Here's where it lands. 657 dormant patients across two waves — the same backlog the practice had basically given up on. About 22% clicked the booking link. Almost 5% of the entire list booked a real appointment.
>
> For context: industry-typical recall click rates run 2 to 5 percent — we hit roughly 22. Industry-typical dormant-to-booked is 1 to 3 percent — we hit almost 5. Multiples of the standard, either way.
>
> In dollars: 32 appointments at about $250 a visit is roughly $8,000 in new production — off a list that was generating nothing. The texting cost was about $55. So that's $8,000 in new production for $55 in texts. And that's before the lifetime value of patients who now stay on the books going forward."

---

## Clean teleprompter block (read straight through — no stage directions)

> Most dental SMS tools — Weave, NexHealth, RevenueWell — send something like this, once, and stop. One message, a discount, a link, then nothing. On a dormant list, that mostly gets ignored.
>
> Here's what we sent instead. Three voices, picked automatically by how long the patient's been away — and three messages over three days. Notice Day 0: no discount, no link, no ask. It just acknowledges they've been away and opens a door. The first job is to earn a reply, not to close.
>
> And yes — Day 3 does include an offer to bring the cost down. The difference isn't "no discounts ever." It's that we don't lead with one. By Day 3 we've earned a conversation first, so the offer lands as a reason to act — not the opening line a dormant patient scrolls right past.
>
> These are real conversations from the recall. Names and numbers anonymized.
>
> This first patient never replied to Day 0, or Day 1. Day 3 hit, and that's when they engaged. If we'd stopped at one message, this booking would not exist.
>
> Not everyone comes back. This patient said they'd found another dentist — and we acknowledged it and let them go. One soft question, then we stop. The list stays clean.
>
> And when someone wants out, they're out. Immediate, compliant, never messaged again.
>
> Here's where it lands. 657 dormant patients across two waves. About 22% clicked the link. Almost 5% booked a real appointment. Industry-typical click rates run 2 to 5 percent — we hit roughly 22. Industry-typical dormant-to-booked is 1 to 3 percent — we hit almost 5.
>
> In dollars: 32 appointments at about $250 each is roughly $8,000 in new production, off a list that was generating nothing. The texting cost was about $55. Eight thousand dollars in new production for about $55 in texts — before the lifetime value of every patient who now stays on the books.

---

## Numbers — locked (do not improvise on camera)

- **657** texted · **145** clicks (~22%) · **32** booked (~4.9%)
- **$8,000** new production (32 × ~$250) — confirmed, not projected
- **~$55** Twilio send cost ($54.38 actual across both waves)
- Industry benchmarks: click 2–5% · dormant→booked 1–3%
- **Never** say the old "~$6 / ~400x" or revive the "11 vs 0" A/B framing.

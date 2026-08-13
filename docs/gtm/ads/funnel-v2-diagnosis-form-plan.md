# Funnel v2 — the diagnosis form

Plan for what happens after the current website test finishes (~25 Aug 2026).
Written 12 Aug 2026.

---

## The decision: on-page form, not a Meta Instant Form

| | Instant Form | On-page form |
|---|---|---|
| Friction | Prefilled, near-zero | They have to look numbers up |
| Volume | High | Lower |
| Intent | Low | Filtered by the effort itself |
| Can show a calculated result | **No** | **Yes** |

The friction is the point. Someone who won't spend five minutes pulling three numbers out
of their PMS is not going to buy a $1,250 pilot. And the whole mechanism depends on
computing something and showing it back — which an Instant Form cannot do.

The Aug Instant Form round (20 leads → 2 calls → 0 closes, with 7 SMS touches over 5 days)
is **not** evidence against Instant Forms. Those ads ran a general SGS-based offer, so the
mechanism and the offer were changed at the same time and neither got judged. But nothing
about that round argues *for* going back either, and the diagnosis mechanic needs a page.

---

## What this actually is

Not a lead-capture form. **It's the diagnosis intake.**

That distinction drives everything. SourceClub asks for an invoice and hands back a savings
number; the call exists to walk through it. Same shape here — except the input has to avoid
patient data entirely.

**No PHI, ever.** A list of overdue patients is protected health information, and asking a
cold prospect to send one before any agreement exists is a HIPAA problem, a BAA problem, and
an absurd trust ask from a stranger. That is the correct reason this step didn't exist
before.

Three aggregate numbers carry the whole thing, and any owner can pull them from a PMS report
in five minutes without exporting a single patient record.

---

## The form

```
First name
Email
Mobile
Practice name

Roughly how many patients haven't been in for 6+ months?     [number]
What's your average production per hygiene visit?            [default $300]
What practice management software do you run?                [dropdown]
```

The PMS dropdown does double duty — it feeds the software-swap creative angle
(`funnel/creative/callout-cards/pms-*.png`) that's already built and never shipped.

**Gate:** 500+ overdue. Below that, still capture them, show the projection, and say plainly
that the pilot starts at 500 — but **do not fire `Lead`**. Meta should only ever learn the
qualified pattern.

---

## What they see on submit

Same page, no redirect — momentum matters. Result appears, calendar unlocks beneath it.

> **You have about 1,800 patients overdue.**
>
> At the booking rate we measured on a 3-location PPO group — 32 booked from 657 texted,
> 4.9% — that's roughly **88 appointments** and about **$26,400 in production** sitting in a
> list nobody is working.
>
> *That's an estimate based on one measured campaign, not a promise about your list.*

**The wording of that last line is not optional.** 4.9% is a real measurement from one
practice group. Projected onto a stranger's list it is an estimate, and it has to read as
one. Claim accuracy is the one thing that cannot be traded for conversion here.

Then: *"Book 20 minutes and we'll walk through where those 1,800 sit and which segment to
work first."*

---

## Events and tracking

| Event | Fires when | Notes |
|---|---|---|
| `Lead` | Qualified form submit (500+) | New. This is the mid-funnel event that has never existed |
| `Schedule` | Thank-you page load | Unchanged, guard already verified |

Deploy [src/routes/metaCapiWebhook.ts](../../../src/routes/metaCapiWebhook.ts) and send both
server-side, **qualified only**. Browser pixels lose 20–40% to iOS and ad blockers, and
hand-picking what goes back means the pixel only ever learns from good data.

**Switch the ad set to optimize for `Lead`** once it's firing — not before. Optimizing
toward an event that has never fired is the exact trap the current campaign is in.

Keep reporting on `Schedule`. Optimize on `Lead`, judge on `Schedule`.

At $40/day you still won't hit Meta's ~50 conversions/week and won't exit learning. The
point isn't to exit learning — it's to give Meta *a* pattern instead of none, and to finally
see where people drop.

---

## Follow-up — the part that was missing last time

Seven touches over five days on the previous round produced nothing. Those texts had nothing
specific to say, because a general offer gives you nothing specific to say.

This time every message can reference **their own number**:

> "You told us about 1,800 patients haven't been in since last year. That's roughly $26k of
> production. Want the 20 minutes to see which slice to work first?"

That's the same mechanic Dentiflow sells, pointed at Trevor's own pipeline. If it doesn't
work here, that's worth knowing before selling it again.

Push the three numbers into the GHL contact as custom fields so the sequence can merge them.

---

## Build order

**Phase 0 — finish the current test.** Read at day 21. Don't touch the campaign before then.

**Phase 1 — build (2–3 days)**
1. Form block on the landing page, above the calendar
2. Calculation + result display, calendar reveal on submit
3. `Lead` event on qualified submit
4. Custom fields into GHL, SMS sequence rewritten to merge their number
5. Rename the calendar — **"Overdue List Review"**, not "Game Plan Call". The generic name
   is what let the one call that showed turn into *tell me everything you can do*
6. Deploy CAPI + the privacy page (both written, both undeployed)

**Phase 2 — verify before spending**
- Submit a test with 800 overdue → `Lead` fires, result renders, calendar appears
- Submit with 200 → result renders, `Lead` does **not** fire
- Book through → `Schedule` fires on the thank-you page
- Confirm all three in Events Manager

**Phase 3 — relaunch**
- Optimization event → `Lead`
- Lookalike from SourceClub closed deals swapped in at the same time
- Creative CTA bar stays *"Let Us Analyze Your Recall List"* — for the first time it's true

---

## What you'll finally be able to see

| Step | Benchmark | Currently |
|---|---|---|
| Click → form submit | 15–20% | no form exists |
| Submit → qualified | — | not measured |
| Submit → booked call | — | **never measured** |
| Booked → showed | — | 1 of 2 last round |
| Showed → closed | — | 0 of 1 last round |

Right now you have one number: clicks, then a cliff. After this you can see which step is
actually broken, which is the thing no amount of further spend on the current setup will
tell you.

---

## Budget note

The current test consumes the remaining ~$538 and ends around 25 Aug. **This plan needs new
budget to run.** Given the funnel will finally have a mid-step, the first read on cost per
`Lead` is worth more than the same money spent on the current configuration — but decide the
number before building, not after.

---

## Open, needs Trevor

- **Is the diagnosis an offer change?** It changes the first step from "book a call" to "get
  your number." That belongs in [dentiflow-offer-master.md](../offer/dentiflow-offer-master.md)
  with sign-off — which needs a pass anyway, since §155/§192/§194 still carry the stale
  work-free-until-12 guarantee
- **Does "12 in 30 days" still bind?** The page promises it; the guarantee is now "doesn't
  book, you don't pay." Those are different commitments
- Whether to show the projection as a single figure or a range

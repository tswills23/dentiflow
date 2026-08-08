# Diagnosis — reading performance and prescribing one change

Used by `diagnose` and `iterate` modes. The discipline here is **finding the constraint before
prescribing**. A director who responds to a bad week with five changes has learned nothing by the
following week.

Canonical thresholds live in
[docs/gtm/ads/meta-campaign-build.md](../../../../docs/gtm/ads/meta-campaign-build.md) §5–6 and are mirrored below.

---

## Step 0 — is there enough data to say anything?

Answer this **before** looking at which ad "won." At small budgets most week-one differences are
noise, and saying so is more valuable than a confident wrong answer.

| Question you're answering | Minimum before it means anything |
|---|---|
| Is the creative stopping anyone? (CTR) | ~1,000 impressions per ad |
| Is this ad producing bookings? | ~$150 spend, or ~1,000 impressions with zero |
| Is ad A better than ad B on cost-per-schedule? | Enough conversions on both that one bad day can't flip it — at our volumes, usually 2+ weeks |
| Is the whole campaign viable? | ~$600 spend |

**First read: day 7. Not day 2.** If asked to diagnose before then, say what the data can't yet
support, and give the one thing worth watching.

---

## Step 1 — walk the funnel top-down, stop at the first break

Never diagnose a lower stage before the stage above it is healthy. Most "our ads don't work"
questions are actually broken tracking or a broken page.

```
Event firing?  →  Impressions  →  CTR  →  LP view  →  Application  →  Show  →  Close
   (§0 check)      (delivery)   (creative) (page)     (offer/gate)   (seq)   (script)
```

**Stage 0 — is the conversion event even firing?** Check Events Manager before anything else.
An account optimizing toward a broken event spends the whole budget learning nothing.

---

## Step 2 — the diagnosis table

| What you see | The problem is | Do this | Do NOT do this |
|---|---|---|---|
| No clicks at all (CTR < 0.8% cold B2B) | The creative isn't stopping anyone | Swap the **image/hook**, not the body copy | Rewrite the body |
| Good CTR, cheap clicks, no bookings | The page or the offer | Fix the page. **Don't touch the ads** | Kill a good ad |
| LP view → schedule under ~2% | Page problem, not an ads problem | Page: headline match, proof placement, form friction | Add budget |
| Bookings that don't qualify | Not enough gating | Add the overdue-count question to the form **and** move the wealth floor into the first five words of the hook | Broaden targeting |
| Bookings that don't show | Reminder sequence | Confirmation + reminder flow | Blame the creative |
| Shows that don't close | The ad pre-sold the wrong expectation, or the script | Compare what the ad promised vs. what the call delivers | Change the hook |
| Costs climbing, frequency > 2.5 | Fatigue | **New creative, same copy** | Raise the budget |
| One ad crushing, rest dead | Possibly real, possibly noise | Check Step 0 volumes first, then `iterate` off the winner | Kill everything else immediately |
| Everything mediocre, nothing terrible | Usually proof volume or offer, not copy | Say so. The fix may be case study #2, not an ad | Generate 10 more variants |

## Step 3 — kill rules (decided before launch, honored after)

- Any ad at **3× the ad-set average cost per Schedule** after 1,000 impressions → off.
- Any ad with **zero Schedules at $150 spent** → off.
- **Whole campaign at $600 spent with zero bookings** → stop and fix the page, not the ads.

Kill rules exist to be executed by someone not yet emotionally invested. If a kill rule fires, say
so plainly even if it's an ad you wrote.

---

## Step 4 — isolate why the winner won, before iterating

You cannot iterate off "ad 3 won." You iterate off *which variable* won. Ask in this order:

1. **Hook / callout type** — did it stop a different person, or the same person harder?
2. **Visual** — different creative format entirely, or the same idea better executed?
3. **Angle** — which WHO × WHEN × value-element cell (see `knowledge/angle-matrix.md`)?
4. **Proof placement** — did the number land earlier?
5. **Offer framing** — guarantee-led vs. result-led vs. mechanism-led?

Then produce variants that **hold the winning variable constant and change exactly one other
thing**. If you change two, the next round teaches you nothing — and you'll burn another two weeks
finding that out.

## Step 5 — write it down

Every diagnosis that produced a decision goes in `data/decisions.md`, one line, dated. That file is
what stops the agent from re-proposing an angle that already died.

---

## Metrics worth tracking that Meta won't give you

| Metric | Where it lives | Why |
|---|---|---|
| **Show rate** | The calendar | Meta can't see it |
| **Qualified rate** | Application form answers | The real quality signal |
| **Cost per qualified call that shows** | Computed | The only number that matters |
| Close rate by ad | Manual tagging | Tells you which *creative* produces buyers |

Cost-per-lead is a vanity metric in this funnel. Never optimize to it.

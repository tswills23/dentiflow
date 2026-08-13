# Paid ads + funnel — handoff

Everything a fresh context needs. Supersedes `meta-campaign-state-2026-08-11.md`.
Current as of 12 Aug 2026. Every number below is from the live account, a CSV export,
or the repo — none from memory.

---

## 1. Identifiers

```
Ad account   act_2296817227811193   (TrevorWills-Dentiflow.ai)
Page         1166295903237907
Pixel        2249574982464510
Meta app     905672818729010        (Dentiflow.ai)
Landing      go.dentiflow.ai/chatgpt4-fba--6271-page-242985
Thank-you    go.dentiflow.ai/call-ty-529-page-8159-2099-824077
Backend      https://dentiflow-production.up.railway.app
```

**The Meta app is blocked from the Graph API** — every call returns `OAuthException 200,
"API access blocked."` That's app-level, not token (a dead token gives 190). Likely trigger:
rapid create/delete calls from a dev-mode app while probing `age_min` values. Appeal at
developers.facebook.com → app → **Alert Inbox**. Until then all reads come from CSV exports.

---

## 2. Current campaign

Advantage+ leads campaign, one ad set, three ads. **$40/day, no end date**, manual stop
around 25 Aug when the ~$800 is gone. Optimizing for `Schedule`.

| Ad | Angle | Body |
|---|---|---|
| `reactivation \| Embarrassed angle` | shame — why they haven't come back | Ad 3 |
| `reactivation \| 2 way recall` | mechanism — why one-way recall fails | Ad 6 |
| `reactivation \| sends vs bookings` | measurement — why their software lies | Ad 4 |

Bodies in [meta-ads-launch-set.md](meta-ads-launch-set.md).

### 5–11 Aug

| | Spend | Impr | CPM | Clicks | CTR | LPV | $/LPV | Booked |
|---|---|---|---|---|---|---|---|---|
| Embarrassed | $38.75 | 237 | $163.50 | 6 | 2.53% | 5 | $7.75 | 0 |
| 2 way recall | $12.13 | 893 | $13.58 | 13 | 1.46% | 6 | $2.02 | 0 |
| sends vs bookings | $211.39 | 2,067 | $102.27 | 38 | 1.84% | 24 | $8.81 | 0 |
| **Total** | **$262.27** | **3,197** | $82.03 | 57 | 1.78% | **35** | **$7.49** | **0** |

**Day 7 alone: $51.53 for 3 landing page views — $17.18 each.** Marginal cost is more than
double the average and rising.

Meta abandoned two of three ads (day 7: 1 impression and 10 impressions respectively).
There is no per-ad budget control inside an ad set. Quality ranking is **"Below average —
Bottom 35%"** on both delivering ads, which directly raises CPM.

**Zero bookings confirmed three ways:** Meta reports 0, the calendar shows 0, GHL shows 0
views on the thank-you page.

**35 landing page views with zero bookings does not convict the page.** At a 3% page there's
a ~34% chance of zero across 35 visits; at 5%, ~17%. It rules out a great page, not an
ordinary one. An outside agent concluded "the landing page is the problem" — not supported
at this sample size.

---

## 3. Tracking

Pixel base code **and** the `Schedule` event both sit in one block in
**GHL → Funnel → Settings → Tracking & scripts → Head tracking code**, path-guarded so
`Schedule` only fires on the thank-you URL. Source:
`C:\Users\tswil\dentiflow-funnel\thankyou-pixel-PASTE.txt`.

Verified by headless browser with requests intercepted and blocked:

```
LANDING    pixel 2249574982464510 → PageView            (no Schedule — guard works)
THANK-YOU  pixel 2249574982464510 → PageView, Schedule
```

⚠️ **The guard matches the literal path `/call-ty-529-page-8159-2099-824077`.** Rename or
rebuild that page in GHL and the pixel silently stops firing — no error, and the campaign
optimizes toward nothing.

Two pre-existing URL-rule custom conversions still run as a cross-check: `Lead - ChatGPT
Plugin` and `Booked Call - ChatGPT Plugin`. Disagreement between those and `Schedule` means
something broke.

**Written, type-checks clean, NOT deployed:**
- `src/routes/metaCapiWebhook.ts` — server-side CAPI, accepts `Lead` or `Schedule`, carries
  `value` for Lead
- `src/routes/legalRoutes.ts` — privacy policy at `/privacy` (needed to publish the Meta app)

---

## 4. What's been tried, and what it actually proved

### Instant Forms (before this campaign)

$424.11 → **20 leads @ $21.21 → 2 booked calls → 1 showed → 0 closed.**
Leads were worked with **7 SMS touches over 5 days**.

**Do not read this as "Instant Forms don't work."** Those ads ran a general SGS-course-based
offer, not the reactivation offer. Mechanism and offer changed at the same time, so neither
got judged. The one prospect who showed *"wanted everything under the sun"* — the classic
symptom of a non-specific offer, not of a bad lead source.

Two conclusions that do hold: a general offer produces unclosable calls, and 7 touches in
5 days on low-intent leads produced nothing.

### Website + calendar (current)

$262.27 → 57 clicks → 35 LPV → **0 bookings**. Sample too small to judge.

---

## 5. Locked claims

**Only these figures may appear in an ad:** 657 texted · 145 clicks (22%) · 32 booked (4.9%)
· $9,600 production · $300 average visit.

**Never put the $55 SMS cost in an ad** — it anchors value at $55 right before a $1,250 quote.

**Guarantee is "if it doesn't book patients, you don't pay."** Confirmed current by Trevor.

⚠️ **[dentiflow-offer-master.md](../offer/dentiflow-offer-master.md) is STALE.** §155, §192
and §194 still describe "we keep working free until 12" plus a 14-day refund. That file is
flagged as the single source of truth, so it will mislead the next agent — it did exactly
that here. Needs a pass.

Gate: **500+ overdue patients.** Currently stated in copy but enforced nowhere.

---

## 6. Changes shipped 11–12 Aug

**Landing page hero rewritten** with a dynamic lead-in keyed to `utm_content`, so one page
matches whichever ad sent the visitor:

| `utm_content` contains | Lead-in |
|---|---|
| `embarrass` | You already paid for these patients. They just stopped coming. |
| `2 way` | Your recall goes out. Nothing comes back. |
| `sends` | Messages sent don't fill hygiene chairs. Booked patients do. |
| no match | Your overdue list is full of patients you already paid for. |

Separate pages per ad were rejected — 15 visitors each proves nothing and triples the drift
surface that caused the mismatch in the first place.

**Creative CTA bar** being changed from *"Let Us Analyze Your Recall List"* (promised a
diagnostic that didn't exist).

**Ad headlines deliberately unchanged** — the page adapts to them now.

---

## 7. Funnel v2 — built, not launched

The decision: **add a diagnosis form above the calendar**, on-page, not a Meta Instant Form.

Three numbers, **none of them PHI**: how many patients overdue 6+ months, average production
per hygiene visit, which PMS they run. Calculates a projection from the measured 4.9%,
displays it, reveals the calendar, fires a standard `Lead` event only when overdue ≥ 500.

**Why on-page and not Instant Form:** prefilling is the Instant Form's whole advantage, and
low friction is the wrong advantage here — the bottleneck is closable calls, not lead volume.
Making someone look up three numbers filters for exactly the trait needed. And a calculated
result cannot be shown inside an Instant Form.

**Why no patient list:** an overdue patient list is PHI. Asking a cold prospect to send one
is a HIPAA and BAA problem and an enormous trust ask. That's the correct reason this step
didn't exist before, and the aggregate-numbers version routes around it entirely.

Files:
- [funnel-v2-diagnosis-form-plan.md](funnel-v2-diagnosis-form-plan.md) — reasoning
- [funnel-v2-build-steps.md](funnel-v2-build-steps.md) — ordered checklist, SMS copy, verification
- [funnel/diagnosis-form-PASTE.txt](../../../funnel/diagnosis-form-PASTE.txt) — the block

Launch after the current test ends (~25 Aug). **Needs new budget.**

---

## 8. Open decisions

- **Does "12 in 30 days" still bind?** The page promises it; the guarantee is now "doesn't
  book, you don't pay." Different commitments.
- **Is the diagnosis an offer change?** It moves the first step from "book a call" to "get
  your number." Belongs in the offer master with sign-off.
- **Lookalike from SourceClub closed deals** — planned for relaunch. Only worth it if the
  seed is 1,000+ records, and check whether Advantage+ audience expansion can be disabled
  (if locked on, Meta expands past the lookalike and the test doesn't really run).
- Three case-study video scripts still say $8,000; verified figure is $9,600.
- Two old campaigns should be **archived, not deleted** — $424 / 20 leads / 2 calls is the
  only benchmark that exists.
- Two paused objects from an abandoned API build are still in the account and can be
  deleted: campaign `120249653046330633`, ad set `120249653099170633`, no ads attached.

---

## 9. Errors made in this thread — don't repeat them

- **Told Trevor to clear the GHL head tracking code without looking at it first.** That
  removed the pixel `init` and killed all tracking for a period. Always read before
  overwriting.
- **Said the app wouldn't need publishing.** True for campaigns and ad sets, false for ad
  creatives — those require the app in Live mode.
- **Recommended matching the page guarantee to the ads** based on the stale offer master.
  Would have put a false claim on the page.
- **Asserted he hadn't followed up with Instant Form leads.** He had — 7 touches over 5 days.
  The whole recommendation built on that assumption collapsed.
- **Read "20 leads → 2 calls" as a conversion problem** when the offer was the variable.

Pattern: verify from the source before advising, and don't let an external example
(agency call, competitor teardown) override what this account's own data says.

---

## 10. Reusable tooling

| File | What |
|---|---|
| [ad-library-teardown-playbook.md](ad-library-teardown-playbook.md) | Scrape any competitor's live Meta ads. Puppeteer required; `media_type=image` breaks the page; **dedupe by image hash, not ad copy** |
| [../../reddit-voc-playbook.md](reddit-voc-playbook.md) | Reddit VOC via Arctic-Shift. `sort=asc` mandatory; `query=` times out |
| `scripts/meta-campaign-build.ts` | Builds campaign → ad set → ads via API, all PAUSED. Blocked until the app restriction lifts |
| `scripts/meta-capi-test.ts` | Verifies the CAPI pipe; refuses to fire without a test code |
| `funnel/creative/callout-cards/` | 15 flat text cards, 4 Source Club format spins, the annotated-document ads |

**Creative lineage:** ~90% of Alex Hormozi's ~800 active ads are one campaign — identical
body copy, ~132 unique flat navy text cards differing only by industry named. Trevor's own
Source Club winners use a different formula: "Attention: Dentists" call-out, one claim
repeated verbatim across every format, diagnostic CTA. Current creative follows the Source
Club lineage.

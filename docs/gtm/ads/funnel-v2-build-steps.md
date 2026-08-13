# Funnel v2 — build checklist

Ordered. Do it in this order; later steps depend on earlier ones.
Strategy and reasoning live in [funnel-v2-diagnosis-form-plan.md](funnel-v2-diagnosis-form-plan.md).

**Nothing here touches the live campaign.** Build it all now, launch when the current
test ends (~25 Aug).

---

## 1. GHL custom fields

Settings → Custom Fields → add these on **Contact**:

| Field | Type | Key |
|---|---|---|
| Overdue count | Number | `overdue_count` |
| Avg production | Number | `avg_production` |
| Projected bookings | Number | `projected_bookings` |
| Projected production | Number | `projected_production` |
| PMS | Text | `pms` |
| Qualified | Text | `qualified` |
| Practice name | Text | `practice_name` |

---

## 2. Inbound webhook workflow

Automation → Workflows → Create → trigger **Inbound Webhook**.

Copy the URL it generates. Then send one test POST so GHL learns the payload shape —
otherwise the mapping dropdowns come up empty:

```bash
curl -X POST "<YOUR_WEBHOOK_URL>" -H "Content-Type: application/json" -d '{
  "first_name":"Test","practice_name":"Test Dental","email":"test@example.com",
  "phone":"+15555550123","pms":"Dentrix","overdue_count":1800,"avg_production":300,
  "projected_bookings":88,"projected_production":26400,"qualified":"yes",
  "event_id":"lead_test_1","page_url":"https://go.dentiflow.ai/"
}'
```

Workflow actions, in order:

1. **Create/Update Contact** — map every field above
2. **Add tag** — `diagnosis-qualified` or `diagnosis-under-500` based on `qualified`
3. **Webhook** → POST to `<BACKEND_URL>/webhooks/meta-capi?secret=<META_CAPI_SECRET>` with
   `event_name: "Lead"`, plus `email`, `phone`, `first_name`, `event_id`, and
   `value: {{projected_production}}`
4. **If/Else on `qualified`** → qualified goes into the SMS sequence in §5

Step 3 is the server-side copy. It shares `event_id` with the browser pixel, so Meta
de-duplicates and counts one conversion.

---

## 3. Paste the form

Funnel → Steps → Booking Page → new **Custom HTML/JavaScript** block, placed
**directly above the calendar**.

Paste [funnel/diagnosis-form-PASTE.txt](../../../funnel/diagnosis-form-PASTE.txt), then set
two values at the top of the script:

```js
var WEBHOOK_URL  = 'PASTE_YOUR_GHL_INBOUND_WEBHOOK_URL';
var CAL_SELECTOR = '#df-cal';
```

`#df-cal` is what the hero CTA already anchors to. Only change it if the calendar moved.

---

## 4. Rename the calendar

Calendars → your booking calendar → rename to **Overdue List Review**. Drop it to
**20 minutes**.

"Game Plan Call" is what let the one call that showed turn into *tell me everything you can
do for my practice*. A named scope either filters that person out or gives you a line to
hold when they wander.

**Leave the redirect pointing at the same thank-you page** — the `Schedule` pixel guard is
hard-coded to `/call-ty-529-page-8159-2099-824077`. A new thank-you page means updating the
guard, or `Schedule` silently stops firing.

---

## 5. SMS sequence — qualified, didn't book

The last sequence ran 7 touches over 5 days on general-offer leads and produced nothing.
It had nothing specific to say. These merge their own numbers.

Reply voice rules apply: sentence case, contractions, em dashes, at most one exclamation
mark across the whole sequence, never "our team".

```
T+15 min   Hey {{contact.first_name}} — you just ran the numbers on your overdue list.
           About {{contact.projected_bookings}} appointments sitting in there. Want
           20 minutes to go through which slice to work first?

T+1 day    {{contact.practice_name}} has around {{contact.overdue_count}} patients who
           haven't been in for 6+ months. That's roughly
           {{contact.projected_production}} in production nobody's working. Worth a look?

T+2 days   Quick one — when we did this at a 3-location PPO group, 32 of 657 booked in
           about three weeks. No calls from their front desk. Happy to show you exactly
           how it ran.

T+4 days   Most practices we talk to have tried a recall blast and got nothing back.
           That's usually a one-way problem, not a list problem. 20 minutes and I'll
           show you the difference.

T+7 days   Still sitting on {{contact.overdue_count}}? If the timing's wrong that's
           fine — just tell me and I'll stop.

T+11 days  Last one from me. If it's a timing thing I'll check back in a few months.
           If you'd rather I didn't, reply STOP.
```

Six touches over eleven days, not seven over five. The old cadence was compressed enough to
read as pressure.

Under-500 contacts go to a separate, slower sequence — they're a future pipeline, not a
current buyer.

---

## 6. Deploy the backend

Two routes are written and undeployed:

- `src/routes/metaCapiWebhook.ts` — now accepts `event_name: "Lead" | "Schedule"`, and
  carries `value` for Lead so Meta can weight by projected production
- `src/routes/legalRoutes.ts` — privacy policy at `/privacy`

Add to `.env` first:

```
META_PIXEL_ID=2249574982464510
META_CAPI_SECRET=<long random string>
META_LANDING_URL=https://go.dentiflow.ai/chatgpt4-fba--6271-page-242985
META_ACCESS_TOKEN=<rotated token>
META_API_VERSION=v23.0
```

Then commit, push, and confirm the deploy — `curl <BACKEND_URL>/health` and check the
`commit` field matches what you pushed. Railway builds fail silently; the email is not proof.

---

## 7. Verify before spending a dollar

Events Manager → Test Events open in another tab.

| Test | Expected |
|---|---|
| Submit with **800** overdue | Result renders · calendar appears · `Lead` fires · contact in GHL tagged qualified |
| Submit with **200** overdue | Result renders · calendar appears · **`Lead` does NOT fire** · contact tagged under-500 |
| Book through the calendar | Lands on the thank-you page · `Schedule` fires |
| Load the landing page cold | `PageView` only — no `Lead`, no `Schedule` |
| Disable JavaScript, reload | **Calendar still visible** — the fail-open guard holds |

That last row matters. The script hides the calendar and only restores it after a successful
submit. If it ever errors, the page must still be bookable.

Server-side check: `npx tsx scripts/meta-capi-test.ts --test-code TEST12345 --via-webhook`

---

## 8. Relaunch settings

- Optimization event → **`Lead`** (only after it has fired a few times for real)
- Audience → lookalike from SourceClub closed deals, if the seed is 1,000+ records
- Budget → unchanged daily, no end date
- Creative → unchanged. The CTA bar already says *"Let Us Analyze Your Recall List"*, which
  for the first time is true

Report on `Schedule`. Optimize on `Lead`. Judge on booked calls that are about one thing.

---

## What you'll be able to see that you can't today

| Step | Benchmark | Today |
|---|---|---|
| Click → form submit | 15–20% | no form |
| Submit → qualified | — | — |
| Submit → booked call | — | **never measured** |
| Booked → showed | — | 1 of 2 |
| Showed → closed | — | 0 of 1 |

Right now you have clicks and then a cliff.

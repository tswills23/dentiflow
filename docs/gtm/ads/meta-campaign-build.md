# Meta campaign build — reactivation funnel

**Funnel:** ad → landing page → on-page calendar → booked call → thank-you page
**Page:** go.dentiflow.ai/chatgpt4-fba--6271-page-242985
**Pixel:** 2249574982464510 (installed, PageView only)
**Assumed budget:** $50/day. Adjust §4 if different.

---

## 0. STOP — do this before you spend anything

Your pixel fires `PageView` and nothing else. **Meta cannot see a booking.** Until that changes you
cannot optimize for booked calls, and any campaign you build is optimizing toward "loaded a page,"
which is how you get volume that doesn't show up on your calendar.

### 0a. Build a thank-you page

A blank GHL page is fine. Copy: *"You're booked. Check your email for the calendar invite. If
anything changes, reply to that email."*

### 0b. Point the calendar at it

GHL calendar settings → **On submit → Redirect to URL** → your thank-you page. Not "show message."
The redirect is what makes the event fireable.

### 0c. Put the conversion event on the thank-you page

Thank-you page → Settings → Head/Footer tracking code:

```html
<script>
  if (typeof fbq === 'function') {
    fbq('track', 'Schedule');
  }
</script>
```

`Schedule` is a Meta standard event and it's the correct one for a booked appointment. Don't invent
a custom event — standard events get better delivery treatment.

### 0d. Verify before spending

Meta Events Manager → **Test Events** → book a test appointment → confirm `Schedule` arrives.
If it doesn't fire, nothing below matters.

### 0e. Optional but worth it — CAPI for what happens after

The events that tell you whether this is working aren't on the page: **showed** and **sold**. Wire
GHL's Conversions API integration to fire on pipeline stage moves. This is measurement, not
optimization — at your volume Meta can't optimize on it, but it's the only way to learn your true
cost per sale rather than cost per booking.

---

## 1. Campaign

| Setting | Value | Why |
|---|---|---|
| Objective | **Leads** | Booking a call is a lead event, not a purchase |
| Buying type | Auction | |
| Campaign budget optimization | **Off** | One ad set. CBO only helps across multiple |
| Special ad categories | **None** | B2B service. Not credit/employment/housing |
| Name | `RX \| Leads \| Reactivation \| Sprint` | Keep a convention. You will have more later |

**Do not** set a special ad category. It restricts targeting and you don't qualify for one.

---

## 2. Ad set

| Setting | Value |
|---|---|
| Conversion location | **Website** |
| Pixel | 2249574982464510 |
| Conversion event | **Schedule** |
| Performance goal | Maximize number of conversions |
| Cost per result goal | Leave blank |
| Bid strategy | Highest volume |
| Budget | Daily, $50 |
| Schedule | Run continuously, no end date |
| Name | `Broad \| US \| 30-65 \| excl-local` |

### Audience

- **Location:** United States. **Exclude your local market** per the visibility rule
- **Age:** 30–65
- **Gender:** All
- **Detailed targeting:** leave empty. Turn Advantage+ audience **on**
- **Languages:** leave empty

The creative does the targeting. Every ad opens with "Dental Practice Owners" and the page gates on
500+ overdue patients. Interest stacks on a budget this size starve delivery before they help.

### Placements

**Manual**, and uncheck **Audience Network**. Keep Facebook and Instagram feeds, Stories, Reels.
Audience Network is where cheap junk clicks come from and it will flatter your CPC while poisoning
your calendar.

---

## 3. Ads

Launch **three**, one ad set, all creatives inside it. Do not split into multiple ad sets — that
divides an already-thin conversion signal.

All three share one creative layout — the annotated recall printout — and differ only in the words
on it. Same image, three doors, so a difference in CTR is a difference in angle.

| Ad name | Image variant | Body copy | Door |
|---|---|---|---|
| `RX \| A \| embarrassed` | Headline: *They're not gone. They're embarrassed.* | Ad 3 | Shame — why they haven't come back |
| `RX \| B \| one-way` | Headline: *Your recall goes out. Nothing comes back.* | Ad 6 | Mechanism — why your outreach fails |
| `RX \| C \| sends` | Headline: *Sends don't fill hygiene chairs.* | Ad 4 | Measurement — why your software's numbers lie |

Marker and magnifier text per variant is in the launch thread; all figures come from the locked set.
Source files and the HTML fallback build live in `funnel/creative/callout-cards/`.

**Copy:** the 13-beat SGS structure, 230–260 words. Callout with the gate in the first five words,
container line in line two, three ✅ bullets led by the $9,600, anti-disqualification line,
objection pre-handle, guarantee, mechanical CTA, signature.

**Fields:**
- Headline: pick from the bank, all under 40 characters
- Description: the guarantee
- CTA button: **Learn More** (not Book Now — the page does the asking)
- Destination: the landing page URL

**Locked numbers only:** 657 · 145 (22%) · 32 (4.9%) · $9,600 · $300 avg. Never the $55 text cost —
it anchors your value at $55 right before a $2,000 quote.

---

## 4. The volume problem, stated honestly

Meta wants **~50 conversions per ad set per week** to exit the learning phase. At $50/day and a
realistic cost per booked call, you will be somewhere around 3–8 bookings a week. **You will be
learning-limited, probably permanently, at this budget.**

That is a real constraint and there is no clever way around it. What you should not do about it:

**Don't optimize on a cheaper upstream event to manufacture volume.** Optimizing on Landing Page
View or a scroll event will absolutely produce more "conversions" and more traffic. It will also
reproduce exactly the problem you already had — volume that doesn't convert to calls. A
learning-limited campaign pointed at the right event beats a well-optimized one pointed at the
wrong one.

**Don't split into multiple ad sets to test things.** Every split halves an already-insufficient
signal.

**Don't judge it in three days.** At this volume you need 2–3 weeks before the numbers mean
anything.

If you want out of learning-limited, the only real lever is **more budget**, not a different event.

---

## 5. What to watch, and when

**First read: day 7.** Not day 2.

| Metric | Where | What it tells you |
|---|---|---|
| Cost per **Schedule** | Ads Manager | The only number that matters |
| Landing page views → Schedule | Ads Manager | Page conversion rate. Under ~2% is a page problem, not an ads problem |
| CTR (link) | Ads Manager | Under 0.8% on cold B2B means the creative isn't stopping anyone |
| Frequency | Ads Manager | Past 2.5 means you've saturated. Refresh creative |
| **Show rate** | Your calendar | Not in Meta. Track it manually |
| Qualified rate | Your form answers | How many had 500+ overdue |

### Diagnosis table

| What you see | The problem is | Do this |
|---|---|---|
| Cheap clicks, no bookings | The page or the offer | Don't touch the ads |
| No clicks at all | The creative | Swap the image, not the copy |
| Bookings that don't qualify | Not enough gating | Add the overdue-count question to the calendar form |
| Bookings that don't show | The reminder sequence | Not an ads problem |
| Costs climbing, frequency past 2.5 | Fatigue | New creative, same copy |

---

## 6. Kill rules — set these now, before you're attached

- **Any ad at 3× the ad-set average cost per Schedule, after 1,000 impressions:** turn it off
- **Any ad with zero Schedules at $150 spent:** turn it off
- **The whole campaign at $600 spent with zero bookings:** stop, and fix the page, not the ads

Write the numbers down before launch. The whole point is that they're decided by someone who
isn't yet emotionally invested in a particular ad.

---

## 7. Before you hit publish — checklist

- [ ] Thank-you page exists
- [ ] Calendar redirects to it on submit
- [ ] `Schedule` event fires — **confirmed in Test Events**, not assumed
- [ ] Overdue-count question is on the calendar booking form
- [ ] Local market excluded in the ad set
- [ ] Audience Network unchecked
- [ ] All three ads point at the correct landing page URL
- [ ] Kill rules written down
- [ ] Every claim in every ad checked against the locked set

---

## Open items

- **79 reply count** on the dashboard is unverified — the only number on the page not traceable to
  the verified set. Confirm it or delete that KPI card and its funnel row.
- **`docs/gtm/offer/reactivation-offer-locked.md` §4** still says ~$8,000 at ~$250 avg. Truth is $9,600 at
  $300. Derived: $14.61 production per patient texted, 12-booking floor = $3,600.
- **GHL funnel is named** `Ads | ChatGPT-5 | Inbound | New Funnel (COPY)`. Not visible to visitors,
  but rename it before it confuses someone later.

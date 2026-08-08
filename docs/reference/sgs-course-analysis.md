# StartGrowSell.AI Course — Analysis for Dentiflow

**Date:** 2026-07-27
**Course:** Start Grow Sell AI (JP Middleton, Michael Vissing)
**Purpose:** What to keep, what to adapt, what to drop — measured against a dental vertical and a build-to-sell goal.

---

## Coverage

**All 18 shared docs read, plus 5 more found linked inside them (23 total).**

Core: 7-Figure Fulfillment (3,363 lines), SGS AI System Snapshot V2, CRM Snapshot, Dominate Your Niche, Launch Your AI Empire, Brand & Campaign SOP, Website Customization V2, Cold Call Script, SGS Agents Prompts (7,009 lines — all 10 agents mapped, 4 read in full), Trevor Wills Accelerator Roadmap, 7-Figure Sales Process, 7-Figure Cold Call Module, 7-Figure Paid Ads, Wining Copies/Headlines, Inbound Appt Setting Script, AI Agency Agreement, TY Page Script, Pay Per Show Agreement.

Linked extras: Sales Script, Market Research Sheet, Testimonial Guide, Walkthrough of Everything, Referrals-from-Reviews.

**Not accessed:** the Skool video training (blocked on cookie export). However, a large amount of recorded material turned out to live *outside* Skool — see Video Sources below.

---

# The architecture question — what the 87 transcripts settle

The whole conversation reduces to one thing: **the course makes GHL the brain. What does that actually mean, and what does it cost?** The video training answers it far more bluntly than the written SOPs, because they say the quiet part out loud.

## Their brain is a human doing data entry

They name it themselves, in the V1 Snapshot training:

> [38:52] *"The actions are triggered through the appointment status workflow, **which is kind of like the brain of this whole operation.**"*

And that workflow is fed by hand:

> [34:30] *"It's very important that the client updates the appointment and basically the end result of the appointment. Did the prospect show? Did they complete their appointment but not get sold? Did they sell the person? **They need to update that in the system.**"*
> [34:54] *"**Without them updating this information, you're not gonna know how the appointments go.** So we train all of our customers how to do this on the onboarding call… All they have to do is move the opportunity card from appointment booked to either appointment no show, to appointment complete, or to sold."*

Everything downstream — no-show recovery, cancellation rescue, review requests, referral asks, and the entire client dashboard — fires off a card a human remembered to drag.

## The tax that creates

They had to build an escalating nag campaign aimed at their own client's staff:

> [35:54] *"Status update required. It's been two hours, appointment has occurred and has not been marked as a show or no show. Please update the status right away **so our system knows**."* — repeated at *"12 hours after, 24 hours after, 48 hours, 72 hours, in one week."*
> [36:18] *"It drastically helps to **keep your clients accountable to mark these appointments** so that we can correctly see the dashboard."*

That is the true cost of GHL-as-brain, and it's not a small one: a six-message harassment sequence pointed at the front desk of the business paying you, forever, because the software cannot observe reality on its own.

## What they do when the client has real software

Their integration story is one-way lead capture, not write-back:

- **Zapier + email parser** to push new leads *into* GHL (Service Titan is the example given)
- Reviews can be triggered from the client's system — and they specifically name dental: *"if you have like a dentist where people come in like every six months, you can connect it to their CRM where you ask them for review after every visit."*

But nothing reads or writes the schedule. On a live sales call in the transcripts, a prospect asks directly whether it integrates with their current system:

> *"Did it have the ability to integrate with my current [system]?"* → *"Here's some options. We would be able to review that throughout the onboarding."*

And elsewhere, plainly: *"it doesn't integrate with your old club [software]."* The question gets deferred to onboarding, where the answer is a Zapier push and a request that staff keep GHL updated by hand.

## What this settles

**For a gym, GHL-as-brain is correct.** There's no competing system of record, the front desk already lives in GHL, and the data-entry tax is small because GHL *is* their software.

**For dental it inverts.** The front desk lives in Dentrix or Open Dental all day. Asking them to also maintain appointment status in a second system is asking for duplicate data entry on every appointment, enforced by a nag sequence, forever. It will decay in week three — and when it decays, the no-show sequence stops firing, the review requests stop, and the dashboard silently goes wrong.

**This is the strongest argument for your architecture that exists**, and it comes from the course itself. Dentiflow reads appointment status from the PMS automatically. No card to drag, no nag campaign, no decay, no dashboard drift. The thing they built six escalating reminder messages to compensate for, you deleted.

It also reframes the sales conversation. Every competitor running this playbook in dental has to ask the practice to change how the front desk works. You don't. *"Your front desk keeps working exactly how they work today"* isn't a nice-to-have — it's the difference between a system that survives contact with a real practice and one that quietly rots.

## One more thing they concede

They don't trust GHL's own reporting: *"reports… it's fluff, it's not useful for our situation,"* and from the fulfillment doc, *"Reporting → we don't use it, we build our own dashboards instead."*

So even the people who put everything in GHL build their reporting layer somewhere else. That independently confirms the one layer worth owning is the one you already have a head start on.

---

# The four answers

## 1. Do I have all your context?

**Documents: yes.** All 23 read in full.
**Video: partial.** 90 core lessons transcribing now; 256 coaching calls not started.

Nothing below is waiting on the video — the transcripts have so far *refined* findings (e.g. the $497 plan correction) rather than overturned them.

## 2. What's worth keeping

Ranked by what actually moves your business, not by how much of the course it covers.

**Keep — high value**

1. **The franchise / strategic-partner motion.** Their real growth engine: *"one relationship can unlock hundreds of clients… 0 to 235 clients in 6 months without ANY external marketing."* Dental's version is the DSO and the multi-location group.
2. **The segmentation rule.** Which service you pitch is decided by the prospect's *existing marketing situation*, not their size. Locked into an agency, or happy with their marketing → sell the services that don't compete with it. This exists specifically to stop disqualifying half the market.
3. **Snapshot → clone → customize.** The operational leverage that justifies GHL at all.
4. **The check-in call structure.** Rapport → results → reconnect to goal → discovery on 6–12 month vision → expose the gap → convert to long-term → referrals → testimonial → review. The most reusable asset in the course.
5. **"Proactive, not reactive."** Know results before they ask; catch problems before they see them. They credit it with halving churn.
6. **Market research by reverse-engineering.** Find agencies winning in the niche → call the owners who reviewed them → funnel-hack their ads. Low-visibility, which suits you.

**Keep — mechanical, adopt as-is**

- Client user permissions (Dashboard view-only, Conversations, Calendars, Contacts, Opportunities; everything else off)
- Meta assets live in *your* ad account, not the client's
- Never delete an offboarded sub-account — retain the history
- Ad testing discipline: one variable at a time, test across 3+ clients, 2 of 3 must beat prior CPL
- Copy at 3rd–5th grade reading level
- Bill outside GHL, so the client relationship is contractually yours
- From their agent prompts: the two-slot offering algorithm, relative-date language, "scheduling objection ≠ exit signal," the conversation-end rule, and act-first-ask-nothing on cancel/reschedule

## 3. What to change in your strategy

**A. Reposition recall as the non-competing wedge.** This is the biggest single change. Their segmentation logic applies to you almost perfectly: most dental practices already have a marketing agency doing ads, SEO, and websites — and that agency is almost certainly not touching recall. You don't displace anyone. You're additive from the first conversation, which removes the hardest objection in the category before it's raised.

**B. Change your client-acquisition plan.** Your own Accelerator Roadmap says *"Paid Ads + Calling Leads like crazy."* That fights your visibility constraint head-on. The same curriculum contains the answer — the franchise/strategic-partner motion, plus a "How To Get First Client (Warm Market)" module. Switch tracks. Respect their sequencing though: **3–5 arms-length case studies before you approach a strategic partner.** You have one, and it's Scott's.

**C. Fix multi-location isolation.** It's half-done, and it gates the group deals that are your best-fit target. This is now a revenue prerequisite, not cleanup.

**D. Restructure the offer, not just the price.** Your recall engine maps to their *reactivation campaign* — which they sell as a $1,500 one-off, re-runnable quarterly. You've amortized that into $499/mo at no premium while absorbing SMS cost and carrying continuous delivery. Two specific mechanics to adopt: the **first-month-out 12-month contract** (closes like a trial, books like contracted ARR — which is what raises a sale multiple), and **rebilling SMS** ($0.01–0.025/message sent and received). Also add their **business-transfer clause** — the agreement follows the practice if it's acquired, which turns a DSO rollup into distribution instead of churn.

**E. Consider a lighter entry tier.** Their $250 reviews-and-referrals product exists to open doors that a bigger offer can't. Worth having something below the pilot.

**F. Stop copying four things** (detail in DROP below): A2P registered under your agency's EIN, review gating and incentivized reviews, disabling GHL's SMS compliance settings, and their objection handling — which asks for cash on hand and credit score. That last one works on a gym owner who's breaking even and will end a conversation with a dentist.

**G. Don't move the agent into GHL.** Already settled, and everything I read reinforced it.

## 4. What niches suit what they teach

The deciding variable is **whether the business has an entrenched system of record.** Their entire model assumes the GHL calendar *is* the schedule.

**Works natively** — nothing to displace, GHL can own the calendar: gyms, fitness and martial arts studios, med spas, salons and barbershops, tattoo parlors, tutoring centers. Plus home services (roofing, HVAC, plumbing, pest, solar) via their at-home snapshot.

**Strains** — a real system of record exists: dental, chiropractic, optometry, physical therapy, veterinary, legal. These need what you built. That's not a reason to avoid them; it's the reason your moat exists.

Their own stated criteria, which I'd hold to: local, high LTV, **has franchises or tight-knit networks**, and you have experience or know an owner. Dental passes all four for you — and the network criterion is the one most people ignore, even though it's the one that actually drives their growth.

**For your business specifically:** dental is right, and small-to-medium groups are the correct target rather than merely acceptable — they're the dental analogue of the franchise motion that made these authors their money, and they're where your multi-location reporting becomes a moat instead of a gap.

---

## The architectural verdict, now with evidence

Their system is well-built for its intended market and structurally incompatible with dental in one specific way: **it assumes the GHL calendar is the schedule.**

Proof from their own docs:

- Agent config: *"Set of actions: Appointment Booking. Calendar type: Single Calendar."* The agent books into GHL.
- Calendar setup: *"Auto-confirm appointments = ON. Disable reschedule/cancel. Max bookings per slot = 1."*
- No-show and cancellation agents trigger off **GHL appointment status** — meaning a human marks it in GHL.
- The word "PMS" appears nowhere in 3,363 lines of fulfillment doc.

They even name the limit themselves, in the AI Caller section: *"We don't answer service calls... AI can't see into their account — only staff can."* That's the same wall, stated in their own words. Their answer is to route those calls away. In dental, "can you see my schedule" **is** the conversation.

So: their model works when the business has no system of record. Dental has Dentrix and Open Dental, and they're not going anywhere.

**Your architecture already solves this and theirs can't be patched into it.** That's settled — stop re-litigating it.

---

## KEEP — adopt these directly

These are genuinely good and transfer cleanly.

**1. The snapshot → clone → customize workflow.** Build one master sub-account, snapshot it, clone per client. This is the real operational leverage and it's why GHL is worth having.

**2. Client user permissions.** Dashboard (view only), Conversations, Calendars, Contacts, Opportunities. Everything else off. Use verbatim.

**3. The check-in call structure.** Rapport → review results → reconnect to original goal → discovery on 6–12 month vision → create the gap → downsell into 12-month continuity → referrals → testimonial → Google review → book next check-in. This is a well-designed retention and expansion motion, and it's the single most reusable asset in the course.

**4. "Proactive, not reactive."** Know their results before they ask; catch problems before they see them; send wins unprompted. They credit it with cutting churn 50% and lifting upsell conversion from 33% to 75%. Cheap to adopt, compounding.

**5. Market research via reverse-engineering.** Find agencies already winning in the niche → find business owners who left them reviews → call those owners and interrogate the engagement → funnel-hack their ads. This is excellent, and it's low-visibility, which suits your SourceClub constraint.

**6. Offboarding: never delete the sub-account.** Retain for historical data. Aligns with your data-mirror discipline.

**7. Meta assets in your ad account, not the client's.** You keep the pixel data and creative history if you part ways. Directly enterprise-value accretive.

**8. Ad testing discipline.** One variable at a time; creative is 90% of results; test across 3+ clients; 2 of 3 must beat prior CPL; kill anything that doubles CPL. Rigorous and correct.

**9. Copy at 5th-grade reading level** (Hemingway). Matches what already works in your recall templates.

**10. They skip GHL SaaS *mode*, but not the $497 plan.** *"SaaS mode is crowded and low-ticket"* — they bill outside GHL via Deposyt instead. This is better than what I first recommended: the client's payment relationship stays yours by default, which is exactly the diligence position you want.

Correction from the video training (the doc alone was ambiguous): they run on the **$497 SaaS Pro plan** — *"we have the highest account within HighLevel, the SaaS plan, which is the 497 plan"* — they just don't use its reselling feature. The $497 also buys Prospecting, which they say they don't use either (they prefer Local Falcon and Search Atlas).

So for you, **$297 Unlimited likely suffices** — dashboards start at $297, and you need neither SaaS reselling nor Prospecting. That's an inference about your situation, not a description of their practice.

---

## ADAPT — right idea, wrong parameters for dental

**1. Booking window.** They say 1–3 days out, calendar max 5 days. That's gym urgency logic. Hygiene recall books 2–6 weeks out and patients expect it. Copy this and you break dental booking.

**2. "Don't give clients access to the calendar."** Correct for a gym with open availability. Impossible in dental — you inherit the practice's operatory and provider constraints. Your Open Dental Web Sched approach (only offer what their own config says is bookable) is the right inversion.

**3. Reactivation offer = free thing.** Free 14-day pass, free facial, free oil change. Your Day 3 complimentary first-visit-back is the same instinct, already partner-approved. Keep yours; don't import gym offers.

**4. Send pacing.** They cap 500/day reactivation, 50/day reviews. Directionally sound but your Twilio history says 1 msg/sec and explicit count approval. Keep your stricter rule.

**5. Phase order.** Their roadmap is Reviews → Referrals → Reactivation → Sales Refinement → Ads. Reviews first because Google ranking compounds and it's the fastest visible win. **You lead with recall.** Worth considering: reviews are a faster proof point and lower risk than touching patient recall on day one with a new client. Not a change to make blindly, but the sequencing logic is real.

**6. Ten agents by campaign type.** Their split (booking vs reminder, per campaign) exists because offers differ per campaign. Your equivalent is the state machine plus voice variants. Don't rebuild ten prompts — but do check you have distinct handling for cancellation and no-show rebooking, which they treat as universal agents.

---

## DROP — these will hurt you in dental

**1. A2P registered under YOUR agency, not the client's.**
Their Option 1, explicitly recommended: register the brand with your EIN, your legal name, your website, your authorized rep — then change only the *friendly* name, phone, and address to the client's. Their rationale: *"You own the numbers. If a client cancels you can repurpose their number."*

For a gym, that's a gray area. For dental it's a serious problem. The practice is the HIPAA covered entity; you're a business associate. Sending patient-directed messages under your agency's registered brand while displaying the practice's identity is a misrepresentation to carriers, and it puts your EIN on the hook for a covered entity's patient communications. **Register per-practice.** It's more work and it's the only defensible posture.

**2. The A2P use-case description doesn't match the traffic.**
Their template registers the campaign as *appointment confirmations to people who opted in via a website form*. Their actual flagship campaign texts a CSV of dormant customers who never filled out a form. That mismatch is how campaigns get shut down. Your consent basis is the existing treatment relationship — file that, accurately.

**3. "SMS Compliance → turn both options off."**
This disables GHL's built-in opt-out handling. Your opt-out is permanent and legally load-bearing. If those are off *and* your DND sync isn't wired, an opt-out can fall through entirely. Leave them on, and wire DND sync regardless.

**4. Review gating.**
Their flow asks for a 1–5 rating, then routes 5s to the Google review link and 1–4s into an internal "negative" branch. That is textbook review gating — prohibited by Google's policies and squarely in FTC territory since the consumer-review rule. It's also the kind of thing a dental practice can be reported for by a competitor. Ask everyone for the review; handle unhappy patients through service recovery, not filtering.

**5. GHL's Conversation AI touching patients.** Already settled. Their bot config — Autopilot on, 20–30 messages max, "Balanced" response style, no validator, no intent gate, no kill switch — is exactly what you can't ship to patients.

**6. Turning off call recording** in their phone config. Fine for gyms. In healthcare, check state two-party consent rules before adopting any call setup wholesale.

---

## The pricing finding

Buried in their check-in call script:

> "So right now you're in our 3-month plan at **$1,500/month**... Let's get you rolled into our 12-month plan... we can lock you in at **$1,250/month**."

That's **for gyms.** Your offer master is $1,250 setup → **$499/mo** for dental.

Their own niche doctrine says to target businesses that *"make a lot of money per customer (high lifetime value) — you can charge more."* A dental patient's lifetime value is multiples of a gym member's. By the course's own logic you should be priced **above** their $1,500, not at a third of it.

You're leaving significant money on the table, and low price is also actively working against you: it signals a tool rather than an installed system, and it makes the DSO conversation harder later. This deserves a real look before you sign arms-length client #2 — repricing existing relationships is much harder than starting right.

---

## Niche analysis

Their selection criteria: local business · high LTV · **has franchises or tight-knit networks** · you have experience or know an owner.

Dentists appear on their proven list (they cite Wonderist). But Wonderist sells ads and websites — not PMS-integrated booking. The niche is validated; their *delivery model* isn't.

**Where their model works natively** — no entrenched system of record, so GHL can own the calendar: gyms, fitness and martial arts studios, med spas, salons and barbershops, tattoo parlors, tutoring centers. Home services (roofing, HVAC, plumbing, pest, solar) work too via their at-home snapshot.

**Where it strains** — a real system of record exists: dental, chiropractic, optometry, physical therapy, veterinary, legal. These need what you built. That's not a reason to avoid them; it's the reason your moat exists.

**The important find.** Their actual growth engine isn't ads or cold calling:

> "One relationship can unlock hundreds of clients... This scaled us from 0 to 235 clients in 6 months. This is how you can scale without ANY external marketing."

Franchise and network penetration. Dental's equivalent is the DSO and the multi-location group — and Scott's father was CFO/CEO at Familia Dental, 50+ locations. That's precisely the "strategic partner" their doc spends pages teaching you to cultivate from nothing.

Respect their sequencing though: **get 3–5 arms-length case studies before approaching a strategic partner.** You have one, and it's Scott's. Proof first, then the door.

This also resolves your open question on client type. Small-to-medium groups aren't just viable — they're the correct target, because they're the dental analogue of the franchise motion that made this course's authors their money, and they're where your multi-location reporting becomes a moat instead of a gap. Which makes **finishing multi-location isolation** a revenue prerequisite, not a cleanup task.

---

---

## Their agent prompts — what to steal, what's missing

All 10 agents share one template. Read in full: 0.0 Ad Booking, 0.1 Ad Reminder, 4.0 Cancellation Rebook, 5.0 No Show Rebook. Agents 1.0–3.1 are the same structure with variable swaps.

Structure: Personality → Goal → Additional Information → Booking Flow → Calendar Search Rules → Date Language → Conversation Rules → Soft Ask / Soft Pause → If No Times Work → Cancellation → Billing Stop → Opt-Out → FAQ (~30 pairs) → Guardrails.

**Worth stealing:**

- **The two-slot algorithm.** Before noon: earliest AM today + earliest PM today. After noon: earliest PM today + earliest AM next available day. Never two PM slots for today, never an AM slot for today after noon. Concrete, sensible, directly portable to your S3/S4 states.
- **Relative dates only.** *"Always say tomorrow at 3pm, not Wednesday May 13th at 3:00 PM."* Good SMS practice.
- **Scheduling objection ≠ exit signal.** *"A lead saying they cannot do a specific day or time is NOT an exit signal. It is a scheduling objection."* Check your state machine makes this distinction — conflating them ends conversations that were still alive.
- **Act first, ask nothing** on cancel/reschedule: cancel immediately, then offer two new slots in the *same* message. No "would you like to reschedule?" round-trip.
- **Conversation End Rule.** Recognize closers ("thanks", "sounds good", "see you then"), send one warm reply, then stop permanently. Prevents infinite politeness loops.
- **Three-attempt rule** then hand to staff.
- **Two-stage price handling.** First ask deflects to the appointment; second ask gives a range. Mirrors your cost rule.
- **No-show agent books a NEW appointment** rather than rescheduling the old one, leaving the original untouched for reporting.

**What's missing — and why it matters:**

- **Opt-out is a prompt instruction, not a gate.** Their "OPT-OUT — HIGHEST PRIORITY" is just text the model may or may not honor. Yours is a deterministic keyword pre-filter that runs before the LLM. That difference is the whole ballgame in a regulated vertical.
- **Zero emergency handling.** The words "emergency" and "urgent" do not appear once in 7,009 lines. The closest thing is *"If they say they are injured or hurt: Hope everything is okay! Always check with your doctor but we can usually accommodate by modifying things around what works for you."* Ship that response to a dental patient in pain and you have a genuine safety incident.
- **No validator.** Nothing inspects output before send.
- **Static FAQ only.** No live data — which is exactly why their booking can't touch a PMS.

**One conflict to note:** their prompts ban em dashes, colons, and semicolons entirely for text-message realism. Your partner-locked voice *requires* em dashes. Yours wins in your context — but it's a deliberate divergence, not an oversight on their part.

**Worth knowing:** they use Claude to generate these prompts. *"INSTRUCTIONS FOR CLAUDE: below are my business variables and a master template built for gyms. Rewrite all 10 agents using my variables."* Claude is in their tech stack — as an authoring tool, not a runtime agent.

---

## The agreement — you're leaving money on the table twice

From their client agreement template:

> "You pay **$1,500/Month + text messaging fees** (The texting fees are **$0.010 per message sent/received**) and surcharges. You, as the business, pay for your marketing expenses."

Two things you're not doing:

1. **$1,500/mo base** vs your $499.
2. **SMS rebilled at $0.01/message sent and received.** You're absorbing Twilio cost entirely. On a 657-message round that's real money, and it's standard practice in this model.

Also in their agreement: client pays their own ad spend, 30-day notice before renewal or it auto-renews, non-refundable with an explicit chargeback waiver.

---

## From your personalized Accelerator Roadmap

Their plan of record for you, in their words:

- **Niche:** Dentist. Connections: Yes. Selection: Done.
- **Offer:** AI Reviews and Referrals, AI Reactivation, Paid Ads with lead nurturing
- **Pricing:** *"$499 for the first 30 days, upsell the market rate for marketing"*
- **Client acquisition:** *"Paid Ads + Calling Leads like crazy"*

Two things to flag.

**The $499 was never meant to be the price.** It's a foot-in-the-door, and the model assumes you upsell ads management at market rate afterward. That partially resolves the underpricing finding — but only if you actually run the ads upsell. If you're selling $499/mo as the destination, you've taken their entry price and removed the back end. That's the worst of both.

**"Paid Ads + Calling Leads like crazy" collides with your visibility constraint.** Worth separating two different things that both get called "paid ads":

- **B2B ads** — you advertising to find dental clients. This is the conflict. Their roadmap even has you granting their Business Manager (ID 1344687317665402) admin access to your ad account for review.
- **B2C ads** — you running patient-acquisition ads *for* your dental clients. No visibility problem at all, and it's the upsell revenue their pricing model depends on.

Their franchise/strategic-partner motion is the low-visibility path to clients and it's in the same curriculum. That fits your constraint far better than B2B ads and cold calling.

---

## Their sales framework

Cole Gordon-style, and you already have those docs. Discovery → diagnose → build doubt → goals → transition → 5-pillar pitch → temp check (1–10 scale) → close → ACIC objections (Align, Clarify, Isolate, Collaborate).

**The reusable piece is the pillar template**, repeated five times:

> Most [businesses] do [X]. Here's why that's a problem: [Y]. What happens because of that is [Z]. Which ultimately means [cost]. So instead, what we do is [mechanism]. What that means for you is [benefit]. Do you see how this would directly help you [outcome]? What questions do you have on that specifically?

Clean problem-agitate-solve, one pillar at a time, with a check-for-understanding after each.

**Notable:** their Pillar 3 argues explicitly *against* leading with ads — *"the customer starts out at a loss spending money on ads right away rather than having capital built from getting old leads to turn into new sales from a simple AI text campaign."* That's a money-model argument for reactivation-first, and it's consistent with the Hormozi thinking already in your offer master.

---

---

## The Pay Per Show model — the most useful thing in the course

There's a second, completely different agreement in the material: **performance pricing.**

> **$99.00 USD per confirmed appointment that shows up** to scheduled consultation
> AI SMS Messaging: **$0.025 per message sent/received**
> Client responsible for ad spend, beginning with a **$500 market test**
> $99 also applies to appointments manually cancelled by Client or not updated within 72 hours

Month-to-month. 30-day written notice. No refunds, chargeback waiver. And a clause worth stealing outright:

> **"Upon sale or transfer of Client's business, this agreement automatically transfers to the new owner under identical terms."**

For a dental practice that gets acquired by a DSO, that clause converts an exit event into a distribution event.

**Why this matters for your pricing problem.** Case Study #1 was 32 bookings. At $99/show that single round is ~$3,168 — versus $499/mo. Dental appointment value dwarfs a gym's, so $99/show is easily defensible, and it sidesteps the awkward "we're raising your price" conversation by charging for outcomes instead.

**The catch, given build-to-sell:** pure performance revenue is variable and forecasts poorly, and acquirers pay more for contracted recurring ARR than for variable performance fees. So a **hybrid** — modest base retainer plus per-show — is probably better for enterprise value than either extreme. Worth modeling properly before client #2.

Their deliverables list is also unusually specific and worth copying as a format: *"targeting 8 new reviews monthly (minimum 5, stretch 12)," "response to all positive reviews within 12 hours," "automatic sharing of 5-star reviews to Facebook/Instagram on Tuesdays."* Measurable commitments beat vague scope.

---

## Review gating — confirmed, and worse than first flagged

The exact verbiage:

> "Want a chance to **win your membership for 1 year FREE**? Let us know how we are doing on a scale of 1 - 5?"
> → **5** = *"Click the link below to leave us a google review for a chance to win"*
> → **4** = *"What would help bring that 4 up to a 5?"*
> → **1–3** = internal feedback only, notify the client by email

And the process doc states it plainly: **"1-4, ask for feedback, 5 send to google."**

That's two separate problems stacked: **gating** (filtering by sentiment before routing to Google) and **incentivizing** (a prize in exchange for a review). Both violate Google's review policies, both sit inside FTC's consumer-review rule, and in dentistry you additionally have state dental board advertising rules to worry about. A competitor can report it.

Do not port this. Ask everyone, incentivize no one, handle unhappy patients through service recovery.

---

## The credibility anchor — and your version of it

Their B2B ad copy is signed by Andy Gundlach and repeats one line constantly: **"this new A.I. system we developed at our 43 gyms."** Their TY page says: *"Unlike other helpers, we actually run our own [niche] business too. We don't just tell you what to do — we do it ourselves every day."*

That's their entire moat claim: *we own the businesses we sell to.*

You have the same asset and it's true — 32 Dental is Scott's co-founded practice, your family proving ground. Per existing guidance, don't say "co-founder" in copy, but the pattern transfers cleanly: *this was built inside a real dental group, not in a marketing office.*

This also closes the open item on your VSL's About-us line.

**On the VSL numbers:** their TY page supplies the missing slots — reviews "34% more customers," referrals "7-15 new people each month… $3,500-$10,000," reactivation "$5,000-$20,000 in quick sales within 30 days," ads "cuts costs by up to 67%." **These are gym numbers. Do not copy them.** You have real dental figures — 32 bookings from 657 texts, ~$9,600 production for $55 in texts. Use yours.

Their guarantee for comparison: *"at least 10 new good customers within 7 days — guaranteed — or we'll work for free until you do."* Yours is fewer than 5 booked in 30 days and it's free. Theirs is bolder; yours is safer and more credible in healthcare.

---

## Benchmarks worth keeping

From the cold call and ads modules — useful whatever channel you end up using:

- Speed to lead: **under 5 minutes** (400% drop-off after, per the Harvard stat they cite)
- Call cadence on a non-booking lead: **26 calls over 5 days** — 3×/day days 1–3, 2×/day days 4–5, double-dial each time
- Cold call: **20%+** owners-spoken-with → booked. Inbound: **50%+**
- Show rate: **50%+ minimum, 60–70%** when ramped
- Close rate: **15–20%** starting, **35%+** ramped
- Ads: start **$30–50/day**, cap **$500/day per campaign**; creative is **90%** of performance; they've spent **$168,000** testing one angle
- Copy at **3rd–5th grade** reading level; funnel page speed above **70**

Their own track record claims: 1,500+ clients and $16M over 4 years; 416 clients in 16 months from paid ads; 3,361 appointments from cold calling.

---

## Video sources — most of it isn't in Skool

While reading, a lot of recorded material turned up on platforms that need no Skool session:

- **7 live sales calls on public YouTube:** `45WW65AATvQ`, `hznCzXp3q3s`, `9rV97tX0_uQ`, `g8HyZdpDTOc`, `GolMHghkqn8`, `Ib4qgnzNr8s`, `SspIQGrruZo`
- **6 appointment-setting recordings on Google Drive** (file IDs in the Paid Ads module)
- **A full folder of live cold call recordings:** Drive folder `1XLs520uKiLjawB-p7rUSJ4s6S38L2T_l`

The YouTube ones are immediately processable. The Drive ones may be readable through the same Drive access already working. Only the classroom lessons themselves still need the cookie export.

---

## Open items

- **Pricing decision.** Three live options: keep $499 as an entry price with a real ads upsell behind it; reprice the base toward their $1,500; or move to hybrid base + $99/show. Settle before arms-length client #2 — repricing later is much harder.
- **Rebill SMS.** They charge $0.01–0.025 per message sent and received. You absorb it entirely.
- **Add the business-transfer clause** to your agreement.
- **Phase order** — reviews-first vs recall-first for new clients.
- **Reconcile the roadmap's B2B-ads-and-cold-calling client acquisition** against the visibility constraint. The franchise/strategic-partner motion in the same curriculum fits you far better.
- **Fix multi-location isolation** — it gates the group deals that are your best-fit target.
- Classroom video, if the cookie export happens.

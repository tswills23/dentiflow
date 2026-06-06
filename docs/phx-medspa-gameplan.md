# Phoenix Med Spa Launch — Gameplan

**Strategic frame.** White-label of an AI-driven dental ops platform into the Phoenix metro med spa market. Land-and-expand starting with premium SMB single-location and 2-3 location operators. Architecture, channel relationships, and pricing posture built enterprise-ready from day one to support a planned move up-market into PE roll-up / multi-location platforms in months 12-18.

**Target buyer.** MD-owned or 2-3 location med spas in PHX/Scottsdale running multi-service stacks (injectables + at least one of: GLP-1 cash-pay, TRT, peptides). Excludes solo nurse-owners (won't pay premium pricing) and chain locations (corporate-locked tech stacks).

**Target market size.** ~360 winnable indie/SMB med spas in PHX metro, ~160 in the premium tier, ~60-80 in the hybrid wellness bullseye. 18-month goal: 20-30 paying customers, $25-40k MRR.

---

## Decisions to Lock This Week

| Decision | Choice |
|---|---|
| Brand name | New standalone brand (not Dentiflow). Buy .com immediately. |
| ICP within SMB | MD-owned 1-location + multi-location 2-3 spas only. No solo RN-owners. |
| Pricing tiers | 4-tier, none published publicly. Boutique $999, Premium $1,499, Multi-location $2,500-3,500/loc, Enterprise custom. |
| Service scope at launch | Injectables-only MVP. Hybrid wellness modules in v2 after first 10 customers. |
| Setup fee | $0 for first 5 pilot customers (in exchange for case study + reference rights). $5,000 thereafter. |

---

## Phase 0 — Validation & Legal Foundation
**Weeks 0-2. Zero code written.**

Goal: validate pricing and pitch with 5 owner conversations, engage attorney, open enterprise channel relationships in parallel.

| Action | Deliverable |
|---|---|
| Find 1 Allergan/AbbVie Aesthetics rep covering Scottsdale via LinkedIn. Buy coffee. Ask for intros to 5 spa owners. | 5 warm-intro names |
| Cold message 10 MD-owned PHX med spas with: "Building an AI receptionist + reactivation engine for premium med spas — would you give me 30 min for a $200 gift card?" | 5 interviews booked |
| In interviews: validate the three hooks (lead leakage / reactivation / kill two line items), test $1,499/mo price, test $5,000 setup tolerance. | Notes from 5 calls |
| Engage AZ healthcare attorney ($2-3k retainer). Scope: BAA chain feasibility, HIPAA posture for AI-generated SMS, AZ Medical Board exposure. | Signed engagement letter |
| Email Skytale Group + DC Advisory managing directors. Subject: "Building AI ops layer for med spa roll-ups — want your read on EV-multiplier thesis." | 2 emails sent, intro calls scheduled |
| Buy brand domain + register LLC + provision Twilio HIPAA-tier subaccount under new brand. | Domain, LLC, Twilio HIPAA subaccount live |

**Gate to Phase 1.** At least 3 of 5 owners say "yes I'd pay $1,499/mo for this if it worked." If under 3, fix the pitch or price before building.

---

## Phase 1 — Product MVP
**Weeks 2-6. Claude Code velocity.**

Goal: ship a multi-tenant, enterprise-architected med spa SaaS forked from Dentiflow.

### Schema refactor (Week 2)
- Add `organizations` table parent to `practices` (PE-ready from day one)
- Refactor `patients.location` (text column) into relational `locations` table FK
- Add `audit_log` table for any PHI read/write
- Add `staff` table with role-based permissions (RBAC scaffolding for future SSO)
- Drop CHECK constraints on `recall_sequences.sequence_day` and `assigned_voice`
- Drop UNIQUE constraint on `(practice_id, patient_id)` in recall_sequences

### Templates + intent classifiers (Week 2-3)
- Rewrite recall templates — 15-20 injectables-cadence templates (Botox 10-week + filler 5-month variants, one concierge voice, two variants each)
- Rebuild recall intent classifier — add `side_effect`, `reschedule`, `product_question`, `payment_plan`. Remove dental keywords.
- Rebuild STL intent classifier — replace dental emergency patterns with side-effect patterns (bruising, swelling, redness, lump, vision change)
- Patch response validator regex — remove "imaging/scan/records" blocklist (med spas use these legitimately)

### Voice agent retuning (Week 3-4)
- Rewrite STL persona — concierge-luxury tone, no insurance-pivot copy
- Hard-code AI self-disclosure ("Hi, I'm the AI assistant for [practice]") as opening line, uneditable
- Add two-party recording disclosure default

### PMS integration (Week 4-5)
- Build Boulevard adapter (largest PHX market share, public API). Apply to Boulevard partner program immediately — 30-90 day approval window, start now.
- Generic webhook adapter for everything else (Aesthetic Record, Pabau, Mangomint, Vagaro)

### Compliance infrastructure (Week 5-6)
- Signed Twilio HIPAA-tier BAA
- Signed Anthropic Enterprise BAA (post-Dec 2025 covered surface)
- Per-customer BAA template, attorney-reviewed
- Brand-name blocklist: "Ozempic / Wegovy / Zepbound" blocked by default (FDA marketing-letter protection)

### Medical director clinical sign-off (parallel, Weeks 4-6)
- Find one PHX-area MD or NP to clinically review templates + side-effect intent classification. Pay $500-1,500.
- Required before any patient SMS goes live.

**Phase 1 cost:** ~$5-8k (attorney $3k + clinical review $1k + Twilio HIPAA setup $500 + brand and domain $500 + tooling/infra $2k).

---

## Phase 2 — First 5 Pilot Customers
**Weeks 6-14.**

Goal: 5 free-setup pilots running live. Reference customers and case study material.

| Week | Action | Target |
|---|---|---|
| 6-7 | Convert 3 of 5 warm-intro spas from Phase 0 into pilot contracts | 3 signed |
| 8-10 | Onboard pilots white-glove. You personally configure templates, integrate Boulevard, set up call forwarding to AI agent. | 3 live |
| 10-12 | Land 2 more pilots from Allergan rep follow-up intros | 5 total live |
| 12-14 | Capture metrics: missed-call recovery rate, reactivation conversion, no-show recovery, review velocity. Write case study #1 from best performer. | 1 case study published |

**Pilot offer structure.** $0 setup, $999/mo for 6 months, then $1,499/mo standard. Case study and reference rights required. Cancel anytime in first 30 days.

**Phase 2 cost.** ~$2-3k/mo Twilio + Anthropic + infrastructure. Offset by $4,995 MRR by Week 14 (5 × $999).

---

## Phase 3 — Repeatable Sales Motion
**Months 4-8.**

Goal: 20 paying customers, $20-30k MRR, repeatable sales playbook.

| Lever | Mechanism |
|---|---|
| Allergan/Galderma rep referrals | Maintain 1-2 rep relationships in PHX. Quarterly check-ins. Reps' best toxin accounts are your best buyers. |
| Compounding pharmacy rep channel | Empower, Olympia, Belmar, Tailor Made, Strive — these reps call on hybrid wellness clinics. Build 1-2 relationships. |
| Case study + cold outbound | Use best-performing pilot as headline. Cold email + IG DM to 200 PHX med spa owners with the metric ("Spa X recovered $47k in 90 days from reactivated patients"). |
| AmSpa Medical Spa Show 2027 (April) | Attend as participant, not exhibitor. 1:1 coffees with 20 spa owners + 5 PE operating partners. Soft launch of EV-multiplier pitch. |
| Podcast guest spots | Medical Spa Insider, Med Spa CEO. 3 appearances by Month 6. |
| Local events | AmSpa AZ chapter meetups, Skytale-hosted events, Allergan rep dinners. |

**Gate to Phase 4.** 20 customers retained for 3+ months at under 5% churn. If churn higher, fix product or ICP before scaling.

---

## Phase 4 — Channel + Mid-Market
**Months 8-18.**

Goal: 50-100 customers, first multi-location deal, first PE platform conversation.

| Track | Action |
|---|---|
| SMB sales | Hire 1 SDR or part-time appointment setter. Standardize onboarding to ≤4 hours per customer. |
| Multi-location | Pitch your 2-3 best pilot customers on opening location #2 with you pre-installed. First multi-loc reference. |
| PE channel | Skytale + DC Advisory partnership conversations mature. Become recommended stack for post-acquisition standardization. |
| Product | Add hybrid wellness modules (GLP-1 refill cadence, TRT cycle tracking, peptide refill). Build SSO/SAML. Multi-org dashboards. |

---

## Explicitly NOT Doing in 2026

- Solo RN-owned single-location spas (won't pay premium price)
- Pure GLP-1 telehealth clinics (regulatory risk + 503B exclusion proposal pending)
- Chain locations — LaserAway, Ideal Image, Milan (corporate-locked stacks)
- 5+ PMS adapters at launch (Boulevard + generic webhook only until customer demand forces it)
- Public pricing page (consultation-only)
- AmSpa exhibitor booth (too expensive before 5+ references)
- Hiring before $30k MRR (founder-led sales until repeatable)
- Multi-voice templates (concierge-only in v1)
- Multiple service categories at launch (injectables-only MVP)

---

## 90-Day Success Metric

By end of Month 3:

- 5 paying pilot customers
- $5k MRR
- 1 published case study
- 1 Skytale or DC Advisory intro call completed
- AZ attorney + medical director on retainer

If hit: model is validated. If missed: the issue is almost certainly ICP (wrong buyer) or pitch (wrong message), not product.

---

## Next Action — Send 3 Emails Today

1. LinkedIn message to an Allergan Aesthetics rep in Scottsdale
2. AZ healthcare attorney inquiry (recommend Goldberg Law or Lengea — both have med spa practice)
3. Skytale Group managing director with the EV-multiplier thesis pitch

Everything else cascades from those three conversations.

# Unscheduled Treatment SMS — Proposal for Partner Review

**Status:** DRAFT — partner review required before any send
**Date:** 2026-06-01
**Author:** Trevor / Dentiflow
**Scope:** 32 Dental group (Village, Cottage, Western Springs)

---

## What this campaign is

A separate outreach track from recall. Recall = "come back for a cleaning, you're due." This campaign = "you've got real diagnosed work on the books we never closed — let's get it scheduled."

These are warm leads. Last visit within 6 months, diagnosed treatment (crown, RCT, implant, multi-procedure plans), never booked it. 504 patients across the group, $1.32M in unclosed case value.

## What this campaign is NOT

- Not recall. Different bank, different intent, different reply handling.
- Not "we noticed you have unscheduled treatment in your chart." That phrasing breaks the partner directive on chart/file/record language and reads creepy.
- Not aggressive sales. These patients ghosted for a reason — usually cost, fear, or life got in the way. The opening message should feel like a check-in, not a collections call.

---

## Voice rules (inherited from recall bank, locked 2026-05-05)

Same rules apply here. Reproducing for partner reference:

- Sentence case, proper punctuation. Not all-lowercase.
- Contractions always (haven't, we'll, I'm).
- Em dashes (—) for pauses, not hyphens.
- Max one exclamation point per conversation, preferably zero.
- Never lead with "Thanks for reaching out to X!"
- Never reference charts, files, records, treatment plans, or "we noticed." Anxiety risk.
- "I" or "we" — never "our team" or "our staff."
- Schedule/openings framing, not diagnostic framing.

---

## Cohort recommendation — start narrow

The brief shows three segments. Recommend launching to **Ghosting only (141 patients)** for the first send. Reasons:

1. Zero future-appointment conflict. The "Has Appt" 363 cohort is risky — they'll reply "but I already have an appointment on the 12th?" and erode trust.
2. Smaller cohort = faster iteration. If the first send converts at 10–15%, we expand.
3. Cleaner data story for partners. One number, one outcome.

Big Treatment (Last 60 Days) overlaps heavily with both Ghosting and Has Appt. Recommend filtering that segment to *only the rows that are also in Ghosting* — call this the **Hot Ghosting** subset and prioritize them inside the 141.

The Has Appt cohort gets handed to the front desk as a worklist, not an SMS send. They glance, they decide per patient.

---

## Voice assignment

Two voices only. Partners disliked the 3-voice complexity in recall at first — keep this simple.

| Voice | Trigger | Rationale |
|---|---|---|
| **Office** (default) | Case value < $3,000 | Single crown, filling, basic restorative. Friendly check-in works. |
| **Doctor** | Case value ≥ $3,000 | Implants, multi-crown, full-arch. Bigger decision, needs authority. |

No hygienist voice in this campaign — hygiene isn't the ask.

---

## Personalization — the procedure reference

**Trevor's call (2026-06-01):** generic check-in templates risk the "wait, what are they talking about?" reply. We need to name the actual treatment.

The trap: naming the treatment by saying "our records show you have an unscheduled crown" breaks the partner directive on chart/file/record language and reads surveillance-y.

The fix: frame the procedure as **conversational memory** between a human at the practice and the patient. Not "our records show" — "the crown we'd talked about." The difference is huge:

| ❌ Surveillance framing | ✅ Conversation framing |
|---|---|
| Our records show you have a crown pending | The crown we'd talked about |
| You have an unscheduled implant | The implant we'd mapped out |
| Per your treatment plan, you need a root canal | The root canal Dr. Smith mentioned |

This is how a real front-desk person would talk if they remembered the patient. It IS technically pulled from a record, but the framing makes it feel like memory — which is what we want.

### The `{{Procedure Reference}}` variable

Computed per patient from `Procedure Summary`. Compression rules:

| Case profile | Variable renders as |
|---|---|
| 1 procedure, named category | "the crown" / "the implant" / "the root canal" / "the bridge" |
| 2 procedures, same category | "the two crowns" / "both implants" |
| 2–3 procedures, mixed | "the crown and the other work" (biggest named, rest aggregated) |
| 4+ procedures | "the work we'd mapped out" / "the treatment plan we'd lined up" |
| Multi-tooth filling-only (low value) | "those couple of fillings" |
| Category unrecognized | Fall back to generic Day 0 (no procedure reference) — see below |

**Don't name the tooth number.** "The crown on #14" is too clinical. "The crown" is enough — if the patient asks which one, the front desk picks it up.

**Category detection by CDT code prefix:**
- Crown: D2740, D2750, D2790, D2792, D2794
- Implant: D6010, D6056, D6057, D6058, D6059, D6065, D6066, D6067
- Root canal: D3310, D3320, D3330, D3346, D3347, D3348
- Bridge: D6240, D6241, D6242, D6750, D6751, D6752
- Filling: D2391, D2392, D2393, D2394
- Extraction: D7140, D7210, D7220, D7230, D7240
- Other / unmatched → generic fallback

---

## Template bank

3 days × 2 voices × 2 variants = **12 templates**, plus a generic fallback bank for unrecognized procedure categories. Variant selection deterministic by phone hash mod 2. Patient gets the same variant across Day 0/4/8.

**Cadence:** Day 0 (ask) → Day 4 (objection diagnosis) → Day 8 (final, link).
**Frame:** Warm reason for texting + procedure named as conversational memory + A/B close on Day 0. Day 4 flips to objection isolation (timing vs cost/other). Day 8 is the lowest-barrier final touch with booking link.

### OFFICE VOICE (case value < $3,000)

#### Day 0 — Warm reason + procedure ref + A/B close (no booking link — A/B reply IS the close)

> **v1:** Hey {{First Name}}, {{Practice Name}} here. Had a few minutes and wanted to get you on the schedule for {{Procedure Reference}} we'd chatted about. Does this week or next work better?

> **v2:** Hey {{First Name}}, {{Practice Name}}. Had a quick second and wanted to get {{Procedure Reference}} we'd talked about on the books. Mornings or afternoons easier for you?

#### Day 4 — Objection diagnosis (no booking link — surfacing the blocker is the move)

> **v1:** Hey {{First Name}}, {{Practice Name}} again. Is it more a timing thing on {{Procedure Reference}}, or something else?

> **v2:** Hey {{First Name}}, {{Practice Name}}. Is timing the blocker on {{Procedure Reference}}, or something else going on?

#### Day 8 — Final, lowest barrier + booking link

> **v1:** Hey {{First Name}}, last note from {{Practice Name}} on {{Procedure Reference}}. Door's open whenever — grab a time here: {{Booking Link}}

> **v2:** Hey {{First Name}}, {{Practice Name}} one more time. No rush — link's here if you want it for {{Procedure Reference}}: {{Booking Link}}

### DOCTOR VOICE (case value ≥ $3,000)

#### Day 0 — Authority + warm reason + procedure ref + A/B close

> **v1:** Hey {{First Name}}, Dr. {{Doctor Name}} from {{Practice Name}}. Had some time between patients and wanted to get you on the calendar for {{Procedure Reference}} we'd mapped out. Does this week or next work better?

> **v2:** Hey {{First Name}}, Dr. {{Doctor Name}} at {{Practice Name}}. Had a quick second between patients and wanted to get {{Procedure Reference}} we'd talked about on the books. Mornings or afternoons easier?

#### Day 4 — Objection diagnosis (cost named directly — already in their head at this case value)

> **v1:** Hey {{First Name}}, Dr. {{Doctor Name}} again. Was it more a timing thing or the cost side holding {{Procedure Reference}} up?

> **v2:** Hey {{First Name}}, Dr. {{Doctor Name}}. Is {{Procedure Reference}} stuck on timing or on cost?

#### Day 8 — Lowest-barrier close + booking link

> **v1:** {{First Name}}, last from Dr. {{Doctor Name}}. Even a quick 15-min check on {{Procedure Reference}} — no commitment: {{Booking Link}}

> **v2:** {{First Name}}, Dr. {{Doctor Name}} one more time. If now's not right, totally fine. If it is: {{Booking Link}}

### Generic fallback (unrecognized procedure category)

When procedure codes don't map to a category, {{Procedure Reference}} drops to "the work we'd talked about" / "what we'd mapped out." Day 0 examples below; Day 4 and Day 8 use the same variable substitution.

> **Office Day 0 v1:** Hey {{First Name}}, {{Practice Name}} here. Had a few minutes and wanted to get you on the schedule for the work we'd chatted about. Does this week or next work better?

> **Office Day 0 v2:** Hey {{First Name}}, {{Practice Name}}. Had a quick second and wanted to get what we'd talked about on the books. Mornings or afternoons easier?

> **Doctor Day 0 v1:** Hey {{First Name}}, Dr. {{Doctor Name}} from {{Practice Name}}. Had some time between patients and wanted to get you on the calendar for what we'd mapped out. Does this week or next work better?

> **Doctor Day 0 v2:** Hey {{First Name}}, Dr. {{Doctor Name}}. Had a quick second between patients and wanted to get what we'd talked about on the books. Mornings or afternoons easier?

---

## Insurance benefits hook (conditional add-on)

Append to Day 8 only, and only when **all three** are true:
1. `Remaining Benefits` ≥ $500
2. `Renewal Month` = January
3. Current month is October, November, or December

**Add-on line (inserted before booking link):**

> Heads up — your benefits reset January 1, and there's still ${{Remaining Benefits}} on the table this year.

Don't use the hook outside that window. In June, "benefits reset in 6 months" is too far away to drive action and the line just adds friction.

---

## Reply handlers

These run as keyword-classified responses, same architecture as recall's `replyHandler`. **No LLM** on the first build — pure templates. We can graduate to Claude later if conversion warrants.

### Slot preference reply ("this week" / "next week" / "mornings" / "afternoons")

Triggered when the Day 0 A/B close gets a direct answer. Route to front desk with the preference flagged. Until calendar API integration lands (post-Ascend), the front desk drops 2–3 actual slot options or sends the booking link manually.

> Perfect — let me grab a couple options for you and I'll send them over shortly.

Flag patient `slot_preference={this_week|next_week|mornings|afternoons}`, exit sequence (do not send Day 4 or Day 8), notify front desk.

### Timing objection ("timing" / "schedule" / "busy" / "work")

Triggered on Day 4 reply. Names the flex inventory.

> We've got evenings and Saturdays open for {{Procedure Reference}}. What's better for you?

### Cost objection ("cost" / "money" / "expensive" / "can't afford" / "$")

Triggered on Day 4 reply. **Copy TBD — office-configurable.** This response depends on per-practice setup and partner preferences; locking generic copy here will read off-voice for whichever practice doesn't match.

Inputs needed from each practice before send:
- **Does the front desk verify insurance proactively?** If yes, we can promise the breakdown. If no, swap to a "let's get you in for a consult" pivot.
- **Financing partner?** Cherry, Sunbit, CareCredit, in-house — name it specifically, or omit if none. Don't reference a partner that doesn't exist.
- **Payment plan terms?** Typical monthly range for the case-value bands. Lets us say "usually $X–Y/month" instead of vague "monthly payments."
- **Close style preference?** Concrete action ("want me to run the numbers?") vs. trial close ("what would feel doable?") vs. reframe-only. Some doctors are comfortable with patient-anchoring sales moves, others aren't.

Three candidate templates pending office input:

> **(A) Concrete action:** Hear you. Want me to run your insurance and put together a payment option? Takes 10 minutes, no commitment.

> **(B) Trial close:** Got it. If we broke it into monthly payments — what number would feel doable for you?

> **(C) Reframe + binary:** Heard. Two things most folks don't know — insurance usually picks up more than they expect, and we can spread the rest into monthly payments. Want me to run the numbers?

Lock the chosen variant per practice during onboarding, not in the global template bank.

### Fear / anxiety ("nervous" / "scared" / "anxiety" / "afraid")

Surfaced as a third diagnosis answer occasionally. Acknowledge and offer the lowest-barrier next step.

> Heard. We've got options to make it easier — nitrous, oral sedation. Want to come in just to talk through it first, no procedure?

### Other / no objection ("just busy" / "I'll get to it" / "no objection")

> All good — door's open whenever. Want me to check back in a couple weeks?

### "I have an appointment already" / "I'm already booked"

> Got it — sorry for the extra ping. We'll see you then. If anything changes give us a call at {{Practice Phone}}.

Also: flag patient internally as `has_existing_appt=true`, exit sequence immediately, do NOT send Day 4 or Day 8.

### Cost question on Day 0 ("how much?" / "is this covered?")

Distinct from the Day 4 cost objection — this is curiosity, not refusal.

> Totally fair question. We always verify your insurance before you come in so there are no surprises — easiest way is to grab a quick consult and we'll walk you through it: {{Booking Link}}

### Emergency / pain ("my tooth hurts" / "something broke")

> I'm so sorry to hear that — give us a call at {{Practice Phone}} and we'll get you in ASAP.

Also: trigger staff SMS notification, exit sequence, escalate. Matches recall behavior.

### Not now / decline ("not interested right now" / "maybe later")

> No worries at all. Is it more of a timing thing, or has something changed? Either way, the door's open whenever.

Single soft either/or, no rebuttal. If they reply again with "timing" → "Got it, I'll check back in a couple months." Exit sequence. If "something changed" → route to front desk for human follow-up.

### Wrong number

> So sorry about that — I'll get you off the list right away. Have a good one.

Mark `wrong_number=true`, exit, never message again.

### Opt-out (STOP, UNSUBSCRIBE, REMOVE)

Standard TCPA-safe:

> Got it, you're off the list.

Set `unscheduled_tx_opt_out=true`. This is separate from `recall_opt_out` — a patient can opt out of unscheduled-tx outreach while staying eligible for recall.

---

## Conversion projection (honest range)

Industry benchmark for warm reactivation SMS to diagnosed-but-unscheduled patients is **10–25%**. For the 141-patient Ghosting cohort:

| Conversion | Patients booked | Case value closed |
|---|---|---|
| 10% (floor) | 14 | ~$37K |
| 15% (realistic) | 21 | ~$56K |
| 20% (stretch) | 28 | ~$75K |

If we expand to the full 504 after the first send proves out:

| Conversion | Patients booked | Case value closed |
|---|---|---|
| 10% | 50 | ~$132K |
| 15% | 76 | ~$199K |

These are *booked*, not *paid* — completion rate on booked big-case work is another 70–85% at most practices. Partners should see this whole funnel, not just the SMS reply rate.

---

## What needs partner approval before any send

1. **Procedure-naming framing:** Biggest call. Partners reviewed and locked "no chart/file/record" language on 2026-05-05. This bank names the actual procedure ("the crown we'd talked about") but frames it as conversational memory, not record lookup. Need explicit partner sign-off that this framing clears the directive.
2. **Copy:** Every template variant above. Same review process as the recall bank — partners read each one, mark up, sign off.
3. **Category mapping:** CDT-code → procedure-reference table above. Partners should sanity-check the natural-language labels ("the crown" / "the implant" / etc.) — they own the patient relationship.
4. **Fallback behavior:** When the procedure category doesn't map cleanly, drop to the generic Day 0 ("something we'd talked about"). Confirm that's the right move vs. excluding the patient entirely.
5. **Cohort:** Confirm Ghosting-only (141) as the first send vs. expanded scope.
6. **Voice split threshold:** $3,000 case-value cutoff for doctor voice. Easy to move — but lock the number before the send.
7. **Insurance hook:** Approve / kill the conditional add-on. Some practices don't like leveraging benefits language; need an explicit yes.
8. **Reply handler routing:** Especially "I have an appointment already" → exit sequence. Partners may want a front-desk notification instead.
9. **Send cadence:** Day 0 / Day 3 / Day 7 — confirm spacing. Recall is Day 0 / Day 1 / Day 3, tighter. This bank assumes unscheduled-tx patients need more breathing room.

---

## Implementation notes (for the build, not for partners)

- New template file: `src/services/recall/unscheduledTxTemplates.ts` (sibling to `templates.ts`, NOT in it).
- New sequence type: `unscheduled_tx` distinct from `recall`. Reuses sequence state machine but with its own day spacing and reply handler.
- New columns on patient record: `unscheduled_tx_eligible`, `unscheduled_tx_opt_out`, `unscheduled_tx_case_value`, `unscheduled_tx_case_type`, `unscheduled_tx_procedure_reference`.
- Voice assignment computed at sequence creation, stored on the sequence row.
- `procedure_reference` computed at import time from `Procedure Summary` via CDT-code prefix matching (see category table). Stored on the patient row so it stays consistent across Day 0/3/7 and matches whatever the front desk sees in the dashboard.
- Insurance hook computed at render time from `remaining_benefits` and `renewal_month` columns.
- Send safety: same rate limit (1/sec), same `paused` default on import, same `--confirm` gate on launch script. New CLI: `npx tsx scripts/unscheduled-tx-launch.ts`.

---

## Next steps

1. Partners read this doc, mark up copy.
2. Trevor revises, re-circulates.
3. Locked copy goes into `unscheduledTxTemplates.ts` with the same "PARTNER-LOCKED" header as the recall bank.
4. Pilot send to Ghosting cohort (141), one location at a time — Cottage first (largest, 241 group total but Ghosting subset TBD).
5. Measure reply rate, book rate, case-value-closed at 7d / 14d / 30d.
6. Expand to Has Appt cohort only after front desk has been briefed and worklist tool exists.

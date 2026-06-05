// Recall SMS Template Bank — v3 (PARTNER-APPROVED, 2026-05-05)
// 18 recall templates (3 voices × 3 days × 2 variants) + 4 no-show templates.
//
// THIS IS THE CANONICAL SET. Do not add, remove, or rewrite copy without
// partner re-approval. Variant selection is deterministic by phone hash so
// each patient receives the same variant across Day 0/1/3.
//
// Change history:
// - v1 (initial): 45 recall + 10 no-show templates, 5 variants per cell
// - v2 (audit, 2026-05-05): cut to top 2 winners per cell after multi-agent
//   conversion audit. Removed v3/v4/v5 across the board.
// - v3 (partner review, 2026-05-05):
//   * Removed all "chart/file/patient record" references — partners flagged
//     these as anxiety-spiking. Doctor Day 0 v1 reframed to "time between
//     patients"; hygienist Day 0 reframed to "openings/cancellation".
//   * Hygienist voice converted from "I/me" to "we/us" throughout — the
//     {{Hygienist Name}} variable renders as "hygiene team", so collective
//     voice now matches the rendered output.
//   * Office Day 0 v2 tightened: "wanted to check in since you're due for
//     a visit" (replaced "and see if you're due").
//
// Design principles:
// 1. Radical brevity — target 1 SMS segment (160 chars), hard ceiling 320
// 2. Open loops — Day 0 doctor/hygienist: unresolved question, NO CTA
// 3. Authority without accusation — sender owns the concern
// 4. Guilt removal + implication in one breath
// 5. Specific > generic
// 6. Sender as subject, not patient
// 7. No dead-end conversations
// 8. NO references to charts, files, or patient records (partner directive)
//
// HIPAA compliance:
// - General clinical pattern language only
// - Reference scheduling data only
// - No diagnoses, X-rays, treatment plans, clinical findings
// - No banned words: exam, baseline, comprehensive, overdue, cleaning,
//   hygiene visit, prophy, prophylaxis, periodontal
// - No time-gap language: "it's been", "since your last"
// - No guilt/shame, no emojis, no ALL CAPS
// - Natural contractions (I'd, I'll, don't, it's)

import { createHash } from 'crypto';
import type {
  RecallVoice,
  SequenceDay,
  TemplateVariant,
  RecallTemplate,
  TemplateBank,
} from '../../types/recall';

// =============================================================================
// NO-SHOW RECOVERY TEMPLATES
// 4 templates: 2 message days × 2 variants, office voice only
// =============================================================================

export type NoshowDay = 1 | 2;

const NOSHOW_TEMPLATES: Record<NoshowDay, Record<TemplateVariant, RecallTemplate>> = {
  // Message 1 — Sent 1 hour after missed appointment
  // Tone: Understanding, zero guilt, assumes they intended to come
  1: {
    v1: {
      subject: '',
      body: `Hey {{First Name}}, we missed you today! No worries at all. Want me to get you rescheduled? I've got a few spots open this week.`,
    },
    v2: {
      subject: '',
      body: `Hey {{First Name}}, looks like we missed each other today. Totally fine. Want to grab another spot this week? I can check what's open.`,
    },
  },
  // Message 2 — Sent 24 hours later if no reply
  // Tone: Gentle follow-up, soft binary CTA
  2: {
    v1: {
      subject: '',
      body: `Hey {{First Name}}, just following up from yesterday. Would this week or next work better to reschedule?`,
    },
    v2: {
      subject: '',
      body: `Hey {{First Name}}, just a quick follow-up. Still have some openings if you'd like to rebook. Mornings or afternoons easier for you?`,
    },
  },
};

export function selectNoshowTemplate(
  noshowDay: NoshowDay,
  patientPhone: string
): RecallTemplate {
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const variantNum = (hashInt % 2) + 1;
  const variantId = `v${variantNum}` as TemplateVariant;

  return NOSHOW_TEMPLATES[noshowDay][variantId];
}

export function getNoshowTemplateId(
  noshowDay: NoshowDay,
  patientPhone: string
): string {
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const variantNum = (hashInt % 2) + 1;
  return `noshow_day${noshowDay}_v${variantNum}`;
}

// =============================================================================
// TEMPLATE BANK — winners only (top 2 per voice × day from audit)
// =============================================================================

const TEMPLATES: TemplateBank = {
  // =========================================================================
  // OFFICE VOICE (< 6 months overdue)
  // Tone: Friendly, casual, "we" language. No CTA on Day 0 — open a loop.
  // =========================================================================
  office: {
    // Day 0 — Warm check-in, open loop (NO CTA, NO booking link)
    0: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, quick note from {{Practice Name}}. We've been thinking about getting you back in. You around to chat for a sec?`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, hope things are good. Team at {{Practice Name}} wanted to check in since you're due for a visit. You free to text?`,
      },
    },
    // Day 1 — Patient-outcome frame + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} again. Most things that turn into bigger issues don't hurt until they do. Worth a quick visit to make sure you're good: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} again. You probably feel fine — most people do. That's actually when it's easiest to stay that way. Pick a time: {{Booking Link}}`,
      },
    },
    // Day 3 — Remove inertia + 30% off offer + booking link
    3: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} one more time. If getting back on the schedule has just kept slipping — we get it. 30% off when you come back in. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, last note from {{Practice Name}}. No pressure, no lecture — just an open spot and 30% off when you come back in. Grab it if you want it: {{Booking Link}}`,
      },
    },
  },

  // =========================================================================
  // HYGIENIST VOICE (6-12 months overdue)
  // Tone: Personal, hygiene team voice. NO CTA on Day 0.
  // Day 0 reframed away from "chart/file" — uses openings/cancellation hook.
  // =========================================================================
  hygienist: {
    // Day 0 — Personal reach-out + open loop (NO CTA)
    0: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, this is {{Hygienist Name}} at {{Practice Name}}. Had a couple openings come up this week and wanted to reach out before they fill. You free to text for a sec?`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} from {{Practice Name}} here. Had a cancellation this morning and you were one of the first we thought of. You around?`,
      },
    },
    // Day 1 — Patient-outcome frame (hygiene team voice) + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team from {{Practice Name}} again. The patients we worry about most are the ones who feel fine and keep putting it off. Don't want that to be you. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team at {{Practice Name}}. We'd rather you come in and have nothing to find than not come in and miss something. Grab a spot: {{Booking Link}}`,
      },
    },
    // Day 3 — Acknowledge avoidance + 30% off offer + booking link
    3: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team here. Last thing from us. If you've been putting it off, we're not here to make you feel bad about it. Just come in — 30% off when you come back in: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team one more time. The hardest part is booking. We're taking 30% off when you come back in. Everything else is easy: {{Booking Link}}`,
      },
    },
  },

  // =========================================================================
  // DOCTOR VOICE (12+ months overdue)
  // Tone: Direct, authoritative, "I" language. NO CTA on Day 0.
  // Day 0 reframed away from "chart review" — uses schedule/between-patients.
  // =========================================================================
  doctor: {
    // Day 0 — Authority + open loop (NO CTA)
    0: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} here from {{Practice Name}}. Had some time between patients this morning and was thinking about folks I haven't caught up with in a while — you came to mind. Got a sec to text?`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, it's Dr. {{Doctor Name}} at {{Practice Name}}. I know it's been a while and that's totally fine. Had something I wanted to run by you though. You around?`,
      },
    },
    // Day 1 — Patient-outcome frame (doctor voice) + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. The things I wish I'd seen earlier — they never announced themselves. I'd rather rule things out than assume. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. I'd rather you come in and leave with good news than keep waiting. Grab a time: {{Booking Link}}`,
      },
    },
    // Day 3 — Clinical close + 30% off offer + booking link
    3: {
      v1: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} here. Last message from me. I'd genuinely rather see you and find nothing than not see you and miss something. 30% off when you come back in: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `{{First Name}}, last thing from Dr. {{Doctor Name}}. I've taken 30% off your visit back. If there's ever a time to come in, it's now: {{Booking Link}}`,
      },
    },
  },
};

// =============================================================================
// DAY 3 DEADLINE OFFER (A/B TEST — treatment arm)
// Identical to the standard Day 3 copy except for a "book by {{Offer Deadline}}"
// deadline (BOOK by, not visit by). {{Offer Deadline}} auto-fills as send date + 5 days.
// Hygienist uses v2 only (v1 dropped per partner); v1 mirrors v2 as a safety
// net so an accidental v1 lookup still renders correct copy.
// =============================================================================
const DAY3_DEADLINE: Record<RecallVoice, Record<TemplateVariant, RecallTemplate>> = {
  office: {
    v1: { subject: '', body: `Hey {{First Name}}, {{Practice Name}} one more time. If getting back on the schedule has just kept slipping — we get it. 30% off when you come back in — just book by {{Offer Deadline}}. Grab a time: {{Booking Link}}` },
    v2: { subject: '', body: `Hey {{First Name}}, last note from {{Practice Name}}. No pressure, no lecture — just an open spot and 30% off if you book by {{Offer Deadline}}. Grab it if you want it: {{Booking Link}}` },
  },
  hygienist: {
    v1: { subject: '', body: `Hey {{First Name}}, hygiene team one more time. The hardest part is booking. We're taking 30% off if you book by {{Offer Deadline}} — everything else is easy: {{Booking Link}}` },
    v2: { subject: '', body: `Hey {{First Name}}, hygiene team one more time. The hardest part is booking. We're taking 30% off if you book by {{Offer Deadline}} — everything else is easy: {{Booking Link}}` },
  },
  doctor: {
    v1: { subject: '', body: `{{First Name}}, Dr. {{Doctor Name}} here. Last message from me. I'd genuinely rather see you and find nothing than not see you and miss something. 30% off when you come back in — just book by {{Offer Deadline}}: {{Booking Link}}` },
    v2: { subject: '', body: `{{First Name}}, last thing from Dr. {{Doctor Name}}. I've taken 30% off your visit back — book by {{Offer Deadline}}. If there's ever a time to come in, it's now: {{Booking Link}}` },
  },
};

// Existing-patient reassurance (partner-approved 2026-06-05). Ascend's public
// booking link is the new-patient funnel (/soe/new/), so returning patients see
// a "new patient" label and some abandon. Appended to every link-bearing message
// (Day 1 + Day 3) to preempt that drop-off. No banned words (file/chart/record),
// no time-gap language.
const NEW_PATIENT_NOTE = `\n\nIf it says "new patient," that's normal — just keep going.`;

// =============================================================================
// TEMPLATE SELECTION & RENDERING
// =============================================================================

export function selectTemplate(
  assignedVoice: RecallVoice,
  sequenceDay: SequenceDay,
  patientPhone: string,
  experimentArm?: string | null,
  useDeadlineOffer = false
): RecallTemplate {
  // MD5 hash of phone → deterministic variant selection (mod 2)
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  let variantNum = (hashInt % 2) + 1;

  // Hygienist Day 3 uses v2 only — v1 dropped per partner (2026-06-04).
  if (assignedVoice === 'hygienist' && sequenceDay === 3) {
    variantNum = 2;
  }

  // Mid-experiment override (2026-05-13): doctor Day 1 v1 reads too jargon-y
  // ("things I wish I'd seen earlier — they never announced themselves").
  // Route all doctor Day 1 sends to v2 ("rather you come in and leave with
  // good news than keep waiting") which is plainer and converts as well.
  // Doctor Day 0 and Day 3 variants remain split per phone hash.
  if (assignedVoice === 'doctor' && sequenceDay === 1) {
    variantNum = 2;
  }

  // Partner directive (2026-05-14): for the Village Dental A/B test only,
  // doctor voice is off for Day 3 — those patients receive the office voice
  // Day 3 offer instead. Scoped to A/B sequences (experiment_arm set) so
  // post-test campaigns retain all three voices on Day 3.
  const day3Voice: RecallVoice =
    assignedVoice === 'doctor' && sequenceDay === 3 && experimentArm === 'control_voice'
      ? 'office'
      : assignedVoice;

  const variantId = `v${variantNum}` as TemplateVariant;

  // Day 3 deadline A/B (treatment arm): same copy + "good through {{Offer
  // Deadline}}". Only applies on Day 3.
  if (useDeadlineOffer && sequenceDay === 3) {
    return DAY3_DEADLINE[day3Voice][variantId];
  }

  return TEMPLATES[day3Voice][sequenceDay][variantId];
}

export function renderTemplate(
  template: RecallTemplate,
  firstName: string,
  practiceName: string,
  doctorName: string,
  hygienistName: string,
  bookingLink?: string,
  offerDeadline?: string
): string {
  let body = template.body;

  body = body.replace(/\{\{First Name\}\}/g, firstName);
  body = body.replace(/\{\{Practice Name\}\}/g, practiceName);
  body = body.replace(/\{\{Doctor Name\}\}/g, doctorName);
  body = body.replace(/\{\{Hygienist Name\}\}/g, 'hygiene team');
  if (bookingLink) {
    body = body.replace(/\{\{Booking Link\}\}/g, bookingLink);
  }
  if (offerDeadline) {
    body = body.replace(/\{\{Offer Deadline\}\}/g, offerDeadline);
  }

  // Append the existing-patient reassurance to any message carrying a link.
  if (bookingLink) {
    body += NEW_PATIENT_NOTE;
  }

  return body;
}

export function getTemplateId(
  assignedVoice: RecallVoice,
  sequenceDay: SequenceDay,
  patientPhone: string,
  experimentArm?: string | null,
  useDeadlineOffer = false
): string {
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  let variantNum = (hashInt % 2) + 1;
  // Match selectTemplate override — doctor Day 1 always reports v2.
  if (assignedVoice === 'doctor' && sequenceDay === 1) {
    variantNum = 2;
  }
  // Match selectTemplate override — hygienist Day 3 is v2 only.
  if (assignedVoice === 'hygienist' && sequenceDay === 3) {
    variantNum = 2;
  }
  // Match selectTemplate override — doctor Day 3 routes to office voice
  // for the A/B test only.
  const day3Voice =
    assignedVoice === 'doctor' && sequenceDay === 3 && experimentArm === 'control_voice'
      ? 'office'
      : assignedVoice;
  // Deadline arm gets a "_dl" suffix so sends are distinguishable in logs.
  const suffix = useDeadlineOffer && sequenceDay === 3 ? '_dl' : '';
  return `${day3Voice}_day${sequenceDay}_v${variantNum}${suffix}`;
}

// Recall SMS Template Bank — v2
// 45 templates: 3 voices × 3 days × 5 variants
//
// Template selection is deterministic based on phone number hash.
//
// Design principles:
// 1. Radical brevity — target 1 SMS segment (160 chars), hard ceiling 320
// 2. Open loops — Day 0 doctor/hygienist: unresolved question, NO CTA
// 3. Authority without accusation — sender owns the concern
// 4. Guilt removal + implication in one breath
// 5. Specific > generic
// 6. Sender as subject, not patient
// 7. No dead-end conversations
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
// 10 templates: 2 message days × 5 variants, office voice only
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
    v3: {
      subject: '',
      body: `Hey {{First Name}}, noticed you weren't able to make it in today. Life happens. Would you like me to find you another time this week?`,
    },
    v4: {
      subject: '',
      body: `Hey {{First Name}}, we had you down for today but looks like it didn't work out. No stress. Want me to look at what's open this week or next?`,
    },
    v5: {
      subject: '',
      body: `Hey {{First Name}}, hope everything's ok. We missed you today. If you'd like to reschedule, just let me know and I'll find you a spot.`,
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
    v3: {
      subject: '',
      body: `Hey {{First Name}}, wanted to circle back. Would you prefer to come in this week or next? Happy to work around your schedule.`,
    },
    v4: {
      subject: '',
      body: `Hey {{First Name}}, just checking in one more time. If you'd like to rebook, I can look at what we have open. This week or next?`,
    },
    v5: {
      subject: '',
      body: `Hey {{First Name}}, still have a spot with your name on it if you want it. Would earlier or later in the week work better?`,
    },
  },
};

export function selectNoshowTemplate(
  noshowDay: NoshowDay,
  patientPhone: string
): RecallTemplate {
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const variantNum = (hashInt % 5) + 1;
  const variantId = `v${variantNum}` as TemplateVariant;

  return NOSHOW_TEMPLATES[noshowDay][variantId];
}

export function getNoshowTemplateId(
  noshowDay: NoshowDay,
  patientPhone: string
): string {
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const variantNum = (hashInt % 5) + 1;
  return `noshow_day${noshowDay}_v${variantNum}`;
}

// =============================================================================
// TEMPLATE BANK
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
        body: `Hey {{First Name}}, this is {{Practice Name}} reaching out. Wanted to see if you'd be open to coming back in sometime soon. Got a minute?`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} here. We'd love to get you back on the schedule. Would that work for you?`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, hope things are good. Team at {{Practice Name}} wanted to check in and see if you're due for a visit. You free to text?`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, hello from {{Practice Name}}. Just wanted to reach out and see if you'd like to come by soon. You around?`,
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
        body: `Hey {{First Name}}, {{Practice Name}} here. The easy stuff stays easy when you catch it early. Grab a time and we'll make sure everything's looking good: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} again. A lot of patients tell us they wished they'd come in sooner. We'd rather that not be you. Grab a spot: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} here. Small things are easy. Big things aren't. We'd love to make sure yours are still small: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} again. You probably feel fine — most people do. That's actually when it's easiest to stay that way. Pick a time: {{Booking Link}}`,
      },
    },
    // Day 3 — Remove inertia + complimentary visit + booking link
    3: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} one more time. If getting back on the schedule has just kept slipping — we get it. First visit back is on us, no strings. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, last one from us. We know re-booking after a gap feels like a bigger deal than it is. Come in, we'll take care of you. First visit is covered: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} here. We'd rather have you back than not. First visit is on us — pick a time whenever you're ready: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, last note from {{Practice Name}}. No pressure, no lecture — just an open spot and a covered visit. Grab it if you want it: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} one last time. If cost or timing has been the thing, we've taken care of the cost part. First visit back is free: {{Booking Link}}`,
      },
    },
  },

  // =========================================================================
  // HYGIENIST VOICE (6-12 months overdue)
  // Tone: Personal, "I" language, uses hygienist name. NO CTA on Day 0.
  // =========================================================================
  hygienist: {
    // Day 0 — Personal reach-out + open loop (NO CTA)
    0: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, this is {{Hygienist Name}} from {{Practice Name}}. Your name came up on my schedule today and I wanted to reach out. Got a sec to chat?`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, it's {{Hygienist Name}} at {{Practice Name}}. Had something I wanted to mention to you. You around?`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} here from {{Practice Name}}. I was going through my patient list and wanted to check in with you. Got a minute?`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, this is {{Hygienist Name}} at {{Practice Name}}. Your file came across my desk this morning and wanted to reach out. Are you free to text for a sec?`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} from {{Practice Name}} here. Your chart came across my desk and I wanted to touch base. You around?`,
      },
    },
    // Day 1 — Patient-outcome frame (hygiene team voice) + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team from {{Practice Name}} again. The patients I worry about most are the ones who feel fine and keep putting it off. Don't want that to be you. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team here. Honestly what I see most is things that were totally fixable early becoming a much bigger deal. Easy to avoid. Pick a time: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team at {{Practice Name}}. I'd rather you come in and have nothing to find than not come in and miss something. Grab a spot: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team again. The gap between "totally fine" and "wish I'd come in sooner" is usually one visit. Let's make sure you stay on the right side of it: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team here. Most of what we catch could've been nothing if we'd seen it a little earlier. Worth the visit: {{Booking Link}}`,
      },
    },
    // Day 3 — Acknowledge avoidance + barrier removal + booking link
    3: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team one last time. I know getting back in after a gap is the hardest part — it's always less of a deal than it feels like. First visit's on me: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team here. Last thing from me. If you've been putting it off, I'm not here to make you feel bad about it. Just come in. First visit is covered: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team at {{Practice Name}}. Last one, I promise. I've got a no-cost spot with your name on it. Easier than you think: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team again. I'd really rather you come in than keep worrying about it. First visit back is on me — grab a time: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, hygiene team one more time. The hardest part is booking. I've made it free. Everything else is easy: {{Booking Link}}`,
      },
    },
  },

  // =========================================================================
  // DOCTOR VOICE (12+ months overdue)
  // Tone: Direct, authoritative, "I" language. NO CTA on Day 0.
  // =========================================================================
  doctor: {
    // Day 0 — Authority + open loop (NO CTA)
    0: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} here. Your name came up when I was reviewing charts today and I wanted to reach out. Got a sec to text?`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, it's Dr. {{Doctor Name}} at {{Practice Name}}. I know it's been a while and that's totally fine. Had something I wanted to run by you though. You around?`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} from {{Practice Name}}. Was going through my schedule this morning and your chart got flagged. Nothing urgent, just want to check in.`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, this is Dr. {{Doctor Name}}. Was reviewing some patient charts and yours came up. Wanted to reach out personally. Got a minute?`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} here from {{Practice Name}}. Had something come up I wanted to touch base with you about. You free to text?`,
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
        body: `{{First Name}}, Dr. {{Doctor Name}} here. I've seen enough to know that "feeling fine" and "everything's fine" aren't always the same thing. Pick a time: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. If something's developing, catching it now is the difference between a simple fix and a real problem. I'd rather it be simple: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} here. I'm not trying to alarm you — most of the time it's nothing. But the times it isn't, earlier is always better. Pick a time: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. I'd rather you come in and leave with good news than keep waiting. Grab a time: {{Booking Link}}`,
      },
    },
    // Day 3 — Clinical close + remove last barrier + booking link
    3: {
      v1: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} one last time. If anything's been holding you back — cost, timing, whatever — I've taken care of the cost. Come in: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} here. Last message from me. I'd genuinely rather see you and find nothing than not see you and miss something. First visit's on me: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}}. Last one. I've set aside a no-cost visit for patients I haven't seen in a while. I'd like you to take it: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} one more time. I'm not going to keep following up — but I did want to make this as easy as possible. First visit back is covered: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `{{First Name}}, last thing from Dr. {{Doctor Name}}. I've waived the cost for your visit back. If there's ever a time to come in, it's now: {{Booking Link}}`,
      },
    },
  },
};

// =============================================================================
// TEMPLATE SELECTION & RENDERING
// =============================================================================

export function selectTemplate(
  assignedVoice: RecallVoice,
  sequenceDay: SequenceDay,
  patientPhone: string
): RecallTemplate {
  // MD5 hash of phone → deterministic variant selection
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const variantNum = (hashInt % 5) + 1;
  const variantId = `v${variantNum}` as TemplateVariant;

  return TEMPLATES[assignedVoice][sequenceDay][variantId];
}

export function renderTemplate(
  template: RecallTemplate,
  firstName: string,
  practiceName: string,
  doctorName: string,
  hygienistName: string,
  bookingLink?: string
): string {
  let body = template.body;

  body = body.replace(/\{\{First Name\}\}/g, firstName);
  body = body.replace(/\{\{Practice Name\}\}/g, practiceName);
  body = body.replace(/\{\{Doctor Name\}\}/g, doctorName);
  body = body.replace(/\{\{Hygienist Name\}\}/g, 'hygiene team');
  if (bookingLink) {
    body = body.replace(/\{\{Booking Link\}\}/g, bookingLink);
  }

  return body;
}

export function getTemplateId(
  assignedVoice: RecallVoice,
  sequenceDay: SequenceDay,
  patientPhone: string
): string {
  const hash = createHash('md5').update(patientPhone).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const variantNum = (hashInt % 5) + 1;
  return `${assignedVoice}_day${sequenceDay}_v${variantNum}`;
}

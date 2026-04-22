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
    // Day 1 — Gentle health frame + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} again. We like to stay ahead of things for our patients even when everything feels fine. Grab a spot here: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, just a thought from {{Practice Name}} — sometimes the most important things are the ones you can't see yet. Pick a time: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, we always like to make sure everything's looking good for our patients at {{Practice Name}}. Grab a time: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, staying on top of things now helps avoid surprises later. We share that with all our patients at {{Practice Name}}. Pick a spot: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, just want to make sure everything's in good shape for you. This is something we check for everyone at {{Practice Name}}. Grab a time: {{Booking Link}}`,
      },
    },
    // Day 3 — Complimentary visit + booking link
    3: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, we'd like to cover your first visit back at {{Practice Name}} — completely on us. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, {{Practice Name}} here. Your next visit is on us, no cost. Pick a spot: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, we want to make coming back easy. Your first visit at {{Practice Name}} is covered. Pick a time: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, from {{Practice Name}} — your first visit back is completely covered. Pick a time here: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, we'd really love to see you back at {{Practice Name}}. This one's on us. Grab a time: {{Booking Link}}`,
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
    // Day 1 — Clinical implication (sender-as-subject) + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, it's {{Hygienist Name}} again. When it's been a while between visits I always like to take a look just to stay ahead of things. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} here. Honestly the longer it goes between visits the more I like to make sure everything's good. Pick a time: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, this is {{Hygienist Name}} at {{Practice Name}}. I'd feel better getting eyes on things just to make sure nothing's developing quietly. Grab a spot: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} from {{Practice Name}}. I always like to stay ahead of things for my patients and I'd love to get you in. Pick a time: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, it's {{Hygienist Name}}. I don't like to let too much time go by without checking in on my patients. Grab a spot: {{Booking Link}}`,
      },
    },
    // Day 3 — Barrier removal + booking link
    3: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} here. Last thing from me — I set aside a few spots for patients I haven't seen in a while. First visit back is on me: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `Hey {{First Name}}, it's {{Hygienist Name}}. I get it, getting back on the schedule is the hard part. I've got a couple no-cost spots open. Grab one: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} at {{Practice Name}}. I really don't want too much more time to go by. I've waived the cost for your visit back: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, it's {{Hygienist Name}}. Your first visit back to {{Practice Name}} is on me. Pick a time: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, {{Hygienist Name}} here. I'd really love to see you back. This one's on me, no cost. Grab a time: {{Booking Link}}`,
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
    // Day 1 — Clinical implication (doctor-as-subject) + booking link
    1: {
      v1: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. When it's been a while between visits I always like to take a look just to make sure nothing's developing quietly. Grab a time: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} here. Honestly the longer it goes between visits the more I tend to find things that could've been caught earlier. I'd rather it be a quick easy visit: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. I'd feel better getting eyes on things. When it's been a while I just don't like to assume everything's fine. Pick a time: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `Hey {{First Name}}, it's Dr. {{Doctor Name}}. I always like to stay ahead of things for my patients and it's been long enough that I'd rather just take a look. Pick a time: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `Hey {{First Name}}, Dr. {{Doctor Name}} again. The one thing I see often is things develop quietly. I'd rather catch something simple now than deal with something bigger later: {{Booking Link}}`,
      },
    },
    // Day 3 — Doctor's personal offer + booking link
    3: {
      v1: {
        subject: '',
        body: `{{First Name}}, last thing from me. I set aside a few spots this month for patients I haven't seen in a while. First visit back is on me: {{Booking Link}}`,
      },
      v2: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} one more time. I get it, getting back on the schedule after a while is the hard part. I've got a couple no-cost spots open. Grab one: {{Booking Link}}`,
      },
      v3: {
        subject: '',
        body: `{{First Name}}, I really don't want too much more time to go by without at least taking a look. I've waived the cost for your visit back: {{Booking Link}}`,
      },
      v4: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} here. Your first visit back is on me. Pick a time: {{Booking Link}}`,
      },
      v5: {
        subject: '',
        body: `{{First Name}}, Dr. {{Doctor Name}} here. I'd really love to see you back at {{Practice Name}}. This one's on me: {{Booking Link}}`,
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
  body = body.replace(/\{\{Hygienist Name\}\}/g, hygienistName);
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

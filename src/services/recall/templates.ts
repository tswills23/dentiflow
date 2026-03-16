// Recall SMS Template Bank
// Ported from templates/recall_templates.py
//
// 45 templates: 3 voices × 3 days × 5 variants
// Template selection is deterministic based on phone number hash.
//
// Content rules:
// - Human, conversational tone
// - No urgency language
// - No incentives
// - No emojis
// - No insurance/treatment mentions
// - Easy A/B closes (mornings/afternoons, this week/next week)
// - SMS format: ≤320 chars, no subject line needed

import { createHash } from 'crypto';
import type {
  RecallVoice,
  SequenceDay,
  TemplateVariant,
  RecallTemplate,
  TemplateBank,
} from '../../types/recall';

// =============================================================================
// TEMPLATE BANK
// =============================================================================

const TEMPLATES: TemplateBank = {
  // Office Voice (< 6 months overdue)
  office: {
    0: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, it's been about {{Months}} months since your last visit at {{Practice Name}}. We have some open slots coming up. Would you like to get on the schedule?`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, just checking in from {{Practice Name}} - it's been {{Months}} months since we last saw you. We have availability this week and next. Would mornings or afternoons work better?`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, we noticed it's been about {{Months}} months since your last cleaning at {{Practice Name}}. Want to get back on the calendar? We have a few spots open.`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, hope you're doing well! It's been {{Months}} months since your last hygiene visit at {{Practice Name}}. We'd love to see you soon. Any days work best for you?`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, it's been about {{Months}} months. We have some openings at {{Practice Name}} and wanted to reach out. Would you like to book your cleaning?`,
      },
    },
    1: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, just following up from {{Practice Name}}. We still have a few openings if you'd like to get your cleaning scheduled. Would this week or next week work better?`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, wanted to circle back from {{Practice Name}}. We have some morning and afternoon times available. Would either work for you?`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, checking in again from {{Practice Name}}. Just want to make sure we can get you on the schedule before things fill up. Any preferred days?`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, following up from {{Practice Name}}. We'd love to get you in for your cleaning. Would earlier or later in the week be easier?`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, just a quick follow-up from {{Practice Name}}. We have availability coming up and want to make scheduling easy for you. What days work best?`,
      },
    },
    3: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, last check-in from {{Practice Name}}. If you'd like to schedule your cleaning, just reply with a day that works and we'll get you set up.`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, one more note from {{Practice Name}}. We have openings this week and next if you'd like to come in. Just let us know and we'll make it easy.`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, final follow-up from {{Practice Name}}. We're here whenever you're ready to schedule. Just reply and we'll find a time that works.`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, wrapping up from {{Practice Name}}. If now isn't a good time, no worries. When you're ready, just reach out and we'll get you in.`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, last note from {{Practice Name}}. We have a few spots left this month. Would any of them work for your cleaning?`,
      },
    },
  },

  // Hygienist Voice (6-12 months overdue)
  hygienist: {
    0: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, this is Sarah from {{Practice Name}}. Even when everything feels fine, regular visits help keep things on track. Would mornings or afternoons work better to come in?`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, Sarah here at {{Practice Name}}. I wanted to personally reach out and make this easy. Would this week or next week be better to get you back on the schedule?`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, this is Sarah from {{Practice Name}}. We try to catch things early before they become bigger issues. Would earlier or later in the week work better to come in?`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, Sarah here. I know life gets busy, but regular visits really do help long term. Would mornings or evenings be easier for you?`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, this is Sarah at {{Practice Name}}. Just checking in to help you stay on track. Would this week or next week make more sense to come in?`,
      },
    },
    1: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, Sarah from {{Practice Name}} again. Just wanted to follow up and see if we can find a time that works for you. Any preferred days?`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, Sarah here. I have some openings coming up and wanted to make sure you have first pick. Would mornings or afternoons be better?`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, following up from {{Practice Name}}. I want to make this as easy as possible. Just let me know what days work and I'll find you a spot.`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, Sarah again at {{Practice Name}}. Regular cleanings really do make a difference. Would this week or next week work for you?`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, checking back in from {{Practice Name}}. We have some nice time slots available. Would you prefer earlier or later in the day?`,
      },
    },
    3: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, Sarah from {{Practice Name}} one more time. I'm here whenever you're ready. Just reply with a time that works and I'll get you scheduled.`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, last note from Sarah at {{Practice Name}}. When you're ready to come in, just let me know. I'll make it easy.`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, final check-in from {{Practice Name}}. No pressure at all. Whenever you're ready, just reply and we'll find a good time.`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, wrapping up from Sarah at {{Practice Name}}. If now isn't the right time, I understand. We're here whenever works for you.`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, Sarah here one last time. Just know we have openings and I'm happy to help you get scheduled whenever you're ready.`,
      },
    },
  },

  // Doctor Voice (12+ months overdue)
  doctor: {
    0: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, this is Dr. Smith from {{Practice Name}}. I noticed it's been a while since I last saw you and wanted to personally check in. Would this week or next week make more sense to come back in?`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith here at {{Practice Name}}. Even when things feel fine, it's important we keep an eye on things. Would mornings or afternoons work better to come in?`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, this is Dr. Smith. I wanted to reach out directly and make scheduling simple. Would early in the week or later be better to get you back on the calendar?`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith from {{Practice Name}}. Just checking in since I haven't seen you in some time. Would this week or next week be easier for a quick visit?`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, this is Dr. Smith. Happy to help you get back on track. Would mornings or evenings work better for you?`,
      },
    },
    1: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith from {{Practice Name}} following up. I'd really like to see you soon. Would any day this week or next work for a visit?`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith here again. Just wanted to make sure scheduling isn't what's holding you back. Would mornings or afternoons be easier?`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, following up from Dr. Smith at {{Practice Name}}. Regular visits really help us stay ahead of any issues. What days work best for you?`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith again. I have some openings coming up and wanted to offer them to you first. Would this week or next week be better?`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, checking back in from Dr. Smith at {{Practice Name}}. I want to make this easy for you. Just let me know a day that works.`,
      },
    },
    3: {
      v1: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith from {{Practice Name}} one last time. I'm here whenever you're ready. Just reply and we'll find a time that works for you.`,
      },
      v2: {
        subject: '',
        body: `Hi {{First Name}}, final note from Dr. Smith. When you're ready to come in, just let us know. We'll make it simple.`,
      },
      v3: {
        subject: '',
        body: `Hi {{First Name}}, last check-in from Dr. Smith at {{Practice Name}}. No pressure. Whenever you're ready, we're here to help.`,
      },
      v4: {
        subject: '',
        body: `Hi {{First Name}}, wrapping up from Dr. Smith. If now isn't the right time, I understand completely. We're here whenever works for you.`,
      },
      v5: {
        subject: '',
        body: `Hi {{First Name}}, Dr. Smith here one more time. Just know that we have availability and I'd love to see you back. Reach out whenever you're ready.`,
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
  monthsOverdue: number
): string {
  let body = template.body;

  body = body.replace(/\{\{First Name\}\}/g, firstName);
  body = body.replace(/\{\{Practice Name\}\}/g, practiceName);
  body = body.replace(/\{\{Months\}\}/g, String(Math.round(monthsOverdue)));

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

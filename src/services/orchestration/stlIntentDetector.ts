export type Intent =
  | 'emergency'
  | 'booking_request'
  | 'insurance_question'
  | 'pricing_question'
  | 'service_question'
  | 'slot_confirmation'
  | 'greeting'
  | 'opt_out'
  | 'general_inquiry';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  signals: string[];
  requiresEscalation: boolean;
  escalationReason?: string;
}

const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
  emergency: [
    /\bpain\b/i, /\bhurts?\b/i, /\bache\b/i, /\baching\b/i,
    /\bswoll?en\b/i, /\bswelling\b/i, /\bbroken\b/i, /\bchipped\b/i,
    /\bcracked\b/i, /\bknocked out\b/i, /\bbleeding\b/i, /\babscess\b/i,
    /\binfection\b/i, /\bthrobbing\b/i, /\bcan'?t eat\b/i, /\bcan'?t sleep\b/i,
    /\bemergency\b/i, /\btrauma\b/i, /\bsevere\b/i,
    /\bcrown (came|fell) off\b/i, /\btooth (came|fell) out\b/i,
  ],
  booking_request: [
    /\bbook\b/i, /\bschedule\b/i, /\bappointment\b/i, /\bavailable\b/i,
    /\bopenings?\b/i, /\bcome in\b/i, /\bnew patient\b/i, /\bsign up\b/i,
    /\bget started\b/i, /\bwhen can I\b/i, /\bset up\b/i, /\bneed to see\b/i,
    /\bwant to (come|visit|see)\b/i, /\bmaking an?\b/i,
    /\bhaven'?t been in a while\b/i, /\bfirst time\b/i,
  ],
  insurance_question: [
    /\binsurance\b/i, /\bcoverage\b/i, /\bcovered\b/i, /\bPPO\b/i,
    /\bHMO\b/i, /\bDelta Dental\b/i, /\bCigna\b/i, /\bAetna\b/i,
    /\bMetLife\b/i, /\bUnited\b/i, /\baccept\b/i, /\btake my\b/i,
    /\bin[- ]?network\b/i, /\bout[- ]?of[- ]?network\b/i,
    /\bbenefits?\b/i,
  ],
  pricing_question: [
    /\bhow much\b/i, /\bcost\b/i, /\bprice\b/i, /\bpricing\b/i,
    /\bexpensive\b/i, /\baffordable\b/i, /\bfee\b/i, /\bpayment plan\b/i,
    /\bfinancing\b/i, /\bwhat does it run\b/i, /\bcharge\b/i,
  ],
  service_question: [
    /\bwhat is\b/i, /\bhow does\b/i, /\bhow long\b/i,
    /\bwhat to expect\b/i, /\bdoes it hurt\b/i, /\bis it painful\b/i,
    /\brecovery\b/i, /\bdowntime\b/i, /\bhow many visits\b/i,
    /\bwhat happens\b/i, /\btell me about\b/i,
  ],
  slot_confirmation: [
    /^(yes|yeah|yep|sure|ok|okay|sounds? good|that works?|perfect|great)\b/i,
    /\b(first|second|third)\s*(one|option|time)?\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    /\b\d{1,2}:\d{2}\b/,
    /\b(morning|afternoon|evening)\b/i,
  ],
  greeting: [
    /^(hi|hey|hello|good (morning|afternoon|evening)|howdy|what'?s up)\s*[!.?]?\s*$/i,
  ],
  opt_out: [
    /\bstop\b/i, /\bunsubscribe\b/i, /\bopt[- ]?out\b/i,
    /\bremove me\b/i, /\bdon'?t text\b/i, /\bstop (texting|messaging)\b/i,
  ],
  general_inquiry: [],
};

// Escalation triggers
const IMMEDIATE_ESCALATION_PATTERNS = [
  { pattern: /\bmedication\b/i, reason: 'medication_inquiry' },
  { pattern: /\b(lawsuit|legal|attorney|lawyer|complaint|sue)\b/i, reason: 'legal_mention' },
  { pattern: /\bspeak to (the |a )?(doctor|dentist|dr\.?)\b/i, reason: 'doctor_request' },
  { pattern: /\bpregnant\b/i, reason: 'pregnancy_mention' },
  { pattern: /\b(severe|really bad|extreme|unbearable|worst)\b/i, reason: 'severe_symptoms' },
];

export function detectIntent(
  message: string,
  lastOutboundOfferedTimes: boolean = false
): IntentResult {
  const msg = message.trim();
  const signals: string[] = [];
  const scores: Record<Intent, number> = {
    emergency: 0,
    booking_request: 0,
    insurance_question: 0,
    pricing_question: 0,
    service_question: 0,
    slot_confirmation: 0,
    greeting: 0,
    opt_out: 0,
    general_inquiry: 0,
  };

  // Score each intent
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [Intent, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(msg)) {
        scores[intent]++;
        signals.push(`${intent}:${pattern.source}`);
      }
    }
  }

  // Emergency override — if ANY emergency signal fires, it wins
  if (scores.emergency > 0) {
    const escalation = checkEscalation(msg);
    return {
      intent: 'emergency',
      confidence: Math.min(scores.emergency / 3, 1),
      signals,
      requiresEscalation: true,
      escalationReason: escalation?.reason || 'emergency_intent',
    };
  }

  // Opt-out override
  if (scores.opt_out > 0) {
    return {
      intent: 'opt_out',
      confidence: 1,
      signals,
      requiresEscalation: false,
    };
  }

  // Greeting — only if message is short and no other intents scored
  if (scores.greeting > 0 && msg.length < 30) {
    const otherScores = Object.entries(scores)
      .filter(([k]) => k !== 'greeting' && k !== 'general_inquiry')
      .reduce((sum, [, v]) => sum + v, 0);
    if (otherScores === 0) {
      return {
        intent: 'greeting',
        confidence: 1,
        signals,
        requiresEscalation: false,
      };
    }
  }

  // Slot confirmation — only if we recently offered times
  if (scores.slot_confirmation > 0 && lastOutboundOfferedTimes) {
    return {
      intent: 'slot_confirmation',
      confidence: Math.min(scores.slot_confirmation / 2, 1),
      signals,
      requiresEscalation: false,
    };
  }

  // Find highest scoring intent
  const ranked = (Object.entries(scores) as [Intent, number][])
    .filter(([k]) => k !== 'general_inquiry' && k !== 'slot_confirmation' && k !== 'greeting')
    .sort((a, b) => b[1] - a[1]);

  if (ranked[0] && ranked[0][1] > 0) {
    // If booking + pricing both score, booking wins (action > question)
    if (scores.booking_request > 0 && scores.pricing_question > 0) {
      const escalation = checkEscalation(msg);
      return {
        intent: 'booking_request',
        confidence: Math.min(scores.booking_request / 3, 1),
        signals,
        requiresEscalation: !!escalation,
        escalationReason: escalation?.reason,
      };
    }

    const escalation = checkEscalation(msg);
    return {
      intent: ranked[0][0],
      confidence: Math.min(ranked[0][1] / 3, 1),
      signals,
      requiresEscalation: !!escalation,
      escalationReason: escalation?.reason,
    };
  }

  // Fallback
  const escalation = checkEscalation(msg);
  return {
    intent: 'general_inquiry',
    confidence: 0.3,
    signals,
    requiresEscalation: !!escalation,
    escalationReason: escalation?.reason,
  };
}

function checkEscalation(message: string): { reason: string } | null {
  for (const { pattern, reason } of IMMEDIATE_ESCALATION_PATTERNS) {
    if (pattern.test(message)) {
      return { reason };
    }
  }
  return null;
}

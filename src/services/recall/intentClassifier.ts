// Intent Classifier for Recall Booking Agent
// Ported from execution/booking_agent/intent_classifier.py
//
// Key Design Principles:
// 1. CONTEXT-AWARE: Same words mean different things in different stages
//    - "yes" in S0_OPENING = booking_interest
//    - "yes" in S4_AVAILABILITY = confirm
// 2. PRIORITY-ORDERED: Check high-impact intents first (opt_out > urgent)
// 3. KEYWORD-SPECIFIC: No overlapping keywords between intents

import type {
  RecallStage,
  RecallIntent,
  IntentClassification,
  TimePreferences,
  TimeOfDay,
  DayOfWeek,
} from '../../types/recall';

// =============================================================================
// Keyword Definitions (NO OVERLAPS between intents)
// =============================================================================

const OPT_OUT_KEYWORDS = [
  'unsubscribe', 'opt out', 'opt-out', 'optout', 'remove me',
  'stop emailing', 'stop texting', 'stop contacting', 'stop messaging',
  'dont contact', "don't contact", 'do not contact', 'leave me alone',
  'take me off', 'remove from list', 'no more emails', 'spam',
];

const URGENT_KEYWORDS = [
  'pain', 'painful', 'hurts', 'hurt', 'hurting', 'ache', 'aching',
  'emergency', 'urgent', 'asap', 'bleeding', 'blood', 'swollen',
  'swelling', 'broken', 'cracked', 'chipped', 'infection', 'abscess',
];

const COST_KEYWORDS = [
  'cost', 'price', 'how much', 'insurance', 'coverage', 'copay',
  'deductible', 'payment plan', 'payment option', 'payment', 'afford',
  'expensive', 'fee', 'financing', 'estimate', 'quote', 'ballpark',
];

const NOT_NOW_KEYWORDS = [
  'not right now', 'not now', 'maybe later', 'check back',
  'remind me later', 'not a good time', 'another time',
  'in a few months', 'reach out later', 'not this month',
  'too busy', 'im busy', "i'm busy", 'busy right now',
];

const DECLINE_KEYWORDS = [
  'no thanks', 'no thank you', 'not interested', 'pass',
  'already have a dentist', 'have a dentist', 'no longer a patient',
  "i'm good", 'im good', "i'm all set", 'all set', 'no need',
];

const CONFIRM_KEYWORDS = [
  'sounds good', 'that works', 'works for me', 'perfect',
  'awesome', 'great', "let's do it", 'lets do it', 'book it',
  'confirmed', 'confirm',
];

const BOOKING_INTEREST_KEYWORDS = [
  'book', 'schedule', 'appointment', 'interested',
  "i'd like", 'id like', 'i would like', 'sign me up',
  'count me in', 'put me down', 'get scheduled', 'come in',
  'cleaning', 'cleanings', 'checkup', 'check-up', 'exam',
  'i need', 'need to',
];

const BOOKED_CONFIRMATION_KEYWORDS = [
  'i booked', 'i scheduled', 'already booked', 'already scheduled',
  'just booked', 'just scheduled', 'got one', 'got an appointment',
  'made an appointment', 'booked one', 'booked it', 'scheduled it',
  'all set', 'all done', 'took care of it', 'done', 'i did',
  'booked online', 'scheduled online',
];

const ASKING_AVAILABILITY_KEYWORDS = [
  'what times', 'what time', 'available', 'availability',
  'do you have', 'any openings', 'any slots', 'what days',
  'show me', 'let me see', 'what options', 'what are my options',
];

const SHORT_POSITIVE = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay'];

const SHORT_POSITIVE_PHRASES = [
  'sure thing', 'yes please', 'yep please', 'yeah please',
  'sounds good', 'works for me', 'that works',
];

const SLOT_EXACT = ['1', '2', '3', 'one', 'two', 'three'];

const SLOT_PHRASES = [
  'option 1', 'option 2', 'option 3',
  'number 1', 'number 2', 'number 3',
  '#1', '#2', '#3',
  'first', 'second', 'third',
  'first one', 'second one', 'third one',
  'the first', 'the second', 'the third',
];

const DAY_MAPPINGS: Record<string, DayOfWeek> = {
  monday: 'Monday', mon: 'Monday',
  tuesday: 'Tuesday', tues: 'Tuesday', tue: 'Tuesday',
  wednesday: 'Wednesday', wed: 'Wednesday', weds: 'Wednesday',
  thursday: 'Thursday', thurs: 'Thursday', thu: 'Thursday',
  friday: 'Friday', fri: 'Friday',
  saturday: 'Saturday', sat: 'Saturday',
  sunday: 'Sunday', sun: 'Sunday',
};

const TIME_MAPPINGS: Record<string, TimeOfDay> = {
  morning: 'morning', mornings: 'morning',
  afternoon: 'afternoon', afternoons: 'afternoon',
  evening: 'evening', evenings: 'evening',
};

const POSITIVE_EMOJIS = [
  '\u{1F44D}', '\u2705', '\u{1F44C}', '\u{1F642}', '\u{1F60A}',
  '\u{1F600}', '\u{1F389}', '\u{1F4AF}', '\u2714\uFE0F', '\u263A\uFE0F',
  '\u{1F44F}',
];

// =============================================================================
// Matching Helpers
// =============================================================================

function matchAny(text: string, keywords: string[]): boolean {
  for (const kw of keywords) {
    const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
    if (pattern.test(text)) return true;
  }
  return false;
}

function getMatches(text: string, keywords: string[]): string[] {
  const matches: string[] = [];
  for (const kw of keywords) {
    const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
    if (pattern.test(text)) matches.push(kw);
  }
  return matches;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isShortPositive(text: string): boolean {
  const t = text.trim().toLowerCase();

  if (SHORT_POSITIVE.includes(t)) return true;
  if (t === 'k') return true;

  const clean = t.replace(/[^\w]/g, '');
  if (SHORT_POSITIVE.includes(clean)) return true;

  for (const phrase of SHORT_POSITIVE_PHRASES) {
    if (t.includes(phrase)) return true;
  }

  if (t.startsWith('yes') && t.length < 15) return true;

  return false;
}

function checkSlotSelection(text: string): string[] | null {
  const t = text.trim().toLowerCase();
  const clean = t.replace(/[^\w\s]/g, '');

  if (clean.length <= 10) {
    const words = clean.split(/\s+/);
    for (const num of SLOT_EXACT) {
      if (words.includes(num) || clean === num) return [num];
    }
  }

  for (const phrase of SLOT_PHRASES) {
    if (t.includes(phrase)) return [phrase];
  }

  return null;
}

function checkEmojis(text: string): string[] | null {
  const matched = POSITIVE_EMOJIS.filter((e) => text.includes(e));

  let noEmoji = text;
  for (const e of POSITIVE_EMOJIS) {
    noEmoji = noEmoji.replaceAll(e, '');
  }
  noEmoji = noEmoji.trim();

  if (matched.length > 0 && noEmoji.length < 10) return matched;
  return null;
}

function checkPreferences(text: string): string[] {
  const matches: string[] = [];

  for (const dayKey of Object.keys(DAY_MAPPINGS)) {
    const pattern = new RegExp(`\\b${dayKey}s?\\b`, 'i');
    if (pattern.test(text)) matches.push(dayKey);
  }

  for (const timeKey of Object.keys(TIME_MAPPINGS)) {
    const pattern = new RegExp(`\\b${timeKey}\\b`, 'i');
    if (pattern.test(text)) matches.push(timeKey);
  }

  return matches;
}

function fuzzyMatchBooking(text: string): string[] {
  const targets = ['yes', 'yeah', 'yep', 'sure', 'book', 'schedule'];
  const matches: string[] = [];

  for (const word of text.split(/\s+/)) {
    for (const target of targets) {
      if (word === target) continue;
      const ratio = similarityRatio(word, target);
      if (ratio > 0.75) matches.push(`${word}~${target}`);
    }
  }

  return matches;
}

function similarityRatio(a: string, b: string): number {
  // SequenceMatcher-like ratio
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;

  let matches = 0;
  const used = new Set<number>();

  for (let i = 0; i < shorter.length; i++) {
    for (let j = 0; j < longer.length; j++) {
      if (!used.has(j) && shorter[i] === longer[j]) {
        matches++;
        used.add(j);
        break;
      }
    }
  }

  return (2.0 * matches) / (a.length + b.length);
}

// =============================================================================
// Main Classifier
// =============================================================================

export function classifyIntent(
  text: string,
  currentStage: RecallStage
): IntentClassification {
  const textLower = text.toLowerCase().trim();
  const textClean = textLower.replace(/[^\w\s]/g, '');

  // Check for emoji-only messages FIRST
  const emojiMatch = checkEmojis(text);
  if (emojiMatch && !textClean.trim()) {
    if (currentStage === 'S4_AVAILABILITY') {
      return { intent: 'confirm', confidence: 'high', matchedKeywords: emojiMatch, rawText: text };
    }
  }

  // Empty/whitespace (and no emoji) → unclear
  if (!textClean.trim()) {
    return { intent: 'unclear', confidence: 'low', matchedKeywords: [], rawText: text };
  }

  // 1. ALWAYS CHECK: Opt-out (highest priority, any stage)
  if (matchAny(textLower, OPT_OUT_KEYWORDS)) {
    return { intent: 'opt_out', confidence: 'high', matchedKeywords: getMatches(textLower, OPT_OUT_KEYWORDS), rawText: text };
  }

  // 2. CHECK COST before URGENT
  if (matchAny(textLower, COST_KEYWORDS)) {
    return { intent: 'cost_question', confidence: 'high', matchedKeywords: getMatches(textLower, COST_KEYWORDS), rawText: text };
  }

  // 3. URGENT (pain, emergency)
  if (matchAny(textLower, URGENT_KEYWORDS)) {
    return { intent: 'urgent', confidence: 'high', matchedKeywords: getMatches(textLower, URGENT_KEYWORDS), rawText: text };
  }

  // 3b. BOOKED CONFIRMATION (patient says they booked via the link)
  if (matchAny(textLower, BOOKED_CONFIRMATION_KEYWORDS)) {
    return { intent: 'booked_confirmation', confidence: 'high', matchedKeywords: getMatches(textLower, BOOKED_CONFIRMATION_KEYWORDS), rawText: text };
  }

  // 4. STAGE-SPECIFIC: S4_AVAILABILITY
  if (currentStage === 'S4_AVAILABILITY') {
    const slotMatch = checkSlotSelection(textClean);
    if (slotMatch) {
      return { intent: 'slot_selection', confidence: 'high', matchedKeywords: slotMatch, rawText: text };
    }

    const emojiConfirm = checkEmojis(text);
    if (emojiConfirm) {
      return { intent: 'confirm', confidence: 'high', matchedKeywords: emojiConfirm, rawText: text };
    }

    if (isShortPositive(textClean)) {
      return { intent: 'confirm', confidence: 'high', matchedKeywords: [textClean], rawText: text };
    }

    if (matchAny(textLower, CONFIRM_KEYWORDS)) {
      return { intent: 'confirm', confidence: 'high', matchedKeywords: getMatches(textLower, CONFIRM_KEYWORDS), rawText: text };
    }

    const prefMatches = checkPreferences(textLower);
    if (prefMatches.length > 0) {
      return { intent: 'preferences', confidence: 'high', matchedKeywords: prefMatches, rawText: text };
    }

    if (matchAny(textLower, NOT_NOW_KEYWORDS)) {
      return { intent: 'not_now', confidence: 'high', matchedKeywords: getMatches(textLower, NOT_NOW_KEYWORDS), rawText: text };
    }

    if (matchAny(textLower, DECLINE_KEYWORDS)) {
      return { intent: 'decline', confidence: 'high', matchedKeywords: getMatches(textLower, DECLINE_KEYWORDS), rawText: text };
    }

    return { intent: 'unclear', confidence: 'low', matchedKeywords: [], rawText: text };
  }

  // 5. STAGE-SPECIFIC: S0_OPENING, S3_TIME_PREF, and all other stages
  if (matchAny(textLower, NOT_NOW_KEYWORDS)) {
    return { intent: 'not_now', confidence: 'high', matchedKeywords: getMatches(textLower, NOT_NOW_KEYWORDS), rawText: text };
  }

  if (matchAny(textLower, DECLINE_KEYWORDS)) {
    return { intent: 'decline', confidence: 'high', matchedKeywords: getMatches(textLower, DECLINE_KEYWORDS), rawText: text };
  }

  const prefMatches = checkPreferences(textLower);
  if (prefMatches.length > 0) {
    return { intent: 'preferences', confidence: 'high', matchedKeywords: prefMatches, rawText: text };
  }

  if (matchAny(textLower, ASKING_AVAILABILITY_KEYWORDS)) {
    return { intent: 'asking_availability', confidence: 'high', matchedKeywords: getMatches(textLower, ASKING_AVAILABILITY_KEYWORDS), rawText: text };
  }

  if (matchAny(textLower, BOOKING_INTEREST_KEYWORDS)) {
    return { intent: 'booking_interest', confidence: 'high', matchedKeywords: getMatches(textLower, BOOKING_INTEREST_KEYWORDS), rawText: text };
  }

  if (isShortPositive(textClean)) {
    return { intent: 'booking_interest', confidence: 'high', matchedKeywords: [textClean], rawText: text };
  }

  const fuzzy = fuzzyMatchBooking(textClean);
  if (fuzzy.length > 0) {
    return { intent: 'booking_interest', confidence: 'medium', matchedKeywords: fuzzy, rawText: text };
  }

  return { intent: 'unclear', confidence: 'low', matchedKeywords: [], rawText: text };
}

// =============================================================================
// Preference Parsing
// =============================================================================

export function parsePreferences(text: string): TimePreferences {
  const textLower = text.toLowerCase();

  const days: DayOfWeek[] = [];
  const excludedDays: DayOfWeek[] = [];

  for (const [dayKey, dayValue] of Object.entries(DAY_MAPPINGS)) {
    const dayPattern = new RegExp(`\\b${dayKey}s?\\b`, 'i');
    if (dayPattern.test(textLower)) {
      const negation = new RegExp(`(not|except|no|avoid|cant|can't)\\s+${dayKey}`, 'i');
      if (negation.test(textLower)) {
        if (!excludedDays.includes(dayValue)) excludedDays.push(dayValue);
      } else {
        if (!days.includes(dayValue)) days.push(dayValue);
      }
    }
  }

  let timeOfDay: TimeOfDay = 'any';
  for (const [timeKey, timeValue] of Object.entries(TIME_MAPPINGS)) {
    const timePattern = new RegExp(`\\b${timeKey}\\b`, 'i');
    if (timePattern.test(textLower)) {
      const negation = new RegExp(`(not|except|no|avoid)\\s+${timeKey}`, 'i');
      if (!negation.test(textLower)) {
        timeOfDay = timeValue;
        break;
      }
    }
  }

  return { days, timeOfDay, excludedDays, rawText: text };
}

// =============================================================================
// Slot Number Extraction
// =============================================================================

export function extractSlotNumber(text: string): number | null {
  const clean = text.toLowerCase().trim().replace(/[^\w\s]/g, '');

  if (clean.includes('1') || clean.includes('one') || clean.includes('first')) return 1;
  if (clean.includes('2') || clean.includes('two') || clean.includes('second')) return 2;
  if (clean.includes('3') || clean.includes('three') || clean.includes('third')) return 3;
  return null;
}

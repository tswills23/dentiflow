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

// FCC-canonical single-word opt-out keywords — match ONLY when they are
// effectively the entire message. "Stop in Thursday" / "end of month" /
// "quit hurting" / "cancel my appointment" must NOT trigger opt_out.
// See SINGLE_WORD_OPT_OUT_TOKENS check below.
const SINGLE_WORD_OPT_OUT_TOKENS = [
  'stop', 'stopall', 'unsubscribe', 'quit', 'end', 'cancel', 'revoke',
];

// Multi-word opt-out phrases — these are unambiguous regardless of surrounding text
const OPT_OUT_KEYWORDS = [
  'opt out', 'opt-out', 'optout', 'remove me',
  'stop emailing', 'stop texting', 'stop contacting', 'stop messaging',
  'dont contact', "don't contact", 'do not contact', 'leave me alone',
  'take me off', 'remove from list', 'no more emails', 'no more',
  // NOTE: "spam" removed — "is this spam?" is a curiosity question, not a STOP request
  // Over-contact / frustration phrasings (Jeffrey Wilson incident 2026-06-04): a patient
  // annoyed at the texting frequency is a stop request. These slipped past 'stop texting'
  // because of different word boundaries ("stop text spamming" != "stop texting"), fell to
  // the LLM, and got a follow-up question right after asking us to stop. Honor as opt-out.
  // Kept conservative/unambiguous to avoid false-positive permanent opt-outs.
  'stop spamming', 'spamming me', 'text spamming', 'stop the texts', 'stop the text',
  'quit texting', 'too many texts', 'too many text', 'you keep texting', 'keep texting me',
  'stop sending texts', 'stop sending me text', 'stop with the text', 'enough texts',
];

// Returns true if the message is *effectively* a single TCPA opt-out token
// (the token alone, possibly with punctuation/exclamation). "STOP", "stop.",
// "Stop!", "STOP " all match. "stop in Thursday" and "end of month" do NOT.
function isStandaloneOptOut(text: string): boolean {
  const cleaned = text.toLowerCase().trim().replace(/[^\w]/g, '');
  return SINGLE_WORD_OPT_OUT_TOKENS.includes(cleaned);
}

const URGENT_KEYWORDS = [
  'pain', 'painful', 'hurts', 'hurt', 'hurting', 'ache', 'aching',
  'emergency', 'urgent', 'asap', 'bleeding', 'blood', 'swollen',
  'swelling', 'broken', 'cracked', 'chipped', 'infection', 'abscess',
  'tooth fell out', 'knocked out', 'knocked a tooth',
  // Pain-idiom expansion — common patient phrasings the original list missed
  'killing me', 'killing', 'agony', 'agonizing', 'throbbing', 'pounding',
  "can't sleep", 'cant sleep', "can't eat", 'cant eat',
  'fever', 'pus', 'numb', 'face swollen', 'jaw locked',
  "can't open", 'cant open',
];

const COST_KEYWORDS = [
  'cost', 'price', 'how much', 'insurance', 'coverage', 'copay',
  'deductible', 'payment plan', 'payment option', 'afford',
  'expensive', 'financing', 'estimate', 'quote', 'ballpark',
];

const WRONG_NUMBER_KEYWORDS = [
  'wrong number', 'wrong person', 'you have the wrong',
  "this isn't", 'this isnt', 'not me', 'never been a patient',
  'not a patient',
];

const NOT_NOW_KEYWORDS = [
  'not right now', 'not now', 'maybe later', 'check back',
  'remind me later', 'not a good time', 'another time',
  'in a few months', 'reach out later', 'not this month',
  'too busy', 'im busy', "i'm busy", 'busy right now',
  'busy this', 'next month', 'next year',
  'some other time', 'later this year',
];

const DECLINE_KEYWORDS = [
  'no thanks', 'no thank you', 'not interested', 'pass on this',
  'already have a dentist', 'have a dentist', 'no longer a patient',
  "i'm good", 'im good', 'no need', "don't need", 'dont need',
  'not for me', "i'll pass", 'ill pass',
];

// Patient wants a human to call/handle it, OR is asking for records/admin help.
// These should NOT get the self-serve booking link — they go to a human handoff
// and (for call requests) onto the office's call list.
const CALLBACK_KEYWORDS = [
  'call me', 'give me a call', 'can you call', 'could you call', 'please call',
  'call me back', 'call back', 'give me a ring', 'gimme a call',
  'talk to someone', 'speak to someone', 'speak with someone',
  'talk to a person', 'talk to a human', 'talk to a real',
  'set an apt with', 'set an appointment with you', 'set up an appointment with you',
  'book it for me', 'just book it for me',
];

const RECORDS_KEYWORDS = [
  'my records', 'dental records', 'send my records', 'my dental records',
  'my chart', 'medical records', 'transfer my records', 'get my records',
  'records you have', 'records that you', 'copy of my records',
];

// Patient has moved / relocated and can't come anymore → warm exit, no booking push.
const MOVED_KEYWORDS = [
  'moved', 'relocated', 'moving away', 'move away', 'out of state',
  'no longer in the area', 'not in the area', 'in the area anymore',
  'not close to the area', 'not being close to the area', 'not close to',
  "don't live", 'dont live', 'no longer live', "i've moved", 'ive moved',
  'left the area', 'too far away', 'far away now',
];

// Patient was recently seen / is already current → acknowledge, don't push booking.
const ALREADY_HANDLED_KEYWORDS = [
  'just had my teeth cleaned', 'had my teeth cleaned', 'just got my teeth cleaned',
  'got my teeth cleaned', 'just had a cleaning', 'just had my cleaning',
  'just had a checkup', 'just had my checkup',
  'just came in', 'already came in', 'recently came in', 'was just in',
  'just been in', 'already been in', 'just saw the dentist', 'already saw the dentist',
  'just went to the dentist', 'already went in',
];

// A message that is essentially just a phone number = "here's my number, call me".
function isBarePhoneNumber(text: string): boolean {
  const digits = text.replace(/\D/g, '');
  const letters = text.replace(/[^a-zA-Z]/g, '');
  return (digits.length === 10 || digits.length === 11) && letters.length <= 2;
}

// Deterministic detection for human-handoff / moved / already-seen — stage-independent.
// Returns the intent, or null if none apply. Used by both the main classifier and
// the pre-LLM critical filter so these sensitive cases are handled reliably, not by the LLM.
function classifyHumanOrExit(textLower: string, rawText: string): RecallIntent | null {
  if (matchAny(textLower, CALLBACK_KEYWORDS) || matchAny(textLower, RECORDS_KEYWORDS) || isBarePhoneNumber(rawText)) {
    return 'needs_human';
  }
  if (matchAny(textLower, MOVED_KEYWORDS)) return 'moved';
  if (matchAny(textLower, ALREADY_HANDLED_KEYWORDS)) return 'already_handled';
  return null;
}

const CONFIRM_KEYWORDS = [
  'that works', 'perfect',
  'confirmed', 'confirm', 'book it',
];

const BOOKING_INTEREST_KEYWORDS = [
  'book', 'schedule', 'appointment', 'interested',
  "i'd like", 'id like', 'i would like', 'sign me up',
  'count me in', 'put me down', 'get scheduled', 'come in',
  'cleaning', 'cleanings', 'checkup', 'check-up', 'exam',
  'i need', 'need to',
  'open to it', "i'd be open", 'id be open', 'down for it',
  "i'm in", 'im in', 'lets do it', "let's do it",
  'sounds great', 'sounds good', 'works for me', 'why not',
  'ok lets do it', 'ok sure', 'alright', 'all right',
  'for sure', 'yea sure', 'yeah sure', 'go for it', 'go ahead',
  "let's go", 'lets go', "i'll do it", 'ill do it', 'lets book',
  "let's book", 'please do', 'send it', 'send it over',
  'send over', 'let me know', 'of course', 'absolutely',
  'definitely',
];

const BOOKED_CONFIRMATION_KEYWORDS = [
  'i booked', 'i scheduled', 'already booked', 'already scheduled',
  'just booked', 'just scheduled', 'got an appointment',
  'made an appointment', 'booked one', 'booked it', 'scheduled it',
  'took care of it', 'booked online', 'scheduled online',
  // NOTE: Removed "all set", "done", "all done", "i did", "got one" —
  // these conflict with decline/confirm and caused false positives.
];

const ASKING_AVAILABILITY_KEYWORDS = [
  'what times', 'what time', 'available', 'availability',
  'do you have', 'any openings', 'any slots', 'what days',
  'show me', 'let me see', 'what options', 'what are my options',
  'next week', 'open next', 'have open',
];

const SHORT_POSITIVE = [
  'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay',
  'ya', 'yea', 'ye', 'k', 'kk', 'cool', 'down',
];

const SHORT_POSITIVE_PHRASES = [
  'sure thing', 'yes please', 'yep please', 'yeah please',
  'sounds good', 'works for me', 'that works', 'im down',
  "i'm down",
];

// Negation markers — if present with a positive token, downgrade to unclear
const NEGATION_MARKERS = [
  ' but ', ' not ', ' no ', "don't", "dont ", ' except ',
  ' however ', ' although ',
];

// Phrases asking which office/practice this is — answer with identity, don't treat as booking
const IDENTIFY_PRACTICE_PHRASES = [
  'what office', 'which office', 'what practice', 'which practice',
  'what dental', 'which dental', 'what dentist', 'which dentist',
  'what office is this', 'which office is this',
  'where is this from', 'where are you',
  'what place is this', 'what location',
];

// Phrases that signal engagement/curiosity — treat as booking_interest at S0_OPENING
const CURIOSITY_PHRASES = [
  'whats this about', "what's this about", 'what is this about',
  'whats this', "what's this", 'what is this',
  'what do you need', 'what do you want', 'what did you need',
  'who is this', 'who are you', 'who is this from',
  'tell me more', 'what for', 'about what',
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

function hasNegation(text: string): boolean {
  const padded = ` ${text.toLowerCase()} `;
  return NEGATION_MARKERS.some(m => padded.includes(m));
}

function isShortPositive(text: string): boolean {
  const t = text.trim().toLowerCase();

  // Reject any short text containing negation ("yes but no", "yes not today")
  if (hasNegation(t)) return false;

  if (SHORT_POSITIVE.includes(t)) return true;

  const clean = t.replace(/[^\w]/g, '');
  if (SHORT_POSITIVE.includes(clean)) return true;

  for (const phrase of SHORT_POSITIVE_PHRASES) {
    if (t.includes(phrase)) return true;
  }

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
    // Emoji-only at any other stage = positive engagement
    return { intent: 'booking_interest', confidence: 'high', matchedKeywords: emojiMatch, rawText: text };
  }

  // Empty/whitespace (and no emoji) → unclear
  if (!textClean.trim()) {
    return { intent: 'unclear', confidence: 'low', matchedKeywords: [], rawText: text };
  }

  // 1. ALWAYS CHECK: Opt-out (highest priority, any stage)
  //    Single-word TCPA tokens (stop/end/cancel/quit/etc.) must be standalone
  //    so we don't mis-opt-out "stop in Thursday" or "end of month".
  if (isStandaloneOptOut(text) || matchAny(textLower, OPT_OUT_KEYWORDS)) {
    const matched = isStandaloneOptOut(text)
      ? [text.toLowerCase().trim().replace(/[^\w]/g, '')]
      : getMatches(textLower, OPT_OUT_KEYWORDS);
    return { intent: 'opt_out', confidence: 'high', matchedKeywords: matched, rawText: text };
  }

  // 2. URGENT BEFORE COST — "my tooth hurts, how much" must escalate to emergency,
  //    not get routed to cost handoff.
  if (matchAny(textLower, URGENT_KEYWORDS)) {
    return { intent: 'urgent', confidence: 'high', matchedKeywords: getMatches(textLower, URGENT_KEYWORDS), rawText: text };
  }

  // 3. COST
  if (matchAny(textLower, COST_KEYWORDS)) {
    return { intent: 'cost_question', confidence: 'high', matchedKeywords: getMatches(textLower, COST_KEYWORDS), rawText: text };
  }

  // 3a. WRONG NUMBER — treat as needs_human handoff, not opt_out
  if (matchAny(textLower, WRONG_NUMBER_KEYWORDS)) {
    return { intent: 'decline', confidence: 'high', matchedKeywords: getMatches(textLower, WRONG_NUMBER_KEYWORDS), rawText: text };
  }

  // 3b. BOOKED CONFIRMATION (patient says they booked via the link)
  if (matchAny(textLower, BOOKED_CONFIRMATION_KEYWORDS)) {
    return { intent: 'booked_confirmation', confidence: 'high', matchedKeywords: getMatches(textLower, BOOKED_CONFIRMATION_KEYWORDS), rawText: text };
  }

  // 3c. HUMAN HANDOFF / MOVED / ALREADY-SEEN (stage-independent, checked before
  //     booking_interest so "set an apt with you" / "just came in" don't get read
  //     as booking interest and pushed the self-serve link).
  const humanOrExit = classifyHumanOrExit(textLower, text);
  if (humanOrExit) {
    return { intent: humanOrExit, confidence: 'high', matchedKeywords: [humanOrExit], rawText: text };
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

  // "Sure whats this about", "Yeah what do you need" — starts with positive + curiosity
  const startsPositive = SHORT_POSITIVE.some(w => textClean.startsWith(w + ' ') || textClean === w);
  if (startsPositive) {
    return { intent: 'booking_interest', confidence: 'medium', matchedKeywords: [textClean.split(' ')[0]], rawText: text };
  }

  // Identity questions — patient asking which office this is
  if (IDENTIFY_PRACTICE_PHRASES.some(p => textLower.includes(p))) {
    return { intent: 'identify_practice', confidence: 'high', matchedKeywords: ['identify_practice'], rawText: text };
  }

  // Pure curiosity phrases — patient is engaged, treat as interest
  if (CURIOSITY_PHRASES.some(p => textLower.replace(/[^\w\s]/g, ' ').trim().includes(p))) {
    return { intent: 'booking_interest', confidence: 'medium', matchedKeywords: ['curiosity'], rawText: text };
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

// =============================================================================
// Critical-intent fast path
// Used by replyHandler before any LLM routing. These four intents MUST stay
// deterministic — opt_out (TCPA), urgent (medical), wrong_number (compliance),
// and slot_selection at S4 (binary numeric routing). If this returns non-null,
// the keyword classifier + state machine + template path runs unchanged.
// =============================================================================

export type CriticalIntent =
  | 'opt_out' | 'urgent' | 'wrong_number' | 'slot_selection'
  | 'needs_human' | 'moved' | 'already_handled';

export function classifyCriticalIntent(
  text: string,
  currentStage: RecallStage
): { intent: CriticalIntent; matched: string[] } | null {
  const t = text.toLowerCase().trim();
  // Single-word TCPA tokens require standalone match. Multi-word phrases match anywhere.
  if (isStandaloneOptOut(text)) {
    return { intent: 'opt_out', matched: [t.replace(/[^\w]/g, '')] };
  }
  if (matchAny(t, OPT_OUT_KEYWORDS)) {
    return { intent: 'opt_out', matched: getMatches(t, OPT_OUT_KEYWORDS) };
  }
  if (matchAny(t, URGENT_KEYWORDS)) {
    return { intent: 'urgent', matched: getMatches(t, URGENT_KEYWORDS) };
  }
  if (matchAny(t, WRONG_NUMBER_KEYWORDS)) {
    return { intent: 'wrong_number', matched: getMatches(t, WRONG_NUMBER_KEYWORDS) };
  }
  // Human-handoff / moved / already-seen — handled deterministically (not by the LLM)
  // because the LLM has proven unreliable on these and a wrong reply here is costly.
  const humanOrExit = classifyHumanOrExit(t, text);
  if (humanOrExit) {
    return { intent: humanOrExit as CriticalIntent, matched: [humanOrExit] };
  }
  if (currentStage === 'S4_AVAILABILITY') {
    const clean = t.replace(/[^\w\s]/g, '');
    const slot = checkSlotSelection(clean);
    if (slot) return { intent: 'slot_selection', matched: slot };
  }
  return null;
}

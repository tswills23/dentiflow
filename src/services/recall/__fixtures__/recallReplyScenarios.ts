// Recall Reply Test Fixtures
// Run via: npx tsx scripts/test-recall-replies.ts
// All examples synthetic. NEVER add real patient messages.

import type { RecallStage, RecallVoice, RecallIntent } from '../../../types/recall';

export interface RecallReplyFixture {
  id: string;
  inboundMessage: string;
  bookingStage: RecallStage;
  monthsOverdue: number;
  voiceTier: RecallVoice;
  expected: {
    /** Required intent. 100% match required for fixture to pass. */
    intent: RecallIntent;
    /** Required next state from getTransition(). */
    nextStage: RecallStage;
    /** All of these substrings/regex must appear (case-insensitive). */
    replyTextMustContain?: (string | RegExp)[];
    /** None of these may appear (case-insensitive). */
    replyTextMustNotMatch?: RegExp[];
    /** Whether this fixture should be handled by the keyword pre-filter (critical intent). */
    expectsKeywordPath?: boolean;
  };
}

export const FIXTURES: RecallReplyFixture[] = [
  // ─── identify_practice (the bug that started this whole project) ───
  {
    id: 'identify_office_q',
    inboundMessage: 'what office is this?',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 13,
    voiceTier: 'doctor',
    expected: {
      intent: 'identify_practice',
      nextStage: 'S0_OPENING',
      replyTextMustContain: [/village dental/i],
      replyTextMustNotMatch: [/looking to come in for a cleaning/i, /\bcleaning\b/i],
    },
  },
  {
    id: 'identify_who_are_you',
    inboundMessage: 'who are you guys?',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 9,
    voiceTier: 'hygienist',
    expected: {
      intent: 'identify_practice',
      nextStage: 'S0_OPENING',
      replyTextMustContain: [/village dental/i],
      replyTextMustNotMatch: [/^thanks for reaching out/i],
    },
  },
  {
    id: 'identify_walmart_location',
    inboundMessage: 'are you near the Walmart?',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 14,
    voiceTier: 'doctor',
    expected: {
      intent: 'identify_practice',
      nextStage: 'S0_OPENING',
      replyTextMustContain: [/village dental/i],
      // Must NOT invent an address
      replyTextMustNotMatch: [/\b\d{2,5}\s+\w+\s+(street|st|avenue|ave|road|rd)\b/i],
    },
  },

  // ─── explain_reason / booking_interest ───
  {
    id: 'remind_me_why',
    inboundMessage: 'can you remind me why I am getting these?',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 13,
    voiceTier: 'doctor',
    expected: {
      intent: 'booking_interest',
      nextStage: 'S1_INTENT',
      replyTextMustNotMatch: [/looking to come in for a cleaning/i],
    },
  },
  {
    id: 'what_for',
    inboundMessage: 'what would I even be coming in for?',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 8,
    voiceTier: 'hygienist',
    expected: {
      intent: 'booking_interest',
      nextStage: 'S1_INTENT',
      replyTextMustNotMatch: [/cavity|infection|x-?ray/i], // no clinical jargon
    },
  },

  // ─── cost_question (templated handoff path even when LLM classifies) ───
  {
    id: 'insurance_cigna',
    inboundMessage: 'do you guys take Cigna?',
    bookingStage: 'S1_INTENT',
    monthsOverdue: 9,
    voiceTier: 'hygienist',
    expected: {
      intent: 'cost_question',
      nextStage: 'S1_INTENT',
      // Must NOT promise insurance acceptance
      replyTextMustNotMatch: [/we (accept|take|are in[- ]network)/i],
    },
  },

  // ─── not_now / decline ───
  {
    id: 'maybe_next_month',
    inboundMessage: 'yes but next month',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 7,
    voiceTier: 'office',
    expected: {
      intent: 'not_now',
      nextStage: 'EXIT_DEFERRED',
    },
  },

  // ─── booked_confirmation ───
  {
    id: 'husband_booked',
    inboundMessage: 'my husband already booked us in',
    bookingStage: 'S1_INTENT',
    monthsOverdue: 9,
    voiceTier: 'hygienist',
    expected: {
      intent: 'booked_confirmation',
      nextStage: 'S6_COMPLETED',
    },
  },

  // ─── critical-path bypasses (these must NEVER touch LLM) ───
  {
    id: 'urgent_killing_me',
    inboundMessage: 'my mouth is killing me',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 14,
    voiceTier: 'doctor',
    expected: {
      intent: 'urgent',
      nextStage: 'S7_HANDOFF',
      expectsKeywordPath: true,
    },
  },
  {
    id: 'opt_out_stop',
    inboundMessage: 'STOP',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 7,
    voiceTier: 'office',
    expected: {
      intent: 'opt_out',
      nextStage: 'EXIT_OPT_OUT',
      expectsKeywordPath: true,
    },
  },
  {
    id: 'wrong_number',
    inboundMessage: 'wrong number',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 9,
    voiceTier: 'hygienist',
    expected: {
      intent: 'decline', // wrong_number maps to decline in classifyIntent
      nextStage: 'EXIT_DECLINED',
      expectsKeywordPath: true,
    },
  },

  // ─── edge cases ───
  {
    id: 'empty_emoji',
    inboundMessage: '👍',
    bookingStage: 'S0_OPENING',
    monthsOverdue: 7,
    voiceTier: 'office',
    expected: {
      // Single positive emoji — current classifier returns booking_interest
      intent: 'booking_interest',
      nextStage: 'S1_INTENT',
    },
  },
];

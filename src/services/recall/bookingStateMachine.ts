// Booking State Machine for Recall Engine
// Ported from execution/booking_agent/state_machine.py
//
// Implements a finite state machine with stages S0-S7:
//   S0: OPENING - Initial contact, first response
//   S1: INTENT - Determining what patient wants
//   S3: TIME_PREF - Collecting time preferences
//   S4: AVAILABILITY - Presenting verified slots
//   S5: CONFIRMATION - Confirming selected slot
//   S6: COMPLETED - Booking done (terminal)
//   S7: HANDOFF - Escalate to human (terminal)
//
// Plus exit states:
//   EXIT_OPT_OUT, EXIT_DEFERRED, EXIT_DECLINED, EXIT_CANCELLED

import type {
  RecallStage,
  RecallIntent,
  PolicyFlag,
  TransitionResult,
} from '../../types/recall';
import { isTerminalStage } from '../../types/recall';

// =============================================================================
// Transition Table
// Maps [currentStage, intent] → nextStage
// =============================================================================

type TransitionKey = `${RecallStage}:${RecallIntent}`;

const TRANSITIONS: Partial<Record<TransitionKey, RecallStage>> = {
  // S0_OPENING transitions
  'S0_OPENING:booking_interest': 'S3_TIME_PREF',
  'S0_OPENING:preferences': 'S4_AVAILABILITY',
  'S0_OPENING:asking_availability': 'S4_AVAILABILITY',
  'S0_OPENING:opt_out': 'EXIT_OPT_OUT',
  'S0_OPENING:not_now': 'EXIT_DEFERRED',
  'S0_OPENING:decline': 'EXIT_DECLINED',
  'S0_OPENING:urgent': 'S7_HANDOFF',
  'S0_OPENING:cost_question': 'S7_HANDOFF',
  'S0_OPENING:unclear': 'S0_OPENING',

  // S1_INTENT transitions
  'S1_INTENT:booking_interest': 'S3_TIME_PREF',
  'S1_INTENT:opt_out': 'EXIT_OPT_OUT',
  'S1_INTENT:urgent': 'S7_HANDOFF',

  // S3_TIME_PREF transitions
  'S3_TIME_PREF:preferences': 'S4_AVAILABILITY',
  'S3_TIME_PREF:asking_availability': 'S4_AVAILABILITY',
  'S3_TIME_PREF:booking_interest': 'S4_AVAILABILITY',
  'S3_TIME_PREF:opt_out': 'EXIT_OPT_OUT',
  'S3_TIME_PREF:not_now': 'EXIT_DEFERRED',
  'S3_TIME_PREF:decline': 'EXIT_DECLINED',
  'S3_TIME_PREF:urgent': 'S7_HANDOFF',
  'S3_TIME_PREF:cost_question': 'S7_HANDOFF',
  'S3_TIME_PREF:unclear': 'S3_TIME_PREF',

  // S4_AVAILABILITY transitions
  'S4_AVAILABILITY:slot_selection': 'S5_CONFIRMATION',
  'S4_AVAILABILITY:confirm': 'S6_COMPLETED',
  'S4_AVAILABILITY:preferences': 'S4_AVAILABILITY',
  'S4_AVAILABILITY:asking_availability': 'S4_AVAILABILITY',
  'S4_AVAILABILITY:opt_out': 'EXIT_OPT_OUT',
  'S4_AVAILABILITY:not_now': 'EXIT_DEFERRED',
  'S4_AVAILABILITY:decline': 'EXIT_DECLINED',
  'S4_AVAILABILITY:unclear': 'S4_AVAILABILITY',

  // S5_CONFIRMATION transitions
  'S5_CONFIRMATION:confirm': 'S6_COMPLETED',
  'S5_CONFIRMATION:preferences': 'S4_AVAILABILITY',
  'S5_CONFIRMATION:decline': 'EXIT_CANCELLED',
  'S5_CONFIRMATION:opt_out': 'EXIT_OPT_OUT',
  'S5_CONFIRMATION:cancel': 'EXIT_CANCELLED',
};

// =============================================================================
// Action Table
// Maps [currentStage, intent] → actionName
// =============================================================================

const ACTIONS: Partial<Record<TransitionKey, string>> = {
  // S0_OPENING actions
  'S0_OPENING:booking_interest': 'ask_preferences',
  'S0_OPENING:preferences': 'show_balanced_slots',
  'S0_OPENING:asking_availability': 'show_default_slots',
  'S0_OPENING:opt_out': 'opt_out_silent',
  'S0_OPENING:not_now': 'defer_60_days',
  'S0_OPENING:decline': 'acknowledge_decline',
  'S0_OPENING:urgent': 'handoff_urgent',
  'S0_OPENING:cost_question': 'handoff_cost',
  'S0_OPENING:unclear': 'clarify_intent',

  // S3_TIME_PREF actions
  'S3_TIME_PREF:preferences': 'show_balanced_slots',
  'S3_TIME_PREF:asking_availability': 'show_default_slots',
  'S3_TIME_PREF:booking_interest': 'show_default_slots',
  'S3_TIME_PREF:opt_out': 'opt_out_silent',
  'S3_TIME_PREF:not_now': 'defer_60_days',
  'S3_TIME_PREF:decline': 'acknowledge_decline',
  'S3_TIME_PREF:urgent': 'handoff_urgent',
  'S3_TIME_PREF:cost_question': 'handoff_cost',
  'S3_TIME_PREF:unclear': 'ask_preferences',

  // S4_AVAILABILITY actions
  'S4_AVAILABILITY:slot_selection': 'confirm_slot',
  'S4_AVAILABILITY:confirm': 'book_first_slot',
  'S4_AVAILABILITY:preferences': 'show_balanced_slots',
  'S4_AVAILABILITY:asking_availability': 'show_default_slots',
  'S4_AVAILABILITY:opt_out': 'opt_out_silent',
  'S4_AVAILABILITY:not_now': 'defer_60_days',
  'S4_AVAILABILITY:decline': 'acknowledge_decline',
  'S4_AVAILABILITY:unclear': 'reshow_slots',

  // S5_CONFIRMATION actions
  'S5_CONFIRMATION:confirm': 'complete_booking',
  'S5_CONFIRMATION:preferences': 'show_balanced_slots',
  'S5_CONFIRMATION:decline': 'cancel_booking',
  'S5_CONFIRMATION:opt_out': 'opt_out_silent',
  'S5_CONFIRMATION:cancel': 'cancel_booking',
};

// =============================================================================
// Policy Override Map
// =============================================================================

const POLICY_OVERRIDES: Record<PolicyFlag, { stage: RecallStage; action: string }> = {
  opt_out: { stage: 'EXIT_OPT_OUT', action: 'opt_out_silent' },
  urgent_medical: { stage: 'S7_HANDOFF', action: 'handoff_urgent' },
  cost_question: { stage: 'S7_HANDOFF', action: 'handoff_cost' },
  wrong_number: { stage: 'S7_HANDOFF', action: 'handoff_wrong_number' },
  needs_human: { stage: 'S7_HANDOFF', action: 'handoff_general' },
};

// =============================================================================
// State Machine
// =============================================================================

export function getTransition(
  currentStage: RecallStage,
  intent: RecallIntent,
  policyFlag?: PolicyFlag | null
): TransitionResult {
  // Handle policy overrides first
  if (policyFlag && policyFlag in POLICY_OVERRIDES) {
    const override = POLICY_OVERRIDES[policyFlag];
    return {
      currentStage,
      nextStage: override.stage,
      action: override.action,
      isTerminal: true,
      policyOverride: true,
      policyFlag,
    };
  }

  // Check if current stage is terminal
  if (isTerminalStage(currentStage)) {
    return {
      currentStage,
      nextStage: currentStage,
      action: 'no_action_terminal',
      isTerminal: true,
      policyOverride: false,
      policyFlag: null,
    };
  }

  // Look up transition
  const key = `${currentStage}:${intent}` as TransitionKey;
  const nextStage = TRANSITIONS[key] ?? currentStage; // Stay if no transition
  const action = ACTIONS[key] ?? 'stay_in_stage';

  return {
    currentStage,
    nextStage,
    action,
    isTerminal: isTerminalStage(nextStage),
    policyOverride: false,
    policyFlag: null,
  };
}

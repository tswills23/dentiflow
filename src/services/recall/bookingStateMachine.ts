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
  // S0_OPENING transitions — any engagement goes to S1_INTENT (explain stage)
  'S0_OPENING:booking_interest': 'S1_INTENT',
  'S0_OPENING:booked_confirmation': 'S6_COMPLETED',
  'S0_OPENING:preferences': 'S1_INTENT',
  'S0_OPENING:asking_availability': 'S1_INTENT',
  'S0_OPENING:confirm': 'S1_INTENT',
  'S0_OPENING:slot_selection': 'S1_INTENT',
  'S0_OPENING:opt_out': 'EXIT_OPT_OUT',
  'S0_OPENING:not_now': 'EXIT_DEFERRED',
  'S0_OPENING:decline': 'EXIT_DECLINED',
  'S0_OPENING:cancel': 'EXIT_DECLINED',
  'S0_OPENING:reschedule': 'S1_INTENT',
  'S0_OPENING:urgent': 'S7_HANDOFF',
  'S0_OPENING:cost_question': 'S7_HANDOFF',
  'S0_OPENING:unclear': 'S0_OPENING',

  // S1_INTENT transitions — patient confirmed interest, send booking link
  'S1_INTENT:booking_interest': 'S3_TIME_PREF',
  'S1_INTENT:booked_confirmation': 'S6_COMPLETED',
  'S1_INTENT:preferences': 'S3_TIME_PREF',
  'S1_INTENT:asking_availability': 'S3_TIME_PREF',
  'S1_INTENT:confirm': 'S3_TIME_PREF',
  'S1_INTENT:slot_selection': 'S3_TIME_PREF',
  'S1_INTENT:opt_out': 'EXIT_OPT_OUT',
  'S1_INTENT:not_now': 'EXIT_DEFERRED',
  'S1_INTENT:decline': 'EXIT_DECLINED',
  'S1_INTENT:cancel': 'EXIT_DECLINED',
  'S1_INTENT:reschedule': 'S3_TIME_PREF',
  'S1_INTENT:urgent': 'S7_HANDOFF',
  'S1_INTENT:cost_question': 'S7_HANDOFF',
  'S1_INTENT:unclear': 'S3_TIME_PREF',

  // S3_TIME_PREF transitions
  'S3_TIME_PREF:preferences': 'S4_AVAILABILITY',
  'S3_TIME_PREF:asking_availability': 'S4_AVAILABILITY',
  'S3_TIME_PREF:booking_interest': 'S4_AVAILABILITY',
  'S3_TIME_PREF:confirm': 'S3_TIME_PREF',
  'S3_TIME_PREF:slot_selection': 'S3_TIME_PREF',
  'S3_TIME_PREF:booked_confirmation': 'S6_COMPLETED',
  'S3_TIME_PREF:opt_out': 'EXIT_OPT_OUT',
  'S3_TIME_PREF:not_now': 'EXIT_DEFERRED',
  'S3_TIME_PREF:decline': 'EXIT_DECLINED',
  'S3_TIME_PREF:cancel': 'EXIT_CANCELLED',
  'S3_TIME_PREF:reschedule': 'S3_TIME_PREF',
  'S3_TIME_PREF:urgent': 'S7_HANDOFF',
  'S3_TIME_PREF:cost_question': 'S7_HANDOFF',
  'S3_TIME_PREF:unclear': 'S3_TIME_PREF',

  // S4_AVAILABILITY transitions (link-only: redirect back to S3_TIME_PREF)
  'S4_AVAILABILITY:slot_selection': 'S3_TIME_PREF',
  'S4_AVAILABILITY:confirm': 'S3_TIME_PREF',
  'S4_AVAILABILITY:booked_confirmation': 'S6_COMPLETED',
  'S4_AVAILABILITY:preferences': 'S3_TIME_PREF',
  'S4_AVAILABILITY:asking_availability': 'S3_TIME_PREF',
  'S4_AVAILABILITY:opt_out': 'EXIT_OPT_OUT',
  'S4_AVAILABILITY:not_now': 'EXIT_DEFERRED',
  'S4_AVAILABILITY:decline': 'EXIT_DECLINED',
  'S4_AVAILABILITY:cancel': 'EXIT_CANCELLED',
  'S4_AVAILABILITY:reschedule': 'S3_TIME_PREF',
  'S4_AVAILABILITY:urgent': 'S7_HANDOFF',
  'S4_AVAILABILITY:cost_question': 'S7_HANDOFF',
  'S4_AVAILABILITY:unclear': 'S3_TIME_PREF',

  // S5_CONFIRMATION transitions (link-only: redirect back to S3_TIME_PREF or complete)
  'S5_CONFIRMATION:confirm': 'S6_COMPLETED',
  'S5_CONFIRMATION:booked_confirmation': 'S6_COMPLETED',
  'S5_CONFIRMATION:preferences': 'S3_TIME_PREF',
  'S5_CONFIRMATION:asking_availability': 'S3_TIME_PREF',
  'S5_CONFIRMATION:slot_selection': 'S5_CONFIRMATION',
  'S5_CONFIRMATION:decline': 'EXIT_CANCELLED',
  'S5_CONFIRMATION:opt_out': 'EXIT_OPT_OUT',
  'S5_CONFIRMATION:cancel': 'EXIT_CANCELLED',
  'S5_CONFIRMATION:not_now': 'EXIT_DEFERRED',
  'S5_CONFIRMATION:reschedule': 'S3_TIME_PREF',
  'S5_CONFIRMATION:urgent': 'S7_HANDOFF',
  'S5_CONFIRMATION:cost_question': 'S7_HANDOFF',
  'S5_CONFIRMATION:unclear': 'S5_CONFIRMATION',
};

// =============================================================================
// Action Table
// Maps [currentStage, intent] → actionName
// =============================================================================

const ACTIONS: Partial<Record<TransitionKey, string>> = {
  // S0_OPENING actions — explain why we're reaching out
  'S0_OPENING:booking_interest': 'explain_reason',
  'S0_OPENING:booked_confirmation': 'confirm_external_booking',
  'S0_OPENING:preferences': 'explain_reason',
  'S0_OPENING:asking_availability': 'explain_reason',
  'S0_OPENING:confirm': 'explain_reason',
  'S0_OPENING:slot_selection': 'explain_reason',
  'S0_OPENING:opt_out': 'opt_out_silent',
  'S0_OPENING:not_now': 'defer_60_days',
  'S0_OPENING:decline': 'acknowledge_decline',
  'S0_OPENING:cancel': 'acknowledge_decline',
  'S0_OPENING:reschedule': 'explain_reason',
  'S0_OPENING:urgent': 'handoff_urgent',
  'S0_OPENING:cost_question': 'handoff_cost',
  'S0_OPENING:unclear': 'clarify_intent',

  // S1_INTENT actions — patient is engaged, send booking link
  'S1_INTENT:booking_interest': 'send_booking_link',
  'S1_INTENT:booked_confirmation': 'confirm_external_booking',
  'S1_INTENT:preferences': 'send_booking_link',
  'S1_INTENT:asking_availability': 'send_booking_link',
  'S1_INTENT:confirm': 'send_booking_link',
  'S1_INTENT:slot_selection': 'send_booking_link',
  'S1_INTENT:opt_out': 'opt_out_silent',
  'S1_INTENT:not_now': 'defer_60_days',
  'S1_INTENT:decline': 'acknowledge_decline',
  'S1_INTENT:cancel': 'acknowledge_decline',
  'S1_INTENT:reschedule': 'send_booking_link',
  'S1_INTENT:urgent': 'handoff_urgent',
  'S1_INTENT:cost_question': 'handoff_cost',
  'S1_INTENT:unclear': 'send_booking_link',

  // S3_TIME_PREF actions
  'S3_TIME_PREF:preferences': 'send_booking_link',
  'S3_TIME_PREF:asking_availability': 'send_booking_link',
  'S3_TIME_PREF:booking_interest': 'send_booking_link',
  'S3_TIME_PREF:confirm': 'send_booking_link',
  'S3_TIME_PREF:slot_selection': 'send_booking_link',
  'S3_TIME_PREF:booked_confirmation': 'confirm_external_booking',
  'S3_TIME_PREF:opt_out': 'opt_out_silent',
  'S3_TIME_PREF:not_now': 'defer_60_days',
  'S3_TIME_PREF:decline': 'acknowledge_decline',
  'S3_TIME_PREF:cancel': 'cancel_booking',
  'S3_TIME_PREF:reschedule': 'send_booking_link',
  'S3_TIME_PREF:urgent': 'handoff_urgent',
  'S3_TIME_PREF:cost_question': 'handoff_cost',
  'S3_TIME_PREF:unclear': 'send_booking_link',

  // S4_AVAILABILITY actions (link-only: always send booking link)
  'S4_AVAILABILITY:slot_selection': 'send_booking_link',
  'S4_AVAILABILITY:confirm': 'send_booking_link',
  'S4_AVAILABILITY:booked_confirmation': 'confirm_external_booking',
  'S4_AVAILABILITY:preferences': 'send_booking_link',
  'S4_AVAILABILITY:asking_availability': 'send_booking_link',
  'S4_AVAILABILITY:opt_out': 'opt_out_silent',
  'S4_AVAILABILITY:not_now': 'defer_60_days',
  'S4_AVAILABILITY:decline': 'acknowledge_decline',
  'S4_AVAILABILITY:cancel': 'cancel_booking',
  'S4_AVAILABILITY:reschedule': 'send_booking_link',
  'S4_AVAILABILITY:urgent': 'handoff_urgent',
  'S4_AVAILABILITY:cost_question': 'handoff_cost',
  'S4_AVAILABILITY:unclear': 'send_booking_link',

  // S5_CONFIRMATION actions (link-only)
  'S5_CONFIRMATION:confirm': 'confirm_external_booking',
  'S5_CONFIRMATION:booked_confirmation': 'confirm_external_booking',
  'S5_CONFIRMATION:preferences': 'send_booking_link',
  'S5_CONFIRMATION:asking_availability': 'send_booking_link',
  'S5_CONFIRMATION:slot_selection': 'clarify_intent',
  'S5_CONFIRMATION:decline': 'cancel_booking',
  'S5_CONFIRMATION:opt_out': 'opt_out_silent',
  'S5_CONFIRMATION:cancel': 'cancel_booking',
  'S5_CONFIRMATION:not_now': 'defer_60_days',
  'S5_CONFIRMATION:reschedule': 'send_booking_link',
  'S5_CONFIRMATION:urgent': 'handoff_urgent',
  'S5_CONFIRMATION:cost_question': 'handoff_cost',
  'S5_CONFIRMATION:unclear': 'clarify_intent',
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

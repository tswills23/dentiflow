"""
State Machine for Dentiflow Booking Agent V4.

Implements a finite state machine with stages S0-S7:
    S0: OPENING - Initial contact, first response
    S1: INTENT - Determining what patient wants
    S2: APPOINTMENT_TYPE - Identifying appointment type
    S3: TIME_PREF - Collecting time preferences
    S4: AVAILABILITY - Presenting verified slots
    S5: CONFIRMATION - Confirming selected slot
    S6: COMPLETED - Booking done (terminal)
    S7: HANDOFF - Escalate to human (terminal)

Plus exit states:
    EXIT_OPT_OUT - Patient unsubscribed
    EXIT_DEFERRED - Patient said "not now"
    EXIT_DECLINED - Patient declined
    EXIT_CANCELLED - Patient cancelled
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from .schemas import Stage, Intent, PolicyFlag


# =============================================================================
# Transition Table
# =============================================================================

# Maps (current_stage, intent) -> next_stage
# If a transition isn't defined, the default is to stay in current stage
TRANSITIONS: Dict[Tuple[Stage, Intent], Stage] = {
    # S0_OPENING transitions
    (Stage.S0_OPENING, Intent.BOOKING_INTEREST): Stage.S3_TIME_PREF,
    (Stage.S0_OPENING, Intent.PREFERENCES): Stage.S4_AVAILABILITY,
    (Stage.S0_OPENING, Intent.ASKING_AVAILABILITY): Stage.S4_AVAILABILITY,
    (Stage.S0_OPENING, Intent.OPT_OUT): Stage.EXIT_OPT_OUT,
    (Stage.S0_OPENING, Intent.NOT_NOW): Stage.EXIT_DEFERRED,
    (Stage.S0_OPENING, Intent.DECLINE): Stage.EXIT_DECLINED,
    (Stage.S0_OPENING, Intent.URGENT): Stage.S7_HANDOFF,
    (Stage.S0_OPENING, Intent.COST_QUESTION): Stage.S7_HANDOFF,
    (Stage.S0_OPENING, Intent.UNCLEAR): Stage.S0_OPENING,  # Re-prompt

    # S1_INTENT transitions (currently not used - skip to S3)
    (Stage.S1_INTENT, Intent.BOOKING_INTEREST): Stage.S3_TIME_PREF,
    (Stage.S1_INTENT, Intent.OPT_OUT): Stage.EXIT_OPT_OUT,
    (Stage.S1_INTENT, Intent.URGENT): Stage.S7_HANDOFF,

    # S3_TIME_PREF transitions
    (Stage.S3_TIME_PREF, Intent.PREFERENCES): Stage.S4_AVAILABILITY,
    (Stage.S3_TIME_PREF, Intent.ASKING_AVAILABILITY): Stage.S4_AVAILABILITY,
    (Stage.S3_TIME_PREF, Intent.BOOKING_INTEREST): Stage.S4_AVAILABILITY,  # Show default slots
    (Stage.S3_TIME_PREF, Intent.OPT_OUT): Stage.EXIT_OPT_OUT,
    (Stage.S3_TIME_PREF, Intent.NOT_NOW): Stage.EXIT_DEFERRED,
    (Stage.S3_TIME_PREF, Intent.DECLINE): Stage.EXIT_DECLINED,
    (Stage.S3_TIME_PREF, Intent.URGENT): Stage.S7_HANDOFF,
    (Stage.S3_TIME_PREF, Intent.COST_QUESTION): Stage.S7_HANDOFF,
    (Stage.S3_TIME_PREF, Intent.UNCLEAR): Stage.S3_TIME_PREF,  # Re-prompt

    # S4_AVAILABILITY transitions
    (Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION): Stage.S5_CONFIRMATION,
    (Stage.S4_AVAILABILITY, Intent.CONFIRM): Stage.S6_COMPLETED,  # Direct booking if single slot
    (Stage.S4_AVAILABILITY, Intent.PREFERENCES): Stage.S4_AVAILABILITY,  # Show new slots
    (Stage.S4_AVAILABILITY, Intent.ASKING_AVAILABILITY): Stage.S4_AVAILABILITY,
    (Stage.S4_AVAILABILITY, Intent.OPT_OUT): Stage.EXIT_OPT_OUT,
    (Stage.S4_AVAILABILITY, Intent.NOT_NOW): Stage.EXIT_DEFERRED,
    (Stage.S4_AVAILABILITY, Intent.DECLINE): Stage.EXIT_DECLINED,
    (Stage.S4_AVAILABILITY, Intent.UNCLEAR): Stage.S4_AVAILABILITY,  # Re-show slots

    # S5_CONFIRMATION transitions
    (Stage.S5_CONFIRMATION, Intent.CONFIRM): Stage.S6_COMPLETED,
    (Stage.S5_CONFIRMATION, Intent.PREFERENCES): Stage.S4_AVAILABILITY,  # Changed mind
    (Stage.S5_CONFIRMATION, Intent.DECLINE): Stage.EXIT_CANCELLED,
    (Stage.S5_CONFIRMATION, Intent.OPT_OUT): Stage.EXIT_OPT_OUT,
    (Stage.S5_CONFIRMATION, Intent.CANCEL): Stage.EXIT_CANCELLED,

    # S6_COMPLETED - terminal, no transitions out

    # S7_HANDOFF - terminal, no transitions out
}

# Actions associated with stage transitions
# Maps (current_stage, intent) -> action_name
ACTIONS: Dict[Tuple[Stage, Intent], str] = {
    # S0_OPENING actions
    (Stage.S0_OPENING, Intent.BOOKING_INTEREST): "ask_preferences",
    (Stage.S0_OPENING, Intent.PREFERENCES): "show_balanced_slots",
    (Stage.S0_OPENING, Intent.ASKING_AVAILABILITY): "show_default_slots",
    (Stage.S0_OPENING, Intent.OPT_OUT): "opt_out_silent",
    (Stage.S0_OPENING, Intent.NOT_NOW): "defer_60_days",
    (Stage.S0_OPENING, Intent.DECLINE): "acknowledge_decline",
    (Stage.S0_OPENING, Intent.URGENT): "handoff_urgent",
    (Stage.S0_OPENING, Intent.COST_QUESTION): "handoff_cost",
    (Stage.S0_OPENING, Intent.UNCLEAR): "clarify_intent",

    # S3_TIME_PREF actions
    (Stage.S3_TIME_PREF, Intent.PREFERENCES): "show_balanced_slots",
    (Stage.S3_TIME_PREF, Intent.ASKING_AVAILABILITY): "show_default_slots",
    (Stage.S3_TIME_PREF, Intent.BOOKING_INTEREST): "show_default_slots",
    (Stage.S3_TIME_PREF, Intent.OPT_OUT): "opt_out_silent",
    (Stage.S3_TIME_PREF, Intent.NOT_NOW): "defer_60_days",
    (Stage.S3_TIME_PREF, Intent.DECLINE): "acknowledge_decline",
    (Stage.S3_TIME_PREF, Intent.URGENT): "handoff_urgent",
    (Stage.S3_TIME_PREF, Intent.COST_QUESTION): "handoff_cost",
    (Stage.S3_TIME_PREF, Intent.UNCLEAR): "ask_preferences",

    # S4_AVAILABILITY actions
    (Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION): "confirm_slot",
    (Stage.S4_AVAILABILITY, Intent.CONFIRM): "book_first_slot",
    (Stage.S4_AVAILABILITY, Intent.PREFERENCES): "show_balanced_slots",
    (Stage.S4_AVAILABILITY, Intent.ASKING_AVAILABILITY): "show_default_slots",
    (Stage.S4_AVAILABILITY, Intent.OPT_OUT): "opt_out_silent",
    (Stage.S4_AVAILABILITY, Intent.NOT_NOW): "defer_60_days",
    (Stage.S4_AVAILABILITY, Intent.DECLINE): "acknowledge_decline",
    (Stage.S4_AVAILABILITY, Intent.UNCLEAR): "reshow_slots",

    # S5_CONFIRMATION actions
    (Stage.S5_CONFIRMATION, Intent.CONFIRM): "complete_booking",
    (Stage.S5_CONFIRMATION, Intent.PREFERENCES): "show_balanced_slots",
    (Stage.S5_CONFIRMATION, Intent.DECLINE): "cancel_booking",
    (Stage.S5_CONFIRMATION, Intent.OPT_OUT): "opt_out_silent",
    (Stage.S5_CONFIRMATION, Intent.CANCEL): "cancel_booking",
}


# =============================================================================
# State Machine Class
# =============================================================================

@dataclass
class TransitionResult:
    """Result of a state transition."""
    current_stage: Stage
    next_stage: Stage
    action: str
    is_terminal: bool
    policy_override: bool = False
    policy_flag: Optional[PolicyFlag] = None


class StateMachine:
    """
    Finite state machine for booking flow.

    Handles stage transitions based on classified intent,
    with policy overrides for urgent/opt-out cases.
    """

    def __init__(self):
        self.transitions = TRANSITIONS
        self.actions = ACTIONS

    def get_transition(
        self,
        current_stage: Stage,
        intent: Intent,
        policy_flag: Optional[PolicyFlag] = None,
    ) -> TransitionResult:
        """
        Get the next stage and action for given state + intent.

        Policy flags can override normal transitions:
        - OPT_OUT always goes to EXIT_OPT_OUT
        - URGENT always goes to S7_HANDOFF
        - COST_QUESTION always goes to S7_HANDOFF

        Args:
            current_stage: Current stage
            intent: Classified intent
            policy_flag: Optional policy flag override

        Returns:
            TransitionResult with next stage and action
        """
        # Handle policy overrides first
        if policy_flag:
            return self._handle_policy_override(current_stage, policy_flag)

        # Check if current stage is terminal
        if Stage.is_terminal(current_stage):
            return TransitionResult(
                current_stage=current_stage,
                next_stage=current_stage,
                action="no_action_terminal",
                is_terminal=True,
            )

        # Look up transition
        key = (current_stage, intent)
        if key in self.transitions:
            next_stage = self.transitions[key]
            action = self.actions.get(key, "default_action")
        else:
            # No transition defined - stay in current stage
            next_stage = current_stage
            action = "stay_in_stage"

        return TransitionResult(
            current_stage=current_stage,
            next_stage=next_stage,
            action=action,
            is_terminal=Stage.is_terminal(next_stage),
        )

    def _handle_policy_override(
        self,
        current_stage: Stage,
        policy_flag: PolicyFlag,
    ) -> TransitionResult:
        """Handle policy flag overrides."""
        policy_transitions = {
            PolicyFlag.OPT_OUT: (Stage.EXIT_OPT_OUT, "opt_out_silent"),
            PolicyFlag.URGENT_MEDICAL: (Stage.S7_HANDOFF, "handoff_urgent"),
            PolicyFlag.COST_QUESTION: (Stage.S7_HANDOFF, "handoff_cost"),
            PolicyFlag.WRONG_NUMBER: (Stage.S7_HANDOFF, "handoff_wrong_number"),
            PolicyFlag.NEEDS_HUMAN: (Stage.S7_HANDOFF, "handoff_general"),
        }

        if policy_flag in policy_transitions:
            next_stage, action = policy_transitions[policy_flag]
            return TransitionResult(
                current_stage=current_stage,
                next_stage=next_stage,
                action=action,
                is_terminal=True,
                policy_override=True,
                policy_flag=policy_flag,
            )

        # Unknown policy flag - stay in stage
        return TransitionResult(
            current_stage=current_stage,
            next_stage=current_stage,
            action="unknown_policy",
            is_terminal=False,
            policy_override=True,
            policy_flag=policy_flag,
        )

    def get_valid_intents(self, stage: Stage) -> List[Intent]:
        """Get list of intents that have defined transitions from a stage."""
        return [
            intent for (s, intent) in self.transitions.keys()
            if s == stage
        ]

    def is_terminal(self, stage: Stage) -> bool:
        """Check if a stage is terminal."""
        return Stage.is_terminal(stage)


# =============================================================================
# Legacy Stage Mapping
# =============================================================================

# Map old v3 state names to new stages
LEGACY_STATE_MAP = {
    '': Stage.S0_OPENING,
    'new': Stage.S0_OPENING,
    'outreach_sent': Stage.S0_OPENING,
    'awaiting_preference': Stage.S3_TIME_PREF,
    'offered_times': Stage.S4_AVAILABILITY,
    'awaiting_clarification': Stage.S4_AVAILABILITY,
    'booked': Stage.S6_COMPLETED,
    'declined': Stage.EXIT_DECLINED,
    'deferred': Stage.EXIT_DEFERRED,
}


def map_legacy_state(legacy_state: str) -> Stage:
    """Map v3 state names to v4 stages."""
    return LEGACY_STATE_MAP.get(legacy_state, Stage.S0_OPENING)


def map_stage_to_legacy(stage: Stage) -> str:
    """Map v4 stages back to v3 state names (for sheet compatibility)."""
    stage_to_legacy = {
        Stage.S0_OPENING: 'new',
        Stage.S1_INTENT: 'awaiting_preference',
        Stage.S2_APPOINTMENT_TYPE: 'awaiting_preference',
        Stage.S3_TIME_PREF: 'awaiting_preference',
        Stage.S4_AVAILABILITY: 'offered_times',
        Stage.S5_CONFIRMATION: 'offered_times',
        Stage.S6_COMPLETED: 'booked',
        Stage.S7_HANDOFF: 'handoff',
        Stage.EXIT_OPT_OUT: 'declined',
        Stage.EXIT_DEFERRED: 'deferred',
        Stage.EXIT_DECLINED: 'declined',
        Stage.EXIT_CANCELLED: 'declined',
    }
    return stage_to_legacy.get(stage, 'new')


# =============================================================================
# Module-level instance
# =============================================================================

state_machine = StateMachine()


def get_transition(
    current_stage: Stage,
    intent: Intent,
    policy_flag: Optional[PolicyFlag] = None,
) -> TransitionResult:
    """Convenience function for state transitions."""
    return state_machine.get_transition(current_stage, intent, policy_flag)


# =============================================================================
# Testing
# =============================================================================

if __name__ == "__main__":
    print("Testing state machine transitions...\n")

    sm = StateMachine()

    # Test cases
    test_cases = [
        (Stage.S0_OPENING, Intent.BOOKING_INTEREST, None, Stage.S3_TIME_PREF),
        (Stage.S0_OPENING, Intent.PREFERENCES, None, Stage.S4_AVAILABILITY),
        (Stage.S3_TIME_PREF, Intent.PREFERENCES, None, Stage.S4_AVAILABILITY),
        (Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION, None, Stage.S5_CONFIRMATION),
        (Stage.S5_CONFIRMATION, Intent.CONFIRM, None, Stage.S6_COMPLETED),
        # Policy overrides
        (Stage.S4_AVAILABILITY, Intent.BOOKING_INTEREST, PolicyFlag.OPT_OUT, Stage.EXIT_OPT_OUT),
        (Stage.S0_OPENING, Intent.PREFERENCES, PolicyFlag.URGENT_MEDICAL, Stage.S7_HANDOFF),
    ]

    for current, intent, policy, expected_next in test_cases:
        result = sm.get_transition(current, intent, policy)
        status = "PASS" if result.next_stage == expected_next else "FAIL"
        print(f"{status}: {current.value} + {intent.value}")
        print(f"       Expected: {expected_next.value}, Got: {result.next_stage.value}")
        print(f"       Action: {result.action}")
        if result.policy_override:
            print(f"       Policy Override: {result.policy_flag}")
        print()

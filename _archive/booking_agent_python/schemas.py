"""
Pydantic schemas for the Dentiflow Booking Agent V4.

All inputs and outputs are validated through these schemas to ensure
structured, predictable behavior and enable comprehensive logging.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class Stage(str, Enum):
    """
    Booking flow stages (S0-S7).

    S0-S6: Normal flow from opening to completed
    S7: Handoff to human staff
    EXIT_*: Terminal states
    """
    S0_OPENING = "S0_OPENING"
    S1_INTENT = "S1_INTENT"
    S2_APPOINTMENT_TYPE = "S2_APPOINTMENT_TYPE"
    S3_TIME_PREF = "S3_TIME_PREF"
    S4_AVAILABILITY = "S4_AVAILABILITY"
    S5_CONFIRMATION = "S5_CONFIRMATION"
    S6_COMPLETED = "S6_COMPLETED"
    S7_HANDOFF = "S7_HANDOFF"

    # Terminal exit states
    EXIT_OPT_OUT = "EXIT_OPT_OUT"
    EXIT_DEFERRED = "EXIT_DEFERRED"
    EXIT_DECLINED = "EXIT_DECLINED"
    EXIT_CANCELLED = "EXIT_CANCELLED"

    @classmethod
    def is_terminal(cls, stage: "Stage") -> bool:
        """Check if a stage is terminal (no further transitions)."""
        return stage in [
            cls.S6_COMPLETED,
            cls.S7_HANDOFF,
            cls.EXIT_OPT_OUT,
            cls.EXIT_DEFERRED,
            cls.EXIT_DECLINED,
            cls.EXIT_CANCELLED,
        ]


class Intent(str, Enum):
    """
    Classified intents from patient messages.

    Priority order (highest to lowest):
    1. opt_out - Permanent unsubscribe
    2. urgent - Pain/emergency
    3. not_now - Deferral
    4. decline - Soft no
    5. slot_selection - Picked a number
    6. confirm - Positive affirmation
    7. asking_availability - Wants to see times
    8. preferences - Provided day/time constraints
    9. booking_interest - General yes
    10. cost_question - Price/insurance
    11. reschedule - Change existing
    12. cancel - Cancel existing
    13. unclear - Fallback
    """
    OPT_OUT = "opt_out"
    URGENT = "urgent"
    NOT_NOW = "not_now"
    DECLINE = "decline"
    SLOT_SELECTION = "slot_selection"
    CONFIRM = "confirm"
    ASKING_AVAILABILITY = "asking_availability"
    PREFERENCES = "preferences"
    BOOKING_INTEREST = "booking_interest"
    COST_QUESTION = "cost_question"
    RESCHEDULE = "reschedule"
    CANCEL = "cancel"
    UNCLEAR = "unclear"


class TimeOfDay(str, Enum):
    """Time of day preference."""
    MORNING = "morning"      # 8am - 12pm
    AFTERNOON = "afternoon"  # 12pm - 5pm
    EVENING = "evening"      # 5pm - 8pm
    ANY = "any"


class DayOfWeek(str, Enum):
    """Days of the week."""
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"
    SUNDAY = "Sunday"


class AppointmentType(str, Enum):
    """Types of dental appointments."""
    CLEANING = "cleaning"
    EXAM = "exam"
    CHECKUP = "checkup"
    EMERGENCY = "emergency"
    CONSULTATION = "consultation"
    OTHER = "other"


class PolicyFlag(str, Enum):
    """Policy flags that can be triggered."""
    OPT_OUT = "opt_out"
    URGENT_MEDICAL = "urgent_medical"
    COST_QUESTION = "cost_question"
    WRONG_NUMBER = "wrong_number"
    NEEDS_HUMAN = "needs_human"


# =============================================================================
# Input Schemas
# =============================================================================

class PatientMessage(BaseModel):
    """Incoming patient message (email)."""
    message_id: str = Field(..., description="Gmail message ID")
    from_email: str = Field(..., description="Patient's email address")
    from_name: Optional[str] = Field(None, description="Patient's display name")
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Full email body")
    reply_text: str = Field(..., description="Extracted reply portion (without quoted text)")
    received_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "abc123",
                "from_email": "patient@example.com",
                "from_name": "John Smith",
                "subject": "Re: Your cleaning appointment",
                "body": "Tuesday works!\n\nOn Jan 19...",
                "reply_text": "Tuesday works!",
                "received_at": "2026-01-19T10:30:00"
            }
        }


class TimePreferences(BaseModel):
    """Parsed time preferences from patient message."""
    days: List[DayOfWeek] = Field(default_factory=list, description="Preferred days")
    time_of_day: TimeOfDay = Field(default=TimeOfDay.ANY, description="Morning/afternoon/evening")
    specific_times: List[str] = Field(default_factory=list, description="Specific times mentioned (e.g., '9am')")
    excluded_days: List[DayOfWeek] = Field(default_factory=list, description="Days to avoid")
    raw_text: str = Field(default="", description="Original preference text")

    class Config:
        json_schema_extra = {
            "example": {
                "days": ["Tuesday", "Thursday"],
                "time_of_day": "afternoon",
                "specific_times": [],
                "excluded_days": [],
                "raw_text": "Tuesday and Thursday afternoons"
            }
        }


class AvailableSlot(BaseModel):
    """A verified available appointment slot."""
    slot_id: str = Field(..., description="Unique slot identifier")
    datetime_iso: str = Field(..., description="ISO format datetime")
    day_name: str = Field(..., description="Day of week (e.g., 'Tuesday')")
    date_display: str = Field(..., description="Date display (e.g., 'January 21')")
    time_display: str = Field(..., description="Time display (e.g., '2:00 PM')")
    full_display: str = Field(..., description="Full display (e.g., 'Tuesday, January 21 at 2:00 PM')")
    time_of_day: TimeOfDay = Field(..., description="Morning/afternoon/evening")

    class Config:
        json_schema_extra = {
            "example": {
                "slot_id": "slot_20260121_1400",
                "datetime_iso": "2026-01-21T14:00:00",
                "day_name": "Tuesday",
                "date_display": "January 21",
                "time_display": "2:00 PM",
                "full_display": "Tuesday, January 21 at 2:00 PM",
                "time_of_day": "afternoon"
            }
        }


class PatientContext(BaseModel):
    """Patient context from Google Sheets."""
    row_number: int = Field(..., description="Row number in sheet (for updates)")
    tab_name: str = Field(..., description="Sheet tab name")
    patient_name: str = Field(..., description="Patient's full name")
    first_name: str = Field(..., description="Patient's first name (for personalization)")
    email: str = Field(..., description="Patient's email")
    phone: Optional[str] = Field(None, description="Patient's phone")
    current_stage: Stage = Field(default=Stage.S0_OPENING)
    last_contacted: Optional[datetime] = Field(None)
    contact_count: int = Field(default=0)
    preferences: Optional[TimePreferences] = Field(None)
    offered_slots: List[AvailableSlot] = Field(default_factory=list)
    selected_slot: Optional[AvailableSlot] = Field(None)
    appointment_id: Optional[str] = Field(None)
    appointment_datetime: Optional[str] = Field(None)
    opt_out: bool = Field(default=False)
    defer_until: Optional[datetime] = Field(None)
    notes: str = Field(default="")


# =============================================================================
# Output Schemas
# =============================================================================

class IntentClassification(BaseModel):
    """Result of intent classification."""
    intent: Intent = Field(..., description="Classified intent")
    confidence: Literal["high", "medium", "low"] = Field(..., description="Confidence level")
    matched_keywords: List[str] = Field(default_factory=list, description="Keywords that matched")
    raw_text: str = Field(..., description="Original message text")

    class Config:
        json_schema_extra = {
            "example": {
                "intent": "preferences",
                "confidence": "high",
                "matched_keywords": ["tuesday", "thursday", "afternoon"],
                "raw_text": "Tuesday and Thursday afternoons work best"
            }
        }


class PolicyCheck(BaseModel):
    """Result of policy enforcement check."""
    triggered: bool = Field(default=False, description="Whether a policy was triggered")
    flag: Optional[PolicyFlag] = Field(None, description="Which policy flag")
    forced_stage: Optional[Stage] = Field(None, description="Stage to force transition to")
    reason: Optional[str] = Field(None, description="Human-readable reason")

    class Config:
        json_schema_extra = {
            "example": {
                "triggered": True,
                "flag": "urgent_medical",
                "forced_stage": "S7_HANDOFF",
                "reason": "Patient mentioned 'severe pain' - escalating to human"
            }
        }


class AgentDecision(BaseModel):
    """Agent's decision for current turn."""
    current_stage: Stage = Field(..., description="Stage at start of turn")
    next_stage: Stage = Field(..., description="Stage after this turn")
    intent_detected: IntentClassification = Field(..., description="Intent classification result")
    policy_check: PolicyCheck = Field(default_factory=PolicyCheck)
    action: str = Field(..., description="Action taken (e.g., 'show_balanced_slots')")
    action_details: Dict[str, Any] = Field(default_factory=dict, description="Additional action details")


class SheetUpdates(BaseModel):
    """Updates to write to Google Sheets."""
    conversation_state: Optional[str] = Field(None, alias="Conversation State")
    patient_preferences: Optional[str] = Field(None, alias="Patient Preferences")
    appointment_datetime: Optional[str] = Field(None, alias="Appointment DateTime")
    appointment_id: Optional[str] = Field(None, alias="Appointment ID")
    last_contacted: Optional[str] = Field(None, alias="Last Contacted")
    contact_count: Optional[int] = Field(None, alias="Contact Count")
    sequence_status: Optional[str] = Field(None, alias="sequence_status")
    exit_reason: Optional[str] = Field(None, alias="exit_reason")
    defer_until: Optional[str] = Field(None, alias="defer_until")
    opt_out: Optional[str] = Field(None, alias="opt_out")

    class Config:
        populate_by_name = True


class AgentResponse(BaseModel):
    """Complete agent response for a turn."""
    decision: AgentDecision = Field(..., description="Agent's decision")
    reply_text: str = Field(..., description="Text to send to patient")
    reply_subject: str = Field(default="Re: Your appointment", description="Email subject")
    slots_offered: List[AvailableSlot] = Field(default_factory=list, description="Slots shown to patient")
    booking_confirmed: bool = Field(default=False, description="Whether booking was confirmed")
    appointment_id: Optional[str] = Field(None, description="Appointment ID if booked")
    sheet_updates: Dict[str, Any] = Field(default_factory=dict, description="Updates for Google Sheets")
    send_email: bool = Field(default=True, description="Whether to send reply email")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Processing metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "decision": {
                    "current_stage": "S3_TIME_PREF",
                    "next_stage": "S4_AVAILABILITY",
                    "intent_detected": {
                        "intent": "preferences",
                        "confidence": "high",
                        "matched_keywords": ["tuesday", "thursday"],
                        "raw_text": "Tuesday and Thursday"
                    },
                    "policy_check": {"triggered": False},
                    "action": "show_balanced_slots"
                },
                "reply_text": "Nice! Here's what I've got...",
                "reply_subject": "Re: Your cleaning appointment",
                "slots_offered": [],
                "booking_confirmed": False,
                "sheet_updates": {
                    "Conversation State": "offered_times",
                    "Patient Preferences": "Tuesday and Thursday"
                },
                "send_email": True,
                "metadata": {"processing_time_ms": 42}
            }
        }


# =============================================================================
# Eval Schemas
# =============================================================================

class EvalScenario(BaseModel):
    """Single eval scenario for testing."""
    id: str = Field(..., description="Unique scenario ID")
    name: str = Field(..., description="Human-readable name")
    description: str = Field(..., description="What this tests")
    initial_stage: Stage = Field(..., description="Stage at start")
    patient_message: str = Field(..., description="Patient's message text")
    patient_context: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    expected_intent: Intent = Field(..., description="Expected classified intent")
    expected_next_stage: Stage = Field(..., description="Expected stage after processing")
    expected_action: str = Field(..., description="Expected action taken")
    expected_policy_flag: Optional[PolicyFlag] = Field(None, description="Expected policy flag if any")
    tags: List[str] = Field(default_factory=list, description="Tags for filtering")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "002",
                "name": "tuesday_thursday_preference",
                "description": "Patient provides multi-day preference",
                "initial_stage": "S3_TIME_PREF",
                "patient_message": "Tuesday and Thursday afternoons work best",
                "expected_intent": "preferences",
                "expected_next_stage": "S4_AVAILABILITY",
                "expected_action": "show_balanced_slots",
                "tags": ["preferences", "multi_day", "regression"]
            }
        }

// DentiFlow Recall Engine — Shared Types
// Ported from Python schemas.py, assign_voice.py, recall_templates.py

// =============================================================================
// Recall Sequence Types
// =============================================================================

export type RecallStage =
  | 'S0_OPENING'
  | 'S1_INTENT'
  | 'S2_APPOINTMENT_TYPE'
  | 'S3_TIME_PREF'
  | 'S4_AVAILABILITY'
  | 'S5_CONFIRMATION'
  | 'S6_COMPLETED'
  | 'S7_HANDOFF'
  | 'EXIT_OPT_OUT'
  | 'EXIT_DEFERRED'
  | 'EXIT_DECLINED'
  | 'EXIT_CANCELLED';

export const TERMINAL_STAGES: RecallStage[] = [
  'S6_COMPLETED',
  'S7_HANDOFF',
  'EXIT_OPT_OUT',
  'EXIT_DEFERRED',
  'EXIT_DECLINED',
  'EXIT_CANCELLED',
];

export function isTerminalStage(stage: RecallStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

// =============================================================================
// Intent Types
// =============================================================================

export type RecallIntent =
  | 'opt_out'
  | 'urgent'
  | 'not_now'
  | 'decline'
  | 'slot_selection'
  | 'confirm'
  | 'asking_availability'
  | 'preferences'
  | 'booking_interest'
  | 'booked_confirmation'
  | 'cost_question'
  | 'reschedule'
  | 'cancel'
  | 'unclear';

export type IntentConfidence = 'high' | 'medium' | 'low';

export interface IntentClassification {
  intent: RecallIntent;
  confidence: IntentConfidence;
  matchedKeywords: string[];
  rawText: string;
}

// =============================================================================
// Voice & Segment Types
// =============================================================================

export type RecallVoice = 'office' | 'hygienist' | 'doctor';
export type OverdueSegment = 'lt_6' | 'gte_6_lt_12' | 'gte_12';

export type SequenceStatus = 'active' | 'paused' | 'completed' | 'exited';
export type SequenceDay = 0 | 1 | 3;

// =============================================================================
// Time Preferences
// =============================================================================

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface TimePreferences {
  days: DayOfWeek[];
  timeOfDay: TimeOfDay;
  excludedDays: DayOfWeek[];
  rawText: string;
}

// =============================================================================
// Slot Types
// =============================================================================

export interface AvailableSlot {
  slotId: string;
  datetimeIso: string;
  dayName: string;
  dateDisplay: string;
  timeDisplay: string;
  fullDisplay: string;
  timeOfDay: TimeOfDay;
}

// =============================================================================
// State Machine Types
// =============================================================================

export type PolicyFlag =
  | 'opt_out'
  | 'urgent_medical'
  | 'cost_question'
  | 'wrong_number'
  | 'needs_human';

export interface TransitionResult {
  currentStage: RecallStage;
  nextStage: RecallStage;
  action: string;
  isTerminal: boolean;
  policyOverride: boolean;
  policyFlag: PolicyFlag | null;
}

// =============================================================================
// Recall Sequence (DB row)
// =============================================================================

export interface RecallSequence {
  id: string;
  practice_id: string;
  patient_id: string;
  assigned_voice: RecallVoice;
  segment_overdue: OverdueSegment;
  months_overdue: number;
  sequence_day: SequenceDay;
  sequence_status: SequenceStatus;
  booking_stage: RecallStage;
  next_send_at: string | null;
  last_sent_at: string | null;
  template_id: string | null;
  offered_slots: AvailableSlot[] | null;
  selected_slot: AvailableSlot | null;
  patient_preferences: TimePreferences | null;
  opt_out: boolean;
  defer_until: string | null;
  exit_reason: string | null;
  reply_count: number;
  booking_link_token: string | null;
  link_clicked_at: string | null;
  link_followup_sent: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Pipeline Types
// =============================================================================

export interface IngestResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface OutreachResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ReplyHandlerResult {
  sequenceId: string;
  patientId: string;
  intent: RecallIntent;
  previousStage: RecallStage;
  nextStage: RecallStage;
  action: string;
  replyText: string;
  smsSent: boolean;
  error?: string;
}

// =============================================================================
// Template Types
// =============================================================================

export interface RecallTemplate {
  subject: string;
  body: string;
}

export type TemplateVariant = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

export type TemplateBank = Record<
  RecallVoice,
  Record<SequenceDay, Record<TemplateVariant, RecallTemplate>>
>;

// =============================================================================
// No-Show Recovery Types
// =============================================================================

export type NoshowSequenceStatus =
  | 'message_1_pending'
  | 'message_1_sent'
  | 'message_2_sent'
  | 'replied'
  | 'rebooked'
  | 'deferred'
  | 'declined'
  | 'opted_out'
  | 'no_response';

export interface NoshowSequence {
  id: string;
  practice_id: string;
  patient_id: string;
  appointment_id: string | null;
  status: NoshowSequenceStatus;
  message_count: number;
  booking_stage: RecallStage;
  reply_count: number;
  offered_slots: AvailableSlot[] | null;
  selected_slot: AvailableSlot | null;
  patient_preferences: TimePreferences | null;
  next_send_at: string | null;
  last_sent_at: string | null;
  defer_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoshowReplyResult {
  sequenceId: string;
  patientId: string;
  intent: RecallIntent;
  previousStage: RecallStage;
  nextStage: RecallStage;
  action: string;
  replyText: string;
  smsSent: boolean;
  error?: string;
}

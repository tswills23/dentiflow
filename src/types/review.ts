// DentiFlow Reviews & Referrals Engine — Types

// =============================================================================
// Review Sequence Types
// =============================================================================

export type ReviewSequenceStatus =
  | 'survey_sent'
  | 'survey_reminded'
  | 'score_received'
  | 'review_requested'
  | 'referral_sent'
  | 'feedback_received'
  | 'completed'
  | 'no_response';

export interface ReviewSequence {
  id: string;
  practice_id: string;
  patient_id: string;
  appointment_id: string | null;
  status: ReviewSequenceStatus;
  satisfaction_score: number | null;
  review_url_sent: boolean;
  referral_sent: boolean;
  survey_send_at: string | null;
  reminder_sent_at: string | null;
  review_requested_at: string | null;
  referral_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Review Feedback Types
// =============================================================================

export interface ReviewFeedback {
  id: string;
  practice_id: string;
  patient_id: string;
  review_sequence_id: string;
  score: number;
  feedback_text: string;
  acknowledged: boolean;
  created_at: string;
}

// =============================================================================
// Referral Types
// =============================================================================

export type ReferralStatus = 'pending' | 'contacted' | 'booked' | 'converted' | 'declined';

export interface Referral {
  id: string;
  practice_id: string;
  referring_patient_id: string;
  referred_name: string | null;
  referred_phone: string | null;
  referral_link_hash: string;
  status: ReferralStatus;
  converted_at: string | null;
  created_at: string;
}

// =============================================================================
// Practice Review Config
// =============================================================================

export interface ReviewConfig {
  google_review_url?: string;
  referral_offer?: string;
  referral_incentive?: string;
  review_survey_delay_hours?: number;
}

// =============================================================================
// Score Parse Result
// =============================================================================

export interface ScoreParseResult {
  score: number | null;
  confidence: 'exact' | 'keyword' | 'none';
  rawText: string;
}

// =============================================================================
// Review Reply Handler Result
// =============================================================================

export interface ReviewReplyResult {
  sequenceId: string;
  patientId: string;
  action: 'score_received' | 'feedback_received' | 'clarification_sent' | 'error';
  score?: number;
  replyText: string;
  smsSent: boolean;
  error?: string;
}

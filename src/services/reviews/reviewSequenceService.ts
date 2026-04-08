// Review Sequence Service — manages the lifecycle of a review sequence
// Triggered after appointment completion, handles survey send + conditional routing

import { supabase } from '../../lib/supabase';
import { sendSMS } from '../execution/smsService';
import { saveMessage } from '../execution/conversationStore';
import { notifyStaff } from '../execution/staffNotifier';
import { logAutomation } from '../execution/metricsTracker';
import type { Practice, Patient } from '../../types/database';
import type { ReviewSequence, ReviewConfig } from '../../types/review';

const DEFAULT_SURVEY_DELAY_HOURS = 2;

// Get review config from practice (stored in practice_config jsonb)
export function getReviewConfig(practice: Practice): ReviewConfig {
  const cfg = practice.practice_config as Record<string, unknown>;
  return {
    google_review_url: (cfg?.google_review_url as string) || practice.google_review_link || undefined,
    referral_offer: (cfg?.referral_offer as string) || 'a complimentary exam',
    referral_incentive: (cfg?.referral_incentive as string) || 'a $100 gift card drawing',
    review_survey_delay_hours: (cfg?.review_survey_delay_hours as number) || DEFAULT_SURVEY_DELAY_HOURS,
  };
}

// Create a new review sequence after appointment completion
export async function createReviewSequence(params: {
  practiceId: string;
  patientId: string;
  appointmentId?: string;
  delayHours?: number;
}): Promise<ReviewSequence> {
  const surveyAt = new Date();
  surveyAt.setHours(surveyAt.getHours() + (params.delayHours ?? DEFAULT_SURVEY_DELAY_HOURS));

  const { data, error } = await supabase
    .from('review_sequences')
    .insert({
      practice_id: params.practiceId,
      patient_id: params.patientId,
      appointment_id: params.appointmentId || null,
      status: 'survey_sent',
      survey_send_at: surveyAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create review sequence: ${error.message}`);
  }

  console.log(`[reviewSequence] Created sequence ${data.id} for patient ${params.patientId}, survey at ${surveyAt.toISOString()}`);
  return data as ReviewSequence;
}

// Send the initial satisfaction survey SMS
export async function sendSurvey(
  sequence: ReviewSequence,
  patient: Patient,
  practice: Practice
): Promise<boolean> {
  const firstName = patient.first_name || 'there';
  const body = `Hey ${firstName}, thanks for coming in today! Quick question \u2014 on a scale of 1 to 5, how was your visit? Just text back a number.`;

  const result = await sendSMS(patient.phone!, body, practice.twilio_phone || '');

  if (result.success) {
    await saveMessage({
      practiceId: practice.id,
      patientId: patient.id,
      channel: 'sms',
      direction: 'outbound',
      messageBody: body,
      aiGenerated: false,
      automationType: 'review_request',
      twilioSid: result.sid,
    });

    await logAutomation({
      practiceId: practice.id,
      patientId: patient.id,
      automationType: 'review',
      action: 'survey_sent',
      result: 'sent',
      messageBody: body,
    });

    // Increment metric
    await supabase.rpc('increment_review_metric', {
      p_practice_id: practice.id,
      p_date: new Date().toISOString().split('T')[0],
      p_field: 'review_surveys_sent',
    });

    console.log(`[reviewSequence] Survey sent to ${patient.phone} (seq ${sequence.id})`);
  } else {
    console.error(`[reviewSequence] Failed to send survey to ${patient.phone}: ${result.error}`);
  }

  return result.success;
}

// Send the survey reminder (24h after first survey)
export async function sendSurveyReminder(
  sequence: ReviewSequence,
  patient: Patient,
  practice: Practice
): Promise<boolean> {
  const firstName = patient.first_name || 'there';
  const body = `Hey ${firstName}, just wanted to make sure you saw my earlier text. Would love to hear how your visit went \u2014 just text back 1 to 5.`;

  const result = await sendSMS(patient.phone!, body, practice.twilio_phone || '');

  if (result.success) {
    await saveMessage({
      practiceId: practice.id,
      patientId: patient.id,
      channel: 'sms',
      direction: 'outbound',
      messageBody: body,
      aiGenerated: false,
      automationType: 'review_request',
      twilioSid: result.sid,
    });

    // Update sequence
    await supabase
      .from('review_sequences')
      .update({ status: 'survey_reminded', reminder_sent_at: new Date().toISOString() })
      .eq('id', sequence.id);

    console.log(`[reviewSequence] Reminder sent to ${patient.phone} (seq ${sequence.id})`);
  }

  return result.success;
}

// Send Google review request (score 4-5)
export async function sendReviewRequest(
  sequence: ReviewSequence,
  patient: Patient,
  practice: Practice,
  reviewConfig: ReviewConfig
): Promise<boolean> {
  const firstName = patient.first_name || 'there';
  const googleUrl = reviewConfig.google_review_url;

  if (!googleUrl) {
    console.warn(`[reviewSequence] No Google review URL configured for practice ${practice.id}`);
    return false;
  }

  const body = `That means a lot, thank you ${firstName}. If you have 30 seconds, a Google review would really help us out. Here\u2019s the link: ${googleUrl}`;

  const result = await sendSMS(patient.phone!, body, practice.twilio_phone || '');

  if (result.success) {
    await saveMessage({
      practiceId: practice.id,
      patientId: patient.id,
      channel: 'sms',
      direction: 'outbound',
      messageBody: body,
      aiGenerated: false,
      automationType: 'review_request',
      twilioSid: result.sid,
    });

    await supabase
      .from('review_sequences')
      .update({
        status: 'review_requested',
        review_url_sent: true,
        review_requested_at: new Date().toISOString(),
      })
      .eq('id', sequence.id);

    await supabase.rpc('increment_review_metric', {
      p_practice_id: practice.id,
      p_date: new Date().toISOString().split('T')[0],
      p_field: 'review_links_sent',
    });

    console.log(`[reviewSequence] Review link sent to ${patient.phone} (seq ${sequence.id})`);
  }

  return result.success;
}

// Send feedback request (score 1-3)
export async function sendFeedbackRequest(
  sequence: ReviewSequence,
  patient: Patient,
  practice: Practice,
  providerName?: string
): Promise<boolean> {
  const firstName = patient.first_name || 'there';
  const provider = providerName || 'our team';
  const body = `I appreciate the honesty, ${firstName}. Can you tell me a bit more about what we could do better? Your feedback goes directly to ${provider}.`;

  const result = await sendSMS(patient.phone!, body, practice.twilio_phone || '');

  if (result.success) {
    await saveMessage({
      practiceId: practice.id,
      patientId: patient.id,
      channel: 'sms',
      direction: 'outbound',
      messageBody: body,
      aiGenerated: false,
      automationType: 'review_request',
      twilioSid: result.sid,
    });

    await supabase
      .from('review_sequences')
      .update({ status: 'feedback_received' })
      .eq('id', sequence.id);

    console.log(`[reviewSequence] Feedback request sent to ${patient.phone} (seq ${sequence.id})`);
  }

  return result.success;
}

// Send clarification message (unparseable score)
export async function sendClarification(
  sequence: ReviewSequence,
  patient: Patient,
  practice: Practice
): Promise<boolean> {
  const body = `Thanks for the reply! Could you rate your visit 1\u20135 so I can make sure we\u2019re doing right by you?`;

  const result = await sendSMS(patient.phone!, body, practice.twilio_phone || '');

  if (result.success) {
    await saveMessage({
      practiceId: practice.id,
      patientId: patient.id,
      channel: 'sms',
      direction: 'outbound',
      messageBody: body,
      aiGenerated: false,
      automationType: 'review_request',
      twilioSid: result.sid,
    });
  }

  return result.success;
}

// Send referral link (48h after review request, score 4-5 only)
export async function sendReferralMessage(
  sequence: ReviewSequence,
  patient: Patient,
  practice: Practice,
  reviewConfig: ReviewConfig,
  referralHash: string
): Promise<boolean> {
  const firstName = patient.first_name || 'there';
  const baseUrl = process.env.BASE_URL || 'https://dentiflow.app';
  const referralLink = `${baseUrl}/ref/${referralHash}`;
  const offer = reviewConfig.referral_offer || 'a complimentary exam';
  const incentive = reviewConfig.referral_incentive || 'a $100 gift card drawing';

  const body = `Hey ${firstName}, glad you had a great experience with us. If you know anyone who could use a great dentist, here\u2019s a link to share: ${referralLink}. Anyone who books through it gets ${offer} and you\u2019ll be entered to win ${incentive}.`;

  const result = await sendSMS(patient.phone!, body, practice.twilio_phone || '');

  if (result.success) {
    await saveMessage({
      practiceId: practice.id,
      patientId: patient.id,
      channel: 'sms',
      direction: 'outbound',
      messageBody: body,
      aiGenerated: false,
      automationType: 'review_request',
      twilioSid: result.sid,
    });

    await supabase
      .from('review_sequences')
      .update({
        referral_sent: true,
        referral_sent_at: new Date().toISOString(),
        status: 'referral_sent',
      })
      .eq('id', sequence.id);

    await supabase.rpc('increment_review_metric', {
      p_practice_id: practice.id,
      p_date: new Date().toISOString().split('T')[0],
      p_field: 'referrals_generated',
    });

    console.log(`[reviewSequence] Referral link sent to ${patient.phone} (seq ${sequence.id})`);
  }

  return result.success;
}

// Find active review sequence for a patient phone (for SMS routing)
export async function findActiveReviewSequenceByPhone(
  practiceId: string,
  phone: string
): Promise<ReviewSequence | null> {
  // First find the patient
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('phone', phone)
    .limit(1)
    .single();

  if (!patient) return null;

  // Then find active review sequence
  const { data: sequence } = await supabase
    .from('review_sequences')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('patient_id', patient.id)
    .in('status', ['survey_sent', 'survey_reminded', 'score_received', 'feedback_received'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return (sequence as unknown as ReviewSequence) || null;
}

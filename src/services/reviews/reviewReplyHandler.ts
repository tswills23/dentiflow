// Review Reply Handler — processes inbound SMS replies to review surveys
// Routes to: score capture → Google review OR feedback request

import { supabase } from '../../lib/supabase';
import { parseScore } from './scoreParser';
import {
  sendReviewRequest,
  sendFeedbackRequest,
  sendClarification,
  getReviewConfig,
} from './reviewSequenceService';
import { saveMessage } from '../execution/conversationStore';
import { notifyStaff } from '../execution/staffNotifier';
import { logAutomation } from '../execution/metricsTracker';
import type { Practice, Patient } from '../../types/database';
import type { ReviewSequence, ReviewReplyResult } from '../../types/review';

export async function handleReviewReply(
  sequence: ReviewSequence,
  messageBody: string,
  practiceId: string
): Promise<ReviewReplyResult> {
  // Fetch practice and patient
  const [{ data: practice }, { data: patient }] = await Promise.all([
    supabase.from('practices').select('*').eq('id', practiceId).single(),
    supabase.from('patients').select('*').eq('id', sequence.patient_id).single(),
  ]);

  if (!practice || !patient) {
    return {
      sequenceId: sequence.id,
      patientId: sequence.patient_id,
      action: 'error',
      replyText: '',
      smsSent: false,
      error: 'Practice or patient not found',
    };
  }

  // Log the inbound message
  await saveMessage({
    practiceId,
    patientId: patient.id,
    channel: 'sms',
    direction: 'inbound',
    messageBody,
    automationType: 'review_request',
  });

  // Determine what phase we're in
  const isWaitingForScore = sequence.status === 'survey_sent' || sequence.status === 'survey_reminded';
  const isWaitingForFeedback = sequence.status === 'score_received' && sequence.satisfaction_score !== null && sequence.satisfaction_score <= 3;
  // Also handle feedback_received status — patient may send additional feedback
  const isFeedbackPhase = sequence.status === 'feedback_received';

  // Phase 1: Waiting for satisfaction score
  if (isWaitingForScore) {
    return handleScoreReply(sequence, messageBody, patient as unknown as Patient, practice as unknown as Practice);
  }

  // Phase 2: Waiting for feedback text (score 1-3)
  if (isWaitingForFeedback || isFeedbackPhase) {
    return handleFeedbackReply(sequence, messageBody, patient as unknown as Patient, practice as unknown as Practice);
  }

  // If we get a reply in any other state, just log it
  console.log(`[reviewReply] Reply in unexpected state ${sequence.status} for seq ${sequence.id}`);
  return {
    sequenceId: sequence.id,
    patientId: patient.id,
    action: 'error',
    replyText: '',
    smsSent: false,
    error: `Unexpected state: ${sequence.status}`,
  };
}

async function handleScoreReply(
  sequence: ReviewSequence,
  messageBody: string,
  patient: Patient,
  practice: Practice
): Promise<ReviewReplyResult> {
  const parsed = parseScore(messageBody);
  const reviewConfig = getReviewConfig(practice);

  // Could not parse score — ask for clarification
  if (parsed.score === null) {
    await sendClarification(sequence, patient, practice);
    return {
      sequenceId: sequence.id,
      patientId: patient.id,
      action: 'clarification_sent',
      replyText: messageBody,
      smsSent: true,
    };
  }

  const score = parsed.score;

  // Save score to sequence
  await supabase
    .from('review_sequences')
    .update({
      satisfaction_score: score,
      status: 'score_received',
    })
    .eq('id', sequence.id);

  // Increment metric
  await supabase.rpc('increment_review_metric', {
    p_practice_id: practice.id,
    p_date: new Date().toISOString().split('T')[0],
    p_field: 'review_scores_received',
  });

  await logAutomation({
    practiceId: practice.id,
    patientId: patient.id,
    automationType: 'review',
    action: 'score_received',
    result: 'sent',
    metadata: { score, confidence: parsed.confidence },
  });

  // Route based on score
  if (score >= 4) {
    // Happy patient → Google review link
    await sendReviewRequest(sequence, patient, practice, reviewConfig);
  } else {
    // Unhappy patient → feedback request
    await sendFeedbackRequest(sequence, patient, practice);
  }

  return {
    sequenceId: sequence.id,
    patientId: patient.id,
    action: 'score_received',
    score,
    replyText: messageBody,
    smsSent: true,
  };
}

async function handleFeedbackReply(
  sequence: ReviewSequence,
  messageBody: string,
  patient: Patient,
  practice: Practice
): Promise<ReviewReplyResult> {
  // Store feedback
  await supabase.from('review_feedback').insert({
    practice_id: practice.id,
    patient_id: patient.id,
    review_sequence_id: sequence.id,
    score: sequence.satisfaction_score || 0,
    feedback_text: messageBody,
    acknowledged: false,
  });

  // Update sequence status
  await supabase
    .from('review_sequences')
    .update({ status: 'feedback_received' })
    .eq('id', sequence.id);

  // Notify staff about the negative feedback
  const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Unknown';
  await notifyStaff(practice, {
    level: 'urgent',
    reason: `${patientName} rated their visit ${sequence.satisfaction_score}/5`,
    patientName,
    patientPhone: patient.phone || 'No phone',
    message: messageBody,
  });

  await logAutomation({
    practiceId: practice.id,
    patientId: patient.id,
    automationType: 'review',
    action: 'feedback_received',
    result: 'sent',
    metadata: { score: sequence.satisfaction_score, feedbackLength: messageBody.length },
  });

  console.log(`[reviewReply] Feedback received from ${patient.phone} (score ${sequence.satisfaction_score}): ${messageBody.substring(0, 100)}`);

  return {
    sequenceId: sequence.id,
    patientId: patient.id,
    action: 'feedback_received',
    score: sequence.satisfaction_score || undefined,
    replyText: messageBody,
    smsSent: false, // No outbound SMS after feedback received
  };
}

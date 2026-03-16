import { loadDirectives } from './stlDirectiveLoader';
import { buildPrompt } from './stlPromptBuilder';
import { detectIntent } from './stlIntentDetector';
import { matchService } from '../serviceKnowledge';
import { generateResponse } from '../execution/aiClient';
import { validateResponse, getSafeTemplate } from '../execution/responseValidator';
import { sendSMS, canSendToPatient } from '../execution/smsService';
import { findOrCreatePatient, updatePatientStatus } from '../execution/patientManager';
import { saveMessage, getConversationHistory } from '../execution/conversationStore';
import { incrementMetric, recordResponseTime, logAutomation } from '../execution/metricsTracker';
import { notifyNewLead, notifyEscalation } from '../execution/staffNotifier';
import type { Patient, PatientSource, Channel } from '../../types/database';

export interface InboundMessage {
  practiceId: string;
  phone: string;
  message: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  source?: PatientSource;
  channel?: Channel;
}

export interface PipelineResult {
  success: boolean;
  patientId: string;
  intent: string;
  responseSent: string;
  responseTimeMs: number;
  blocked: boolean;
  blockReason?: string;
  error?: string;
}

export async function handleInboundMessage(input: InboundMessage): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const channel: Channel = input.channel || 'sms';

  try {
    // Step 1: Find or create patient
    const { patient, isNew } = await findOrCreatePatient({
      practiceId: input.practiceId,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      source: input.source || 'web_form',
    });

    // Step 2: Match dental service interest
    const serviceMatch = matchService(input.message);

    // Update patient's interested service if detected
    if (serviceMatch.service) {
      await findOrCreatePatient({
        ...input,
        interestedService: serviceMatch.service.id,
      });
    }

    // Step 3: Save inbound message
    await saveMessage({
      practiceId: input.practiceId,
      patientId: patient.id,
      channel,
      direction: 'inbound',
      messageBody: input.message,
      serviceContext: serviceMatch.service?.id,
    });

    // Step 4: Increment new_leads metric (only for new patients)
    if (isNew) {
      await incrementMetric(input.practiceId, 'new_leads');
    }

    // Step 5: Fire STL orchestrator (async logic below)
    const result = await runOrchestrator(input, patient, serviceMatch, channel, pipelineStart, isNew);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pipeline error';
    console.error('[stlOrchestrator] Pipeline failed:', message);

    return {
      success: false,
      patientId: '',
      intent: 'unknown',
      responseSent: '',
      responseTimeMs: Date.now() - pipelineStart,
      blocked: false,
      error: message,
    };
  }
}

async function runOrchestrator(
  input: InboundMessage,
  patient: Patient,
  serviceMatch: ReturnType<typeof matchService>,
  channel: Channel,
  pipelineStart: number,
  isNew: boolean
): Promise<PipelineResult> {
  // Load directives + practice config
  const directives = await loadDirectives(input.practiceId);
  const practice = directives.practice;

  // Detect intent
  const intentResult = detectIntent(input.message);

  // Handle opt_out immediately
  if (intentResult.intent === 'opt_out') {
    await updatePatientStatus(patient.id, 'inactive');
    await logAutomation({
      practiceId: input.practiceId,
      patientId: patient.id,
      automationType: 'speed_to_lead',
      action: 'opt_out',
      result: 'sent',
    });
    return {
      success: true,
      patientId: patient.id,
      intent: 'opt_out',
      responseSent: '',
      responseTimeMs: Date.now() - pipelineStart,
      blocked: false,
    };
  }

  // Check if we can send to this patient
  if (!(await canSendToPatient(patient))) {
    return {
      success: false,
      patientId: patient.id,
      intent: intentResult.intent,
      responseSent: '',
      responseTimeMs: Date.now() - pipelineStart,
      blocked: true,
      blockReason: 'patient_inactive_or_no_phone',
    };
  }

  // Get conversation history for context
  const history = await getConversationHistory(patient.id);

  // Build AI prompt
  const promptContext = buildPrompt({
    directives,
    intent: intentResult.intent,
    matchedService: serviceMatch.service,
    patient,
    conversationHistory: history,
    inboundMessage: input.message,
  });

  // Generate AI response
  let responseText: string;
  let blocked = false;
  let blockReason: string | undefined;

  const aiResponse = await generateResponse(
    promptContext.systemPrompt,
    input.message,
    promptContext.conversationHistory
  );

  if (aiResponse.success) {
    // Validate the response
    const validation = validateResponse(aiResponse.content, intentResult.intent, practice);
    responseText = validation.response;
    blocked = validation.blocked;
    blockReason = validation.blockReason;
  } else {
    // AI failed — use safe template fallback
    responseText = getSafeTemplate(intentResult.intent, practice);
    blocked = true;
    blockReason = 'ai_api_failure';
    console.warn('[stlOrchestrator] AI failed, using template fallback');
  }

  // Send SMS (or simulate)
  const smsResult = await sendSMS(
    patient.phone!,
    responseText,
    practice.twilio_phone || ''
  );

  // Save outbound message
  await saveMessage({
    practiceId: input.practiceId,
    patientId: patient.id,
    channel,
    direction: 'outbound',
    messageBody: responseText,
    serviceContext: serviceMatch.service?.id,
    aiGenerated: true,
    automationType: 'speed_to_lead',
    twilioSid: smsResult.sid,
  });

  // Update patient status
  if (patient.status === 'new') {
    await updatePatientStatus(patient.id, 'contacted');
  }

  // Record metrics
  const responseTimeMs = Date.now() - pipelineStart;
  await incrementMetric(input.practiceId, 'leads_contacted');
  await incrementMetric(input.practiceId, 'messages_sent');
  await recordResponseTime(input.practiceId, responseTimeMs);

  // Log automation
  await logAutomation({
    practiceId: input.practiceId,
    patientId: patient.id,
    automationType: 'speed_to_lead',
    action: `respond_${intentResult.intent}`,
    result: smsResult.success ? 'sent' : 'failed',
    responseTimeMs,
    messageBody: responseText,
    serviceContext: serviceMatch.service?.id,
    errorMessage: blocked ? blockReason : smsResult.error,
    metadata: {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      serviceMatch: serviceMatch.service?.id,
      blocked,
      blockReason,
      aiLatencyMs: aiResponse.latencyMs,
      simulated: smsResult.simulated,
    },
  });

  // Staff notifications
  if (intentResult.requiresEscalation) {
    await notifyEscalation(
      practice,
      patient,
      intentResult.escalationReason || 'escalation_triggered',
      input.message
    );
  } else if (isNew) {
    await notifyNewLead(practice, patient, input.message, serviceMatch.service?.id);
  }

  return {
    success: smsResult.success,
    patientId: patient.id,
    intent: intentResult.intent,
    responseSent: responseText,
    responseTimeMs,
    blocked,
    blockReason,
  };
}

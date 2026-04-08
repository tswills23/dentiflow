import type { DirectiveContext } from './stlDirectiveLoader';
import type { Intent } from './stlIntentDetector';
import type { DentalServiceProfile } from '../serviceKnowledge';
import type { Conversation, Patient } from '../../types/database';
import type { RecallVoice, RecallStage } from '../../types/recall';

export interface PromptContext {
  systemPrompt: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}

export function buildPrompt(params: {
  directives: DirectiveContext;
  intent: Intent;
  matchedService: DentalServiceProfile | null;
  patient: Patient;
  conversationHistory: Conversation[];
  inboundMessage: string;
}): PromptContext {
  const { directives, intent, matchedService, patient, conversationHistory } = params;
  const practice = directives.practice;
  const config = practice.practice_config || {};

  // Layer 1: Persona
  let systemPrompt = directives.persona + '\n\n';

  // Layer 2: Response rules
  systemPrompt += directives.responseRules + '\n\n';

  // Layer 3: Service knowledge (if matched)
  if (matchedService) {
    systemPrompt += `## Current Service Context: ${matchedService.name}\n`;
    systemPrompt += `Category: ${matchedService.category}\n`;
    systemPrompt += `Typical duration: ${matchedService.typicalDuration}\n`;
    systemPrompt += `Insurance: ${matchedService.insuranceNote}\n`;

    // Check for practice-specific pricing override
    const pricingOverrides = (config as Record<string, Record<string, unknown>>).pricing_overrides;
    if (pricingOverrides && pricingOverrides[matchedService.id]) {
      const override = pricingOverrides[matchedService.id] as { low: number; high: number; unit: string };
      systemPrompt += `Practice pricing for this service: $${override.low}-$${override.high} ${override.unit}. You MUST use ONLY these exact dollar amounts when discussing price — do NOT estimate or round outside this range.\n`;
    }

    // Add top Q&A for context
    if (matchedService.topQuestions.length > 0) {
      systemPrompt += '\nCommon patient questions about this service:\n';
      for (const q of matchedService.topQuestions.slice(0, 5)) {
        systemPrompt += `- Q: ${q.question}\n  A: ${q.shortAnswer}\n`;
      }
    }

    systemPrompt += `\nTone for this service: ${matchedService.toneNotes}\n\n`;
  }

  // Layer 4: Practice overrides
  if ((config as Record<string, string>).tone_notes) {
    systemPrompt += `## Practice Tone Notes\n${(config as Record<string, string>).tone_notes}\n\n`;
  }

  // Layer 5: Booking context
  if (intent === 'booking_request' || intent === 'general_inquiry') {
    systemPrompt += directives.bookingFlow + '\n\n';

    if ((config as Record<string, string>).new_patient_special && patient.patient_type !== 'existing_patient') {
      systemPrompt += `The practice currently offers: ${(config as Record<string, string>).new_patient_special}\n\n`;
    }

    if ((config as Record<string, string>).booking_notes) {
      systemPrompt += `Booking notes: ${(config as Record<string, string>).booking_notes}\n\n`;
    }
  }

  // Layer 6: Escalation rules
  if (intent === 'emergency') {
    systemPrompt += directives.escalation + '\n\n';
  }

  // Layer 7: Current context
  systemPrompt += `## Current Context\n`;
  systemPrompt += `Practice: ${practice.name}\n`;
  systemPrompt += `Practice phone: ${practice.phone || 'N/A'}\n`;
  systemPrompt += `Booking URL: ${practice.booking_url || 'N/A'}\n`;
  systemPrompt += `Patient name: ${patient.first_name || 'Unknown'}\n`;
  systemPrompt += `Patient type: ${patient.patient_type}\n`;
  systemPrompt += `Detected intent: ${intent}\n`;

  if ((config as Record<string, string>).insurance_note) {
    systemPrompt += `Insurance info: ${(config as Record<string, string>).insurance_note}\n`;
  }

  systemPrompt += `\nIMPORTANT: Keep your response under 300 characters. End with a clear next step.\n`;

  // Build conversation history for context
  const history: { role: 'user' | 'assistant'; content: string }[] = conversationHistory
    .slice(-4) // Last 4 messages — sufficient for SMS context
    .map((msg) => ({
      role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: msg.message_body,
    }));

  return {
    systemPrompt,
    conversationHistory: history,
  };
}

// =============================================================================
// RECALL REPLY PROMPT BUILDER
// =============================================================================

export function buildRecallReplyPrompt(params: {
  directives: DirectiveContext;
  voiceTier: RecallVoice;
  bookingStage: RecallStage;
  patient: Patient;
  senderName: string;
  conversationHistory: Conversation[];
  inboundMessage: string;
}): PromptContext {
  const { directives, voiceTier, bookingStage, patient, senderName, conversationHistory } = params;
  const practice = directives.practice;

  // Layer 1: Recall persona (voice/tone)
  let systemPrompt = directives.recallPersona + '\n\n';

  // Layer 2: Recall reply rules (3 copy laws)
  systemPrompt += directives.recallReplyRules + '\n\n';

  // Layer 3: Recall booking agent (stage-specific behavior)
  systemPrompt += directives.recallBookingAgent + '\n\n';

  // Layer 4: Current context
  systemPrompt += `## Current Context\n`;
  systemPrompt += `Practice: ${practice.name}\n`;
  systemPrompt += `Practice phone: ${practice.phone || 'N/A'}\n`;
  systemPrompt += `Patient name: ${patient.first_name || 'Unknown'}\n`;
  systemPrompt += `Voice tier: ${voiceTier}\n`;
  systemPrompt += `Sender name: ${senderName}\n`;
  systemPrompt += `Current booking stage: ${bookingStage}\n`;

  if (voiceTier === 'doctor') {
    systemPrompt += `\nYou are responding as Dr. ${senderName}. Use "I" language, no exclamation marks. Be authoritative but warm.\n`;
  } else if (voiceTier === 'hygienist') {
    systemPrompt += `\nYou are responding as ${senderName} (hygienist). Use "I" language, personal connection, caring but direct.\n`;
  } else {
    systemPrompt += `\nYou are responding as the office team. Use "we" language, warm and casual.\n`;
  }

  systemPrompt += `\nIMPORTANT: Keep your response under 320 characters. Every reply must advance toward scheduling or offer a micro-commitment.\n`;

  // Build conversation history
  const history: { role: 'user' | 'assistant'; content: string }[] = conversationHistory
    .slice(-6)
    .map((msg) => ({
      role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: msg.message_body,
    }));

  return {
    systemPrompt,
    conversationHistory: history,
  };
}

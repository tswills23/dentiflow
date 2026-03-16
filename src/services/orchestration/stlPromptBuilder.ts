import type { DirectiveContext } from './stlDirectiveLoader';
import type { Intent } from './stlIntentDetector';
import type { DentalServiceProfile } from '../serviceKnowledge';
import type { Conversation, Patient } from '../../types/database';

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
    .slice(-6) // Last 6 messages for context
    .map((msg) => ({
      role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: msg.message_body,
    }));

  return {
    systemPrompt,
    conversationHistory: history,
  };
}

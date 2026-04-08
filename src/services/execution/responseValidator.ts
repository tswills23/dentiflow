import type { Practice, PricingOverride } from '../../types/database';

export interface ValidationResult {
  valid: boolean;
  response: string;
  blocked: boolean;
  blockReason?: string;
}

const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Clinical language — diagnosis or treatment recommendations
  { pattern: /\byou\b.{0,20}\b(need|should|have|require|must)\b/i, reason: 'clinical_recommendation' },
  { pattern: /\b(you (might have|probably have|likely have|could have))\b/i, reason: 'clinical_recommendation' },
  { pattern: /\b(sounds like|could be|appears to be|seems like you have)\b/i, reason: 'implied_diagnosis' },
  { pattern: /\b(i recommend|i suggest|i would advise|you should get)\b/i, reason: 'treatment_recommendation' },
  { pattern: /\b(cavity|cavities|decay|infection|abscess|gingivitis|periodontitis|gum disease|TMJ|bruxism)\b/i, reason: 'diagnosis_language' },

  // Medication advice
  { pattern: /\b(take (ibuprofen|tylenol|advil|aspirin|motrin)|use (orajel|anbesol)|apply\b|rins(e|ing) with)\b/i, reason: 'medication_advice' },

  // Insurance specifics
  { pattern: /\b(your (plan|insurance|policy) covers|copay (is|would be)|deductible|out of pocket|your benefits)\b/i, reason: 'insurance_specifics' },

  // NOTE: specific_pricing is now handled dynamically in checkPricing() — not here

  // Past visit references (HIPAA)
  { pattern: /\b(\d+\s*(months?|years?|weeks?)\s*(since|ago|overdue))\b/i, reason: 'visit_history_reference' },
  { pattern: /\b(your last (visit|appointment|cleaning|checkup))\b/i, reason: 'visit_history_reference' },

  // Competitor references
  { pattern: /\b(better than|cheaper than|unlike other|other dentist)\b/i, reason: 'competitor_reference' },

  // Recall-specific blocked patterns
  { pattern: /\b(overdue|delinquent|negligent|neglected)\b/i, reason: 'recall_shaming_language' },
  { pattern: /\b(damage|deteriorat|worsen|worse)\b/i, reason: 'recall_fear_language' },
  { pattern: /\b(guarantee|free|discount|promo|special offer|limited time)\b/i, reason: 'recall_incentive_language' },

  // Clinical jargon (recall copy rules v2)
  { pattern: /\b(exam|baseline|comprehensive|prophy|prophylaxis|periodontal)\b/i, reason: 'recall_clinical_jargon' },
  { pattern: /\bhygiene visit\b/i, reason: 'recall_clinical_jargon' },
  { pattern: /\bcleaning\b/i, reason: 'recall_clinical_jargon' },

  // Dead-end phrases (recall copy rules v2 — banned closers)
  { pattern: /\bno pressure\b/i, reason: 'recall_dead_end_phrase' },
  { pattern: /\bat your earliest convenience\b/i, reason: 'recall_dead_end_phrase' },
  { pattern: /\bdon't hesitate to reach out\b/i, reason: 'recall_dead_end_phrase' },
  { pattern: /\bwe look forward to hearing from you\b/i, reason: 'recall_dead_end_phrase' },
];

/**
 * Checks dollar amounts in the response against practice pricing_overrides.
 * Returns null if all amounts are within configured ranges, or 'specific_pricing' if any are not.
 */
function checkPricing(response: string, practice: Practice): string | null {
  const dollarPattern = /\$(\d{2,4})\b/g;
  const matches = [...response.matchAll(dollarPattern)];

  if (matches.length === 0) return null; // No dollar amounts — nothing to block

  const overrides = practice.practice_config?.pricing_overrides;
  if (!overrides || Object.keys(overrides).length === 0) {
    // No pricing configured — block all dollar amounts (old behavior)
    return 'specific_pricing';
  }

  const ranges: PricingOverride[] = Object.values(overrides);

  for (const match of matches) {
    const amount = parseInt(match[1], 10);
    const withinAnyRange = ranges.some((r) => amount >= r.low && amount <= r.high);
    if (!withinAnyRange) {
      return 'specific_pricing'; // Amount outside all configured ranges
    }
  }

  return null; // All amounts fall within configured ranges
}

const MAX_SMS_LENGTH = 320;

export function getSafeTemplate(intent: string, practice: Practice): string {
  const name = practice.name;
  const phone = practice.phone || '';
  const url = practice.booking_url || '';

  switch (intent) {
    case 'emergency':
      return `I'm sorry to hear that. Please call us right away at ${phone} so we can get you in as soon as possible.`;
    case 'booking_request':
      return `We'd love to get you scheduled at ${name}! ${url ? `Book online here: ${url}` : `Call us at ${phone}`} and we'll find a time that works.`;
    case 'pricing_question':
      return `Great question! Pricing depends on your specific needs and insurance. Our team can walk you through everything — want to schedule a visit?`;
    case 'insurance_question':
      return `Our team can verify your benefits and walk you through coverage. Would you like to schedule a visit so we can take a look?`;
    case 'service_question':
      return `That's a great question for the doctor! Let's get you scheduled so they can go over everything with you. ${url ? url : `Call us at ${phone}`}`;
    default:
      return `Thanks for reaching out to ${name}! How can we help — are you looking to schedule a visit? ${url ? url : `Call us at ${phone}`}`;
  }
}

export function validateResponse(
  response: string,
  intent: string,
  practice: Practice
): ValidationResult {
  // Check against blocked patterns
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(response)) {
      const safeResponse = getSafeTemplate(intent, practice);
      return {
        valid: false,
        response: safeResponse,
        blocked: true,
        blockReason: reason,
      };
    }
  }

  // Check pricing — dynamic validation against practice_config.pricing_overrides
  const pricingBlock = checkPricing(response, practice);
  if (pricingBlock) {
    const safeResponse = getSafeTemplate(intent, practice);
    return {
      valid: false,
      response: safeResponse,
      blocked: true,
      blockReason: pricingBlock,
    };
  }

  // Character limit check
  if (response.length > MAX_SMS_LENGTH) {
    return {
      valid: false,
      response: response.substring(0, MAX_SMS_LENGTH - 3) + '...',
      blocked: true,
      blockReason: 'over_character_limit',
    };
  }

  return { valid: true, response, blocked: false };
}

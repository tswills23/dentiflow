// Recall Reply AI — Claude-powered reply generation for non-critical inbounds.
//
// Critical intents (opt_out, urgent, wrong_number, slot_selection at S4) NEVER
// reach this service. They are handled by the keyword classifier upstream.
//
// This service:
//   1. Checks three independent kill switches (DB flag, env var, force-off)
//   2. Checks hourly LLM cap per practice
//   3. Builds system prompt from cached directives + per-request context
//   4. Calls Claude with temperature 0, structured JSON, 8s timeout
//   5. Parses + type-guards the JSON response
//   6. Defense-in-depth emergency regex (overrides Claude's intent if pain language)
//   7. Validates state transition against bookingStateMachine
//   8. Reply shape allowlist (capitalization, punctuation, length, URL discipline)
//   9. Runs existing responseValidator (HIPAA blockers + new patterns)
//  10. Falls back to keyword/template path on ANY failure — never silence
//
// ALL fallback reasons are recorded in audit table for observability.

import { supabase } from '../../lib/supabase';
import { generateStructuredJSON } from '../execution/aiClientJSON';
// Types generated pre-migration. See memory/supabase-types-debugging.md.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { validateResponse } from '../execution/responseValidator';
import { getTransition } from './bookingStateMachine';
import { extractProviderNames } from './outreachEngine';
import { loadDirectives } from '../orchestration/stlDirectiveLoader';
import type { Practice, Patient } from '../../types/database';
import type {
  RecallSequence,
  RecallStage,
  RecallIntent,
  RecallVoice,
} from '../../types/recall';

// =============================================================================
// Public types
// =============================================================================

export interface RecallAIInput {
  practice: Practice;
  patient: Patient;
  sequence: RecallSequence;
  inboundMessage: string;
  bookingStage: RecallStage;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  bookingLinkUrl: string | null;
  monthsOverdue: number;
  voiceTier: RecallVoice;

  // EVAL ONLY: bypass production-only checks (hourly cap query, kill switches,
  // loadDirectives DB lookup). When set, callers must supply `directiveOverrides`
  // so buildSystemPrompt has the persona/rules/examples it needs.
  // Production code MUST NOT set this. Only used by scripts/test-recall-replies.ts.
  evalMode?: {
    bypassKillSwitches: boolean;
    bypassHourlyCap: boolean;
    directives: {
      recallPersona: string;
      recallReplyRules: string;
      recallReplyExamples: string;
    };
  };
}

export type AIFallbackReason =
  | 'kill_switch_db'
  | 'kill_switch_env_disabled'
  | 'kill_switch_force_off'
  | 'hourly_cap_exceeded'
  | 'api_failure'
  | 'timeout'
  | 'json_parse'
  | 'schema_invalid'
  | 'low_confidence'
  | 'reply_shape_invalid'
  | 'validator_blocked';

export interface RecallAIDecision {
  // Set when AI path produced a usable reply
  intent?: RecallIntent;
  nextState?: RecallStage;
  action?: string;
  replyText?: string;
  confidence?: number;
  reasoning?: string;

  // Always set
  fellBackToTemplate: boolean;
  fallbackReason?: AIFallbackReason;
  validatorBlockReason?: string;
  transitionOverridden: boolean;
  llmSuggestedState?: string;

  // Telemetry
  claudeLatencyMs: number;
  rawClaudeContent?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

// =============================================================================
// Constants
// =============================================================================

const VALID_INTENTS = new Set<RecallIntent>([
  'opt_out', 'urgent', 'not_now', 'decline', 'slot_selection',
  'confirm', 'asking_availability', 'preferences', 'booking_interest',
  'booked_confirmation', 'cost_question', 'reschedule', 'cancel',
  'identify_practice', 'unclear',
]);

const VALID_STAGES = new Set<RecallStage>([
  'S0_OPENING', 'S1_INTENT', 'S2_APPOINTMENT_TYPE', 'S3_TIME_PREF',
  'S4_AVAILABILITY', 'S5_CONFIRMATION', 'S6_COMPLETED', 'S7_HANDOFF',
  'EXIT_OPT_OUT', 'EXIT_DEFERRED', 'EXIT_DECLINED', 'EXIT_CANCELLED',
]);

const PAIN_REGEX = /\b(pain|hurt|ache|swell|bleed|broke|crack|chip|fever|swollen|throb|agony|killing me|can'?t (sleep|eat|open))\b/i;

const MAX_REPLY_LEN = 320;

// =============================================================================
// Main entry point
// =============================================================================

export async function generateRecallReply(input: RecallAIInput): Promise<RecallAIDecision> {
  const start = Date.now();
  const baseFallback: RecallAIDecision = {
    fellBackToTemplate: true,
    transitionOverridden: false,
    claudeLatencyMs: 0,
  };

  // 1. Three kill switches — any disable → fallback immediately.
  // Eval mode bypasses these so the harness can run against current code
  // without flipping production switches.
  if (!input.evalMode?.bypassKillSwitches) {
    if (process.env.RECALL_LLM_FORCE_OFF === 'true') {
      return { ...baseFallback, fallbackReason: 'kill_switch_force_off' };
    }
    if (process.env.RECALL_LLM_ENABLED !== 'true') {
      return { ...baseFallback, fallbackReason: 'kill_switch_env_disabled' };
    }
    if (input.practice.recall_llm_enabled !== true) {
      return { ...baseFallback, fallbackReason: 'kill_switch_db' };
    }
  }

  // 2. Hourly cap check (skipped in eval — would query and pollute prod audit)
  if (!input.evalMode?.bypassHourlyCap) {
    const cap = parseInt(process.env.RECALL_LLM_HOURLY_CAP || '50', 10);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await db
      .from('recall_reply_audit')
      .select('id', { count: 'exact', head: true })
      .eq('practice_id', input.practice.id)
      .eq('used_llm', true)
      .gte('created_at', oneHourAgo);

    if ((recentCount ?? 0) >= cap) {
      return { ...baseFallback, fallbackReason: 'hourly_cap_exceeded' };
    }
  }

  // 3. Build prompt and call Claude
  const systemPrompt = await buildSystemPrompt(input.practice, input.evalMode?.directives);
  const userMessage = buildUserMessage(input);

  const aiResponse = await generateStructuredJSON(
    systemPrompt,
    userMessage,
    input.conversationHistory,
    400
  );

  if (!aiResponse.success) {
    return {
      ...baseFallback,
      fallbackReason: aiResponse.error === 'timeout' ? 'timeout' : 'api_failure',
      claudeLatencyMs: aiResponse.latencyMs,
    };
  }

  // 4. Parse JSON
  const parsed = parseClaudeJSON(aiResponse.content);
  if ('error' in parsed) {
    return {
      ...baseFallback,
      fallbackReason: parsed.error === 'json_parse' ? 'json_parse' : 'schema_invalid',
      claudeLatencyMs: aiResponse.latencyMs,
      rawClaudeContent: aiResponse.content,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      cacheReadTokens: aiResponse.cacheReadTokens,
    };
  }

  // 5. Defense-in-depth emergency regex — overrides Claude if pain language present
  let effectiveIntent = parsed.intent;
  let transitionOverridden = false;
  if (effectiveIntent !== 'urgent' && PAIN_REGEX.test(input.inboundMessage)) {
    // Force the urgent path. Caller will see intent=urgent and the keyword
    // pre-filter would have caught most of these — this is defense-in-depth.
    effectiveIntent = 'urgent';
    transitionOverridden = true;
  }

  // 6. Confidence floor
  const minConfidence = parseFloat(process.env.RECALL_LLM_MIN_CONFIDENCE || '0.7');
  if (parsed.confidence < minConfidence) {
    return {
      ...baseFallback,
      fallbackReason: 'low_confidence',
      claudeLatencyMs: aiResponse.latencyMs,
      rawClaudeContent: aiResponse.content,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      cacheReadTokens: aiResponse.cacheReadTokens,
      llmSuggestedState: parsed.next_state,
    };
  }

  // 7. Validate state transition against bookingStateMachine
  const transition = getTransition(input.bookingStage, effectiveIntent);
  let llmSuggestedState: string | undefined;
  if (parsed.next_state !== transition.nextStage) {
    llmSuggestedState = parsed.next_state;
    transitionOverridden = true;
  }

  // 8. Reply shape allowlist
  if (!isValidReplyShape(parsed.reply_text, input.bookingLinkUrl)) {
    return {
      ...baseFallback,
      fallbackReason: 'reply_shape_invalid',
      claudeLatencyMs: aiResponse.latencyMs,
      rawClaudeContent: aiResponse.content,
      transitionOverridden,
      llmSuggestedState,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      cacheReadTokens: aiResponse.cacheReadTokens,
    };
  }

  // 9. Response validator — existing HIPAA blockers + new patterns from migration
  const mappedIntent = mapToValidatorIntent(effectiveIntent);
  const validation = validateResponse(parsed.reply_text, mappedIntent, input.practice);

  if (validation.blocked) {
    return {
      ...baseFallback,
      fallbackReason: 'validator_blocked',
      validatorBlockReason: validation.blockReason,
      claudeLatencyMs: aiResponse.latencyMs,
      rawClaudeContent: aiResponse.content,
      transitionOverridden,
      llmSuggestedState,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      cacheReadTokens: aiResponse.cacheReadTokens,
    };
  }

  // 10. Success
  return {
    intent: effectiveIntent,
    nextState: transition.nextStage,
    action: transition.action,
    replyText: parsed.reply_text,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    fellBackToTemplate: false,
    transitionOverridden,
    llmSuggestedState,
    claudeLatencyMs: aiResponse.latencyMs,
    rawClaudeContent: aiResponse.content,
    inputTokens: aiResponse.inputTokens,
    outputTokens: aiResponse.outputTokens,
    cacheReadTokens: aiResponse.cacheReadTokens,
  };
}

// =============================================================================
// Prompt building
// =============================================================================

interface ParsedDecision {
  intent: RecallIntent;
  next_state: RecallStage;
  action: string;
  reply_text: string;
  confidence: number;
  reasoning: string;
}

async function buildSystemPrompt(
  practice: Practice,
  directiveOverrides?: { recallPersona: string; recallReplyRules: string; recallReplyExamples: string }
): Promise<string> {
  const dirs = directiveOverrides ?? await loadDirectives(practice.id);
  const { doctorName } = extractProviderNames(practice);

  // Schema repeated 3x (Anthropic guidance for reliable structured output)
  const SCHEMA_BLOCK = `Respond with ONLY a single JSON object matching this exact schema. No prose, no code fences, no commentary before or after.

{
  "intent": "<one of: opt_out | urgent | not_now | decline | slot_selection | confirm | asking_availability | preferences | booking_interest | booked_confirmation | cost_question | reschedule | cancel | identify_practice | unclear>",
  "next_state": "<one of: S0_OPENING | S1_INTENT | S3_TIME_PREF | S4_AVAILABILITY | S5_CONFIRMATION | S6_COMPLETED | S7_HANDOFF | EXIT_OPT_OUT | EXIT_DEFERRED | EXIT_DECLINED | EXIT_CANCELLED>",
  "action": "<short action name, e.g. identify_practice, explain_reason, send_booking_link>",
  "reply_text": "<the SMS reply, 1-320 characters, sentence case, must follow voice rules>",
  "confidence": <number 0.0 to 1.0>,
  "reasoning": "<1 sentence why you classified this intent>"
}`;

  return `You are the recall reply assistant for ${practice.name} (Dr. ${doctorName}'s office).

Your job: classify the patient's inbound SMS, choose the next state, and write a reply.

# VOICE RULES (mandatory)

- Use sentence case with proper punctuation. NOT all-lowercase.
- Use contractions always (haven't, we'll, I'm, you're).
- Use em dashes (—) for natural pauses, not hyphens.
- Max ONE exclamation point per reply, preferably zero.
- Never lead with "Thanks for reaching out to X!"
- Never say "Our team" or "Our staff" — say "I" or "we".
- Personalize with months overdue rounded to whole number when present.
- Reply must be under 320 characters.

# HARD DO-NOT (validator will block your reply if you violate these)

You MUST NEVER write any of these:
- Diagnoses or clinical advice ("you might have", "your tooth is probably")
- Medication recommendations or prescription language
- Insurance acceptance claims ("we accept Cigna", "we're in-network")
- Specific prices or dollar amounts (numbers OR written: "two hundred dollars")
- Street addresses
- References to x-rays, charts, scans, or patient records
- Past visit references with month counts other than the rounded phrase from context
- Statements of fact not present in the user-context block

# BANNED WORDS (validator regex will block)

NEVER write any of these words in your reply UNLESS the patient said it first in their inbound:
- "cleaning" (use "visit" or "check-in" instead)
- "exam", "checkup" used as a noun-object (use "visit" instead)
- "prophy", "prophylaxis", "periodontal", "hygiene visit"
- "overdue", "delinquent", "negligent"
- "no pressure", "at your earliest convenience", "don't hesitate to reach out"

If the patient asks "what would I be coming in for?", respond with something
like "just a routine visit" or "just a regular check-in" — NEVER "a cleaning".

# TIME PHRASINGS

You MAY say things like "it's been about 8 months", "8 months since your last visit",
or "almost a year since you've been in". Use the rounded phrase from the user-context block
("Phrase you may use for time gap"). Always round to whole numbers — never "8.4 months".

You MUST NOT write any of these:
- "X months overdue" — sounds like shaming
- "since [month name]" or "since [year]" — sounds like we're tracking dates
- "you've been a patient since [year]"

If the patient describes pain, swelling, bleeding, fever, or any urgent symptom, return intent="urgent" with confidence 1.0 and a brief reply — never reassure or schedule, the deterministic urgent path will run.

# RECALL PERSONA

${dirs.recallPersona}

# RECALL REPLY RULES

${dirs.recallReplyRules}

# FEW-SHOT EXAMPLES

${dirs.recallReplyExamples}

# OUTPUT SCHEMA (CRITICAL — re-read before responding)

${SCHEMA_BLOCK}

# OUTPUT SCHEMA (REPEATED for emphasis)

${SCHEMA_BLOCK}

Now read the user's message and respond with ONLY the JSON object.`;
}

function buildUserMessage(input: RecallAIInput): string {
  const { doctorName } = extractProviderNames(input.practice);
  const overdueRounded = Math.round(input.monthsOverdue);
  const overduePhrase =
    overdueRounded >= 18 ? 'over a year and a half' :
    overdueRounded >= 12 ? 'over a year' :
    overdueRounded >= 9 ? 'almost a year' :
    overdueRounded >= 6 ? `about ${overdueRounded} months` :
    overdueRounded >= 3 ? 'a few months' :
    'a bit';

  return `# Practice Context
Practice: ${input.practice.name}
Doctor: Dr. ${doctorName}
Booking link (DO NOT invent another): ${input.bookingLinkUrl || '(none)'}

# Patient Context
First name: ${input.patient.first_name || 'there'}
Months overdue (rounded): ${overdueRounded}
Phrase you may use for time gap: "${overduePhrase}"
Voice tier: ${input.voiceTier}
Current booking stage: ${input.bookingStage}

# Patient said:
"${input.inboundMessage}"

Return the JSON object now.`;
}

// =============================================================================
// JSON parsing with type guards
// =============================================================================

function parseClaudeJSON(raw: string): ParsedDecision | { error: string } {
  // Strip code fences if Claude added them despite instructions
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(stripped);
  } catch {
    return { error: 'json_parse' };
  }

  // Type guards on every field
  if (typeof obj.intent !== 'string' || !VALID_INTENTS.has(obj.intent as RecallIntent)) {
    return { error: 'schema_invalid' };
  }
  if (typeof obj.next_state !== 'string' || !VALID_STAGES.has(obj.next_state as RecallStage)) {
    return { error: 'schema_invalid' };
  }
  if (typeof obj.action !== 'string' || obj.action.length === 0) {
    return { error: 'schema_invalid' };
  }
  if (typeof obj.reply_text !== 'string' || obj.reply_text.length === 0) {
    return { error: 'schema_invalid' };
  }
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    return { error: 'schema_invalid' };
  }
  if (typeof obj.reasoning !== 'string') {
    return { error: 'schema_invalid' };
  }

  return {
    intent: obj.intent as RecallIntent,
    next_state: obj.next_state as RecallStage,
    action: obj.action,
    reply_text: obj.reply_text.length > MAX_REPLY_LEN ? obj.reply_text.slice(0, MAX_REPLY_LEN) : obj.reply_text,
    confidence: obj.confidence,
    reasoning: obj.reasoning.length > 200 ? obj.reasoning.slice(0, 200) : obj.reasoning,
  };
}

// =============================================================================
// Reply shape allowlist
// =============================================================================

function isValidReplyShape(reply: string, allowedBookingLink: string | null): boolean {
  if (reply.length === 0 || reply.length > MAX_REPLY_LEN) return false;

  // Must start with capital letter (sentence case rule)
  if (!/^[A-Z]/.test(reply)) return false;

  // Must end with proper punctuation
  if (!/[.?!]$/.test(reply.trim())) return false;

  // No URLs allowed except the practice's booking link (if any)
  const urlMatches = reply.match(/https?:\/\/\S+/gi);
  if (urlMatches) {
    if (!allowedBookingLink) return false;
    for (const url of urlMatches) {
      if (!url.startsWith(allowedBookingLink)) return false;
    }
  }

  return true;
}

// =============================================================================
// Intent → validator-intent mapping
// =============================================================================

function mapToValidatorIntent(intent: RecallIntent): string {
  switch (intent) {
    case 'urgent': return 'emergency';
    case 'cost_question': return 'pricing_question';
    case 'booking_interest':
    case 'asking_availability':
    case 'preferences':
    case 'confirm':
    case 'slot_selection':
    case 'booked_confirmation':
    case 'reschedule':
      return 'booking_request';
    default: return 'default';
  }
}

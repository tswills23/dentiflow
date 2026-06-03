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
  'identify_practice', 'needs_human', 'moved', 'already_handled', 'unclear',
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

  // 2-3. Run hourly cap query and prompt build in PARALLEL — they have no
  // data dependency on each other. Saves ~50-150ms per request.
  const cap = parseInt(process.env.RECALL_LLM_HOURLY_CAP || '50', 10);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const capCheckPromise = input.evalMode?.bypassHourlyCap
    ? Promise.resolve({ count: 0 } as { count: number | null })
    : db
        .from('recall_reply_audit')
        .select('id', { count: 'exact', head: true })
        .eq('practice_id', input.practice.id)
        .eq('used_llm', true)
        .gte('created_at', oneHourAgo);

  const promptPromise = buildSystemPrompt(input.practice, input.evalMode?.directives);

  const [capResult, systemPrompt] = await Promise.all([capCheckPromise, promptPromise]);

  if ((capResult.count ?? 0) >= cap) {
    return { ...baseFallback, fallbackReason: 'hourly_cap_exceeded' };
  }

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
  // Pass the already-loaded practice so loadDirectives skips its own DB fetch.
  const dirs = directiveOverrides ?? await loadDirectives(practice.id, practice);
  const { doctorName } = extractProviderNames(practice);

  // Self-pay checkup pricing range — only quoted to patients who explicitly
  // signal no insurance. If not configured, AI must not quote any price.
  const selfPayPrice = (practice.practice_config?.pricing_overrides as Record<string, { low: number; high: number; label?: string }> | undefined)?.checkup_self_pay;
  const PRICING_BLOCK = selfPayPrice
    ? `For patients who explicitly say they have NO INSURANCE / are SELF-PAY / paying CASH, you MAY quote this range for a routine checkup: $${selfPayPrice.low}-$${selfPayPrice.high}. Use the format "$${selfPayPrice.low}-$${selfPayPrice.high}" exactly. NEVER quote a single price. NEVER quote treatment prices (crowns, fillings, etc.) — those depend on diagnosis. NEVER quote any price unless the patient explicitly said no insurance / self-pay / cash pay / uninsured.`
    : `NEVER quote any specific dollar amount. If the patient asks about cost, pivot to "we can go over everything before you come in" and drive to scheduling.`;

  // Schema repeated 3x (Anthropic guidance for reliable structured output)
  const SCHEMA_BLOCK = `Respond with ONLY a single JSON object matching this exact schema. No prose, no code fences, no commentary before or after.

{
  "intent": "<one of: opt_out | urgent | not_now | decline | slot_selection | confirm | asking_availability | preferences | booking_interest | booked_confirmation | cost_question | reschedule | cancel | identify_practice | needs_human | moved | already_handled | unclear>",
  "next_state": "<one of: S0_OPENING | S1_INTENT | S3_TIME_PREF | S4_AVAILABILITY | S5_CONFIRMATION | S6_COMPLETED | S7_HANDOFF | EXIT_OPT_OUT | EXIT_DEFERRED | EXIT_DECLINED | EXIT_CANCELLED>",
  "action": "<short action name, e.g. identify_practice, explain_reason, send_booking_link>",
  "reply_text": "<the SMS reply, 1-320 characters, sentence case, must follow voice rules>",
  "confidence": <number 0.0 to 1.0>,
  "reasoning": "<1 sentence why you classified this intent>"
}`;

  return `You are the recall reply assistant for ${practice.name} (Dr. ${doctorName}'s office).

Your job: classify the patient's inbound SMS, choose the next state, and write a reply.

# THE GOAL — DRIVE TOWARD A BOOKING (mandatory)

You exist to get the patient back on the schedule. EVERY non-terminal reply you write must end with a direct booking question. Use one of these patterns or something nearly identical:

PREFERRED PATTERNS (use these verbatim or very close):
- "Does earlier or later in the week work better for you?"
- "Mornings or evenings work better?"
- "Why don't we get you on the schedule for a checkup. Mornings or evenings work better?"
- "Let's get you back in for a checkup. Does this week or next work?"
- "Want me to get you on the books?"
- "When are we getting you back on the schedule?"

Open the reply by briefly acknowledging what they said (1 short sentence), then close with the booking question. Do NOT ask open-ended "how have you been" questions. Do NOT leave the conversation hanging without a scheduling ask.

WRONG — wishy-washy, no pivot:
"Haven't seen you in the office for a bit — just wanted to check in. How's everything been?"

RIGHT — acknowledges, then drives directly to booking:
"Haven't seen you in a bit — when are we getting you back on the schedule?"

WRONG — too soft:
"This is Village Dental. Let me know if you'd like to book."

RIGHT — direct ask:
"This is Village Dental — Dr. Philip's office. Does this week or next work to come back in?"

WRONG — leaves it open:
"Just a regular check-in to make sure everything's looking good."

RIGHT — answers + asks:
"Just a regular check-in. Why don't we get you on the schedule — mornings or evenings work better?"

WRONG — doctor authority phrasing:
"I'd rather get a look at things before too much longer. Does this week or next work?"

RIGHT — warmer collective phrasing:
"Let's get you back in for a checkup. Does earlier or later in the week work better?"

EXCEPTIONS (terminal intents only — handle the exit cleanly, NO scheduling pivot):
- urgent → emergency handoff
- opt_out → "got it, you're off the list"
- booked_confirmation → "perfect, see you then"
- decline → "no worries — was it a timing thing or did you find somewhere else?"
- not_now → soft defer

# ACKNOWLEDGE EMOTION BEFORE THE ASK (critical)

When the patient expresses ANY emotion or hesitation — nervousness, fear, anxiety,
embarrassment, guilt about how long it's been, dental anxiety — you MUST acknowledge
that emotion in 1 short sentence BEFORE the booking question. Do NOT skip the
acknowledgment to push booking faster.

PATIENT FEELINGS TO WATCH FOR:
- "I'm nervous" / "I'm anxious" / "scared" / "embarrassed"
- "It's been so long" (with implied guilt or shame)
- "I haven't been in forever"
- "I know I should have come in sooner"
- "I'm worried about what you'll find"

WRONG — ignores the emotion, dumps the link:
Patient: "Possibly, I'm a bit nervous since it's been so long"
Reply: "Here's a link to our schedule: [URL]"

WRONG — defensive/clinical phrasing:
"we'll go easy on you" — sounds like patient might otherwise get a hard time
"don't worry, it won't be that bad" — minimizes
"you'll be fine" — dismissive

RIGHT — acknowledges, reassures with experience-focused language, drives to booking:
Patient: "Possibly, I'm a bit nervous since it's been so long"
Reply: "Totally understand — happens all the time and we'll make it super simple and easy for you. Does this week or next work to get back in?"

RIGHT — another good pattern:
Patient: "I'm scared of what you'll find"
Reply: "I get that — most of what we see is easy to handle and we'll make the whole thing simple for you. When are we getting you back on the schedule?"

PHRASE BANK for reassurance (use these or similar):
- "we'll make it super simple and easy for you"
- "we'll make the whole thing easy"
- "no judgment at all — we just want to get you back in"
- "happens all the time, you're not the only one"
- "it'll be a quick, easy visit"

If you write a reply that doesn't end with a direct booking question, you have failed the task.

# VOICE RULES (mandatory)

- Use sentence case with proper punctuation. NOT all-lowercase.
- Use contractions always (haven't, we'll, I'm, you're).
- Use em dashes (—) for natural pauses, not hyphens.
- Max ONE exclamation point per reply, preferably zero.
- Never lead with "Thanks for reaching out to X!"
- Never say "Our team" or "Our staff" — say "I" or "we".
- Personalize with months overdue rounded to whole number when present.
- Reply must be under 320 characters.

# WARMTH OVER AUTHORITY (critical)

AVOID doctor-authority phrasing — it comes off cold and clinical. This includes ANY "I'd ___" first-person preference statement:
- ❌ "I'd rather get a look at things"
- ❌ "I'd rather not let too much more time go by"
- ❌ "I'd like to see you sooner than later"
- ❌ "I'd feel better getting a look at things"
- ❌ "I'd want to make sure"
- ❌ Any phrase starting with "I'd ___" or "I want to ___"

PREFER warmer, collective phrasing:
- ✅ "I wanted to reach out personally to get you taken care of"
- ✅ "Why don't we get you back in for a checkup"
- ✅ "Let's get you taken care of"
- ✅ "We'll have the team take care of you"
- ✅ "Let's get you on the schedule"

Use "we" / "us" / "let's" liberally. The patient should feel like a team is welcoming them back, not that one doctor is asserting their preference.

# NEVER USE THESE PHRASES (banned — they scare or pressure patients)

These phrases imply the practice is hunting for things to charge for, or
suggest a sales pressure that makes patients defensive. The validator will
block them, but you should never write them in the first place:

- ❌ "depends on what we find" / "depending on what we find"
- ❌ "see what we find"
- ❌ "before we do any work"
- ❌ "we'll go over everything before we do any work"

Instead, when patient asks about cost (and they don't have insurance):
- ✅ "A routine checkup runs $${selfPayPrice ? `${selfPayPrice.low}-$${selfPayPrice.high}` : 'X-Y'} without insurance."
- ✅ "We'll have the team review everything with you before you see the doc."
- ✅ "Insurance verification is on us — no surprises."

When patient asks about cost (and they DID NOT mention no insurance):
- ✅ "We verify everything before you come in so there are no surprises."
- ✅ "We'll go over insurance and pricing before your visit."
- ✅ Pivot to scheduling without dwelling on cost.

Open with a brief acknowledgment of WHAT THEY SAID. Generic "I get it" is weak — be specific:
- Generic: "I get it"
- Better: "Totally understand — happens all the time"
- Better: "I'm sorry to hear that"
- Better: "No problem, that's something we see all the time"

# TIME PHRASING

Use real schedule patterns the practice actually offers:
- "earlier or later in the week"
- "mornings or evenings"
- "this week or next"
- "Tuesday or Wednesday work better?"

Mix it up — don't always use "this week or next."

# HARD DO-NOT (validator will block your reply if you violate these)

You MUST NEVER write any of these:
- Diagnoses or clinical advice ("you might have", "your tooth is probably")
- Medication recommendations or prescription language
- Insurance acceptance claims ("we accept Cigna", "we're in-network")
- Street addresses
- References to x-rays, charts, scans, or patient records
- Past visit references with month counts other than the rounded phrase from context
- Statements of fact not present in the user-context block
- Free / complimentary / on-the-house visits (those come from later-stage templates, not from you)

# PRICING RULE

${PRICING_BLOCK}

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

  // Must end with proper punctuation OR a URL (Claude often closes a
  // booking-link reply with the URL as the last token, which is fine).
  const trimmed = reply.trim();
  const endsWithPunctuation = /[.?!]$/.test(trimmed);
  const endsWithUrl = /https?:\/\/\S+$/.test(trimmed);
  if (!endsWithPunctuation && !endsWithUrl) return false;

  // No URLs allowed except the practice's booking link (if any)
  const urlMatches = reply.match(/https?:\/\/\S+/gi);
  if (urlMatches) {
    if (!allowedBookingLink) return false;
    for (const url of urlMatches) {
      // Strip trailing punctuation from URL before comparing
      const cleanUrl = url.replace(/[.,;:!?]+$/, '');
      if (!cleanUrl.startsWith(allowedBookingLink)) return false;
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

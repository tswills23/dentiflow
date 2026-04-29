// Recall Reply Test Harness
//
// Run before each deploy:  npx tsx scripts/test-recall-replies.ts
//
// Two-stage scoring:
//   1. Intent-correctness gate — 100% match required.
//   2. Reply shape — must-include / must-not-match regex checks.
//
// Critical-path fixtures (opt_out, urgent, wrong_number) are tested via the
// keyword classifier ONLY. They never touch Claude.
//
// All other fixtures call the actual recallReplyAI service with real Anthropic
// API calls (~$0.05/run). Set RECALL_LLM_ENABLED=true and a test practice in
// memory.

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { FIXTURES, type RecallReplyFixture } from '../src/services/recall/__fixtures__/recallReplyScenarios';
import { classifyCriticalIntent, classifyIntent } from '../src/services/recall/intentClassifier';
import { generateRecallReply } from '../src/services/recall/recallReplyAI';
import { getTransition } from '../src/services/recall/bookingStateMachine';
import type { Practice, Patient } from '../src/types/database';
import type { RecallSequence } from '../src/types/recall';

// Load directives from disk directly — no DB lookup, fully isolated from prod.
const DIRECTIVES_DIR = path.resolve(__dirname, '../directives');
function loadFile(name: string): string {
  try {
    return fs.readFileSync(path.join(DIRECTIVES_DIR, name), 'utf-8');
  } catch {
    return '';
  }
}
const TEST_DIRECTIVES = {
  recallPersona: loadFile('recall_persona.md'),
  recallReplyRules: loadFile('recall_reply_rules.md'),
  recallReplyExamples: loadFile('recall_reply_examples.md'),
};

interface FixtureResult {
  id: string;
  passed: boolean;
  reasons: string[];
  inbound: string;
  expectedIntent: string;
  actualIntent: string | null;
  reply: string | null;
  fallbackReason: string | null;
  validatorBlockReason: string | null;
  rawClaudeContent: string | null;
  latencyMs: number | null;
}

// Synthetic test practice — fully isolated from production.
// evalMode bypasses kill-switch and hourly-cap checks so the eval doesn't
// query or pollute the production audit table.
const TEST_PRACTICE: Practice = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Village Dental',
  owner_name: 'Dr. Philip',
  phone: '+18335551234',
  email: 'test@example.com',
  website: null,
  address: null,
  city: null,
  state: null,
  timezone: 'America/Chicago',
  booking_platform: 'manual',
  booking_url: 'https://example.com/book',
  google_review_link: null,
  brand_voice: 'friendly',
  twilio_phone: '+18335551234',
  practice_config: {
    providers: [
      { name: 'Philip', title: 'DDS' },
    ],
  } as Practice['practice_config'],
  business_hours: {} as Practice['business_hours'],
  appointment_buffer_minutes: 15,
  active: true,
  recall_llm_enabled: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const TEST_PATIENT: Patient = {
  id: '00000000-0000-0000-0000-000000000002',
  practice_id: TEST_PRACTICE.id,
  first_name: 'Scott',
  last_name: 'Wills',
  phone: '+16307476875',
  email: null,
  source: 'recall',
  status: 'active',
  interested_service: null,
  patient_type: 'recall',
  last_visit_date: null,
  lead_score: null,
  tags: null,
  metadata: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as Patient;

function buildSequence(fixture: RecallReplyFixture): RecallSequence {
  return {
    id: '00000000-0000-0000-0000-000000000003',
    practice_id: TEST_PRACTICE.id,
    patient_id: TEST_PATIENT.id,
    sequence_status: 'active',
    sequence_day: 0,
    booking_stage: fixture.bookingStage,
    assigned_voice: fixture.voiceTier,
    months_overdue: fixture.monthsOverdue,
    segment_overdue: fixture.monthsOverdue >= 12 ? 'gte_12' : fixture.monthsOverdue >= 6 ? 'gte_6_lt_12' : 'lt_6',
    booking_link_token: 'test-token',
    last_sent_at: null,
    next_send_at: null,
    template_id: null,
    opt_out: false,
    defer_until: null,
    exit_reason: null,
    reply_count: 0,
    offered_slots: null,
    selected_slot: null,
    patient_preferences: null,
    link_clicked_at: null,
    link_followup_sent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as RecallSequence;
}

async function runFixture(fixture: RecallReplyFixture): Promise<FixtureResult> {
  const reasons: string[] = [];
  const result: FixtureResult = {
    id: fixture.id,
    passed: false,
    reasons,
    inbound: fixture.inboundMessage,
    expectedIntent: fixture.expected.intent,
    actualIntent: null,
    reply: null,
    fallbackReason: null,
    validatorBlockReason: null,
    rawClaudeContent: null,
    latencyMs: null,
  };

  // Critical-path fixtures: assert keyword classifier catches before LLM
  if (fixture.expected.expectsKeywordPath) {
    const critical = classifyCriticalIntent(fixture.inboundMessage, fixture.bookingStage);
    if (!critical) {
      reasons.push(`expected critical-path bypass but classifyCriticalIntent returned null`);
      return result;
    }
    // Confirm canonical classifyIntent returns the expected intent (used downstream)
    const cls = classifyIntent(fixture.inboundMessage, fixture.bookingStage);
    result.actualIntent = cls.intent;
    if (cls.intent !== fixture.expected.intent) {
      reasons.push(`intent mismatch: expected ${fixture.expected.intent}, got ${cls.intent}`);
      return result;
    }
    const transition = getTransition(fixture.bookingStage, cls.intent);
    if (transition.nextStage !== fixture.expected.nextStage) {
      reasons.push(`nextStage mismatch: expected ${fixture.expected.nextStage}, got ${transition.nextStage}`);
      return result;
    }
    result.passed = true;
    return result;
  }

  // Conversational fixtures: call Claude (evalMode bypasses prod-only checks)
  const decision = await generateRecallReply({
    practice: TEST_PRACTICE,
    patient: TEST_PATIENT,
    sequence: buildSequence(fixture),
    inboundMessage: fixture.inboundMessage,
    bookingStage: fixture.bookingStage,
    conversationHistory: [],
    bookingLinkUrl: TEST_PRACTICE.booking_url,
    evalMode: {
      bypassKillSwitches: true,
      bypassHourlyCap: true,
      directives: TEST_DIRECTIVES,
    },
    monthsOverdue: fixture.monthsOverdue,
    voiceTier: fixture.voiceTier,
  });

  result.latencyMs = decision.claudeLatencyMs;
  result.fallbackReason = decision.fallbackReason ?? null;
  result.validatorBlockReason = decision.validatorBlockReason ?? null;
  result.rawClaudeContent = decision.rawClaudeContent ?? null;

  if (decision.fellBackToTemplate) {
    reasons.push(`Claude fell back: ${decision.fallbackReason}${decision.validatorBlockReason ? ` (${decision.validatorBlockReason})` : ''}`);
    return result;
  }

  result.actualIntent = decision.intent ?? null;
  result.reply = decision.replyText ?? null;

  // Intent gate
  if (decision.intent !== fixture.expected.intent) {
    reasons.push(`intent mismatch: expected ${fixture.expected.intent}, got ${decision.intent}`);
  }

  // nextStage gate
  if (decision.nextState !== fixture.expected.nextStage) {
    reasons.push(`nextStage mismatch: expected ${fixture.expected.nextStage}, got ${decision.nextState}`);
  }

  // Must-contain
  for (const must of fixture.expected.replyTextMustContain || []) {
    const reply = decision.replyText || '';
    const matches = typeof must === 'string'
      ? reply.toLowerCase().includes(must.toLowerCase())
      : must.test(reply);
    if (!matches) {
      reasons.push(`reply missing required: ${must}`);
    }
  }

  // Must-not-match
  for (const banned of fixture.expected.replyTextMustNotMatch || []) {
    const reply = decision.replyText || '';
    if (banned.test(reply)) {
      reasons.push(`reply matched banned pattern: ${banned}`);
    }
  }

  result.passed = reasons.length === 0;
  return result;
}

async function main() {
  console.log(`\n[test-recall-replies] Running ${FIXTURES.length} fixtures...\n`);
  console.log(`  (evalMode bypasses kill switches + cap query — fully isolated from production audit table)\n`);

  const results: FixtureResult[] = [];
  for (const fixture of FIXTURES) {
    process.stdout.write(`  ${fixture.id} ... `);
    const result = await runFixture(fixture);
    results.push(result);
    console.log(result.passed ? 'PASS' : `FAIL (${result.reasons.join('; ')})`);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n[test-recall-replies] ${passed}/${results.length} passed, ${failed} failed`);

  // Detailed failure breakdown
  if (failed > 0) {
    console.log(`\nFailures:`);
    for (const r of results.filter((x) => !x.passed)) {
      console.log(`\n  ${r.id}`);
      console.log(`    inbound: "${r.inbound}"`);
      console.log(`    expected intent: ${r.expectedIntent}`);
      console.log(`    actual intent:   ${r.actualIntent ?? '(none)'}`);
      if (r.reply) console.log(`    reply: "${r.reply}"`);
      if (r.fallbackReason) console.log(`    fallback: ${r.fallbackReason}`);
      if (r.validatorBlockReason) console.log(`    validator block reason: ${r.validatorBlockReason}`);
      if (r.rawClaudeContent) console.log(`    raw Claude: ${r.rawClaudeContent.slice(0, 400)}`);
      console.log(`    reasons: ${r.reasons.join('; ')}`);
    }
  }

  // Latency summary
  const latencies = results.filter((r) => r.latencyMs !== null).map((r) => r.latencyMs as number).sort((a, b) => a - b);
  if (latencies.length > 0) {
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    console.log(`\nLatency: p50=${p50}ms, p95=${p95}ms (${latencies.length} samples)`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[test-recall-replies] FATAL:', err);
  process.exit(2);
});

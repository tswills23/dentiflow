// Roleplay harness — call recallReplyAI directly with arbitrary patient input.
// Usage: npx tsx scripts/roleplay-recall.ts "<patient message>" [stage] [voice] [months]
//
// Defaults: stage=S0_OPENING, voice=doctor, months=13
// evalMode bypasses kill switches and audit-table writes.

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { generateRecallReply } from '../src/services/recall/recallReplyAI';
import type { Practice, Patient } from '../src/types/database';
import type { RecallSequence, RecallStage, RecallVoice } from '../src/types/recall';

const DIRECTIVES_DIR = path.resolve(__dirname, '../directives');
function loadFile(name: string): string {
  try { return fs.readFileSync(path.join(DIRECTIVES_DIR, name), 'utf-8'); }
  catch { return ''; }
}
const TEST_DIRECTIVES = {
  recallPersona: loadFile('recall_persona.md'),
  recallReplyRules: loadFile('recall_reply_rules.md'),
  recallReplyExamples: loadFile('recall_reply_examples.md'),
};

const TEST_PRACTICE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Village Dental',
  owner_name: 'Dr. Philip',
  phone: '+18335551234',
  email: 'test@example.com',
  website: null, address: null, city: null, state: null,
  timezone: 'America/Chicago',
  booking_platform: 'manual',
  booking_url: 'https://example.com/book',
  google_review_link: null,
  brand_voice: 'friendly',
  twilio_phone: '+18335551234',
  practice_config: {
    providers: [{ name: 'Philip', title: 'DDS' }],
    pricing_overrides: {
      checkup_self_pay: { low: 150, high: 200, label: 'routine checkup, no insurance' },
    },
  },
  business_hours: {},
  appointment_buffer_minutes: 15,
  active: true,
  recall_llm_enabled: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Practice;

const TEST_PATIENT = {
  id: '00000000-0000-0000-0000-000000000002',
  practice_id: TEST_PRACTICE.id,
  first_name: 'Trevor',
  last_name: 'Wills',
  phone: '+16306400029',
  source: 'recall',
  status: 'active',
  patient_type: 'recall',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Patient;

async function main() {
  const message = process.argv[2];
  const stage = (process.argv[3] || 'S0_OPENING') as RecallStage;
  const voice = (process.argv[4] || 'doctor') as RecallVoice;
  const months = parseFloat(process.argv[5] || '13');

  if (!message) {
    console.error('Usage: npx tsx scripts/roleplay-recall.ts "<patient message>" [stage] [voice] [months]');
    process.exit(1);
  }

  const sequence = {
    id: '00000000-0000-0000-0000-000000000003',
    practice_id: TEST_PRACTICE.id,
    patient_id: TEST_PATIENT.id,
    sequence_status: 'active',
    sequence_day: 0,
    booking_stage: stage,
    assigned_voice: voice,
    months_overdue: months,
    segment_overdue: months >= 12 ? 'gte_12' : months >= 6 ? 'gte_6_lt_12' : 'lt_6',
    booking_link_token: 'roleplay-token',
    reply_count: 0,
  } as unknown as RecallSequence;

  console.log(`\n--- ROLEPLAY ---`);
  console.log(`Patient: "${message}"`);
  console.log(`Stage: ${stage}  Voice: ${voice}  Months overdue: ${months}\n`);

  const t0 = Date.now();
  const decision = await generateRecallReply({
    practice: TEST_PRACTICE,
    patient: TEST_PATIENT,
    sequence,
    inboundMessage: message,
    bookingStage: stage,
    conversationHistory: [],
    bookingLinkUrl: `https://dentiflow-production.up.railway.app/r/roleplay-token`,
    monthsOverdue: months,
    voiceTier: voice,
    evalMode: {
      bypassKillSwitches: true,
      bypassHourlyCap: true,
      directives: TEST_DIRECTIVES,
    },
  });
  const elapsed = Date.now() - t0;

  console.log(`--- AI RESPONSE (${elapsed}ms) ---`);
  if (decision.fellBackToTemplate) {
    console.log(`FALLBACK: ${decision.fallbackReason}`);
    if (decision.validatorBlockReason) console.log(`Validator: ${decision.validatorBlockReason}`);
    if (decision.rawClaudeContent) {
      console.log(`\nClaude RAW (rejected):`);
      console.log(decision.rawClaudeContent.slice(0, 800));
    }
  } else {
    console.log(`Reply: "${decision.replyText}"`);
    console.log(`\nIntent:     ${decision.intent}`);
    console.log(`Action:     ${decision.action}`);
    console.log(`Next state: ${decision.nextState}`);
    console.log(`Confidence: ${decision.confidence}`);
    console.log(`Reasoning:  ${decision.reasoning}`);
    if (decision.transitionOverridden) {
      console.log(`(Claude suggested ${decision.llmSuggestedState}, state machine overrode to ${decision.nextState})`);
    }
  }
  console.log();
}

main().catch(err => { console.error('FATAL:', err); process.exit(2); });

// Replay a past recall reply through the current code path.
// Use: npx tsx scripts/replay-recall-reply.ts <audit_row_id>
//
// Pulls the audit row, reconstructs the input, re-runs the AI generator,
// prints a diff vs the historical output. Lets you verify that "same input
// still produces same output" after any change to prompts/code.

import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { generateRecallReply } from '../src/services/recall/recallReplyAI';
import type { Practice, Patient } from '../src/types/database';
import type { RecallSequence, RecallStage, RecallVoice } from '../src/types/recall';

async function main() {
  const auditId = process.argv[2];
  if (!auditId) {
    console.error('Usage: npx tsx scripts/replay-recall-reply.ts <audit_row_id>');
    process.exit(1);
  }

  // Pull the audit row
  const { data: audit, error: auditErr } = await supabase
    .from('recall_reply_audit')
    .select('*')
    .eq('id', auditId)
    .single();

  if (auditErr || !audit) {
    console.error(`Audit row ${auditId} not found:`, auditErr?.message);
    process.exit(1);
  }

  // Pull current state of practice, patient, sequence
  const [{ data: practice }, { data: patient }, { data: sequence }] = await Promise.all([
    supabase.from('practices').select('*').eq('id', audit.practice_id).single(),
    supabase.from('patients').select('*').eq('id', audit.patient_id).single(),
    supabase.from('recall_sequences').select('*').eq('id', audit.sequence_id).single(),
  ]);

  if (!practice || !patient || !sequence) {
    console.error('Failed to load practice/patient/sequence — they may have been deleted');
    process.exit(1);
  }

  console.log(`\nReplaying audit row ${auditId}`);
  console.log(`  Original timestamp: ${audit.created_at}`);
  console.log(`  Inbound: "${audit.inbound_message}"`);
  console.log(`  Original intent: ${audit.intent} (used_llm=${audit.used_llm})`);
  console.log(`  Original reply: "${audit.reply_text}"`);
  if (audit.fallback_reason) console.log(`  Original fallback: ${audit.fallback_reason}`);
  console.log(`\n  Re-running with current code...\n`);

  // Force LLM path for replay
  process.env.RECALL_LLM_ENABLED = 'true';
  process.env.RECALL_LLM_FORCE_OFF = '';

  const decision = await generateRecallReply({
    practice: practice as unknown as Practice,
    patient: patient as unknown as Patient,
    sequence: sequence as unknown as RecallSequence,
    inboundMessage: audit.inbound_message,
    bookingStage: audit.state_before as RecallStage,
    conversationHistory: [],
    bookingLinkUrl: (sequence as { booking_link_token?: string }).booking_link_token
      ? `${process.env.BACKEND_URL}/r/${(sequence as { booking_link_token?: string }).booking_link_token}`
      : null,
    monthsOverdue: (sequence as { months_overdue?: number }).months_overdue || 0,
    voiceTier: ((sequence as { assigned_voice?: string }).assigned_voice as RecallVoice) || 'office',
  });

  console.log(`  New intent: ${decision.intent ?? '(none — fell back)'}`);
  console.log(`  New reply: ${decision.replyText ? `"${decision.replyText}"` : '(none — fell back)'}`);
  if (decision.fallbackReason) console.log(`  New fallback: ${decision.fallbackReason}`);
  console.log(`  New latency: ${decision.claudeLatencyMs}ms`);

  // Diff
  const intentChanged = audit.intent !== decision.intent;
  const replyChanged = audit.reply_text !== decision.replyText;
  console.log(`\n  Intent changed: ${intentChanged ? 'YES' : 'no'}`);
  console.log(`  Reply changed:  ${replyChanged ? 'YES' : 'no'}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});

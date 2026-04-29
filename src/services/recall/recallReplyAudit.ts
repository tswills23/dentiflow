// Recall Reply Audit — fire-and-forget insert helper.
// Audit failures must NEVER crash the request handler. Caller should
// call this with .catch() or in a non-awaited tail position.

import { supabase } from '../../lib/supabase';

// Types are generated before this migration runs. After applying migration 009
// + regenerating types, this cast can be removed. See memory/supabase-types-debugging.md.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface RecallReplyAuditRow {
  sequence_id: string;
  practice_id: string;
  patient_id: string;
  inbound_message: string;
  intent: string;
  confidence_score?: number | null;
  state_before: string;
  state_after: string;
  action: string;
  reply_text: string;
  used_llm: boolean;
  llm_latency_ms?: number | null;
  llm_reasoning?: string | null;
  raw_claude_content?: string | null;
  validator_pass?: boolean;
  validator_block_reason?: string | null;
  fallback_reason?: string | null;
  transition_overridden?: boolean;
  llm_suggested_state?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
}

export async function insertRecallAudit(row: RecallReplyAuditRow): Promise<void> {
  try {
    const { error } = await db.from('recall_reply_audit').insert({
      sequence_id: row.sequence_id,
      practice_id: row.practice_id,
      patient_id: row.patient_id,
      inbound_message: row.inbound_message,
      intent: row.intent,
      confidence_score: row.confidence_score ?? null,
      state_before: row.state_before,
      state_after: row.state_after,
      action: row.action,
      reply_text: row.reply_text,
      used_llm: row.used_llm,
      llm_latency_ms: row.llm_latency_ms ?? null,
      llm_reasoning: row.llm_reasoning ?? null,
      raw_claude_content: row.raw_claude_content ?? null,
      validator_pass: row.validator_pass ?? true,
      validator_block_reason: row.validator_block_reason ?? null,
      fallback_reason: row.fallback_reason ?? null,
      transition_overridden: row.transition_overridden ?? false,
      llm_suggested_state: row.llm_suggested_state ?? null,
      input_tokens: row.input_tokens ?? null,
      output_tokens: row.output_tokens ?? null,
      cache_read_tokens: row.cache_read_tokens ?? null,
    });

    if (error) {
      console.error('[recallReplyAudit] insert failed:', error.message);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recallReplyAudit] unexpected error:', msg);
  }
}

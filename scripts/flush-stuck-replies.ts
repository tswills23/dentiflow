#!/usr/bin/env npx tsx
// Flush Claude replies that passed validator but never went out due to
// TEST_MODE_ALLOWED_PHONE fence being set on Railway during initial launch.
//
// Pulls audit rows where used_llm=true AND validator_pass=true AND there is
// no matching outbound conversations row, then re-sends the reply via the
// production sendSMS path and saves to conversations.

import { resolve } from 'path';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';
import { sendSMS } from '../src/services/execution/smsService';
import { saveMessage } from '../src/services/execution/conversationStore';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');

  // Look back 3 hours to catch all stuck since launch.
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: practice } = await supabase
    .from('practices')
    .select('id, twilio_phone')
    .eq('id', PRACTICE_ID)
    .single();
  if (!practice?.twilio_phone) { console.error('No twilio_phone'); process.exit(1); }

  const { data: audits } = await supabase
    .from('recall_reply_audit')
    .select('id, created_at, patient_id, reply_text, intent, action')
    .eq('practice_id', PRACTICE_ID)
    .eq('used_llm', true)
    .eq('validator_pass', true)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (!audits?.length) { console.log('No audit rows in window.'); process.exit(0); }

  // For each, check whether a matching outbound conversation already exists.
  const stuck: Array<{audit: any, phone: string, firstName: string}> = [];
  for (const a of audits) {
    const start = new Date(new Date(a.created_at).getTime() - 5000).toISOString();
    const end = new Date(new Date(a.created_at).getTime() + 120000).toISOString();
    const { data: msgs } = await supabase
      .from('conversations')
      .select('id, message_body')
      .eq('practice_id', PRACTICE_ID)
      .eq('patient_id', a.patient_id)
      .eq('direction', 'outbound')
      .gte('created_at', start)
      .lte('created_at', end);
    const found = (msgs || []).some(m => m.message_body === a.reply_text);

    // Also skip if ANY outbound message went to this patient AFTER the Claude reply
    // timestamp — means a staffer manually replied, don't double-send.
    const { data: afterMsgs } = await supabase
      .from('conversations')
      .select('id, message_body, created_at')
      .eq('practice_id', PRACTICE_ID)
      .eq('patient_id', a.patient_id)
      .eq('direction', 'outbound')
      .gt('created_at', a.created_at);
    const manuallyReplied = (afterMsgs || []).length > 0;

    if (!found && !manuallyReplied) {
      const { data: p } = await supabase
        .from('patients')
        .select('phone, first_name, recall_opt_out')
        .eq('id', a.patient_id)
        .single();
      if (p?.phone && !p.recall_opt_out) {
        stuck.push({ audit: a, phone: p.phone, firstName: p.first_name || 'there' });
      }
    }
  }

  console.log(`\n=== STUCK REPLIES FOUND: ${stuck.length} ===`);
  for (const s of stuck) {
    console.log(`  ${s.audit.created_at} | ${s.firstName} (${s.phone.substring(0,7)}***) | intent=${s.audit.intent}`);
    console.log(`    reply: ${(s.audit.reply_text || '').substring(0, 140)}`);
  }

  if (stuck.length === 0) { console.log('Nothing to flush.'); process.exit(0); }

  if (!confirm) {
    console.log('\nDry run — re-run with --confirm to send.');
    process.exit(0);
  }

  console.log(`\nFlushing ${stuck.length} replies at 1/sec...`);
  let sent = 0, failed = 0;
  for (const s of stuck) {
    try {
      const result = await sendSMS(s.phone, s.audit.reply_text, practice.twilio_phone as string);
      if (result.success) {
        sent++;
        console.log(`  ✓ ${s.firstName} (${s.phone.substring(0,7)}***) sid=${result.sid}`);
        await saveMessage({
          practiceId: PRACTICE_ID,
          patientId: s.audit.patient_id,
          channel: 'sms',
          direction: 'outbound',
          messageBody: s.audit.reply_text,
          aiGenerated: true,
          automationType: 'recall',
          twilioSid: result.sid,
          metadata: { recovered: true, source_audit_id: s.audit.id, intent: s.audit.intent, action: s.audit.action },
        });
      } else {
        failed++;
        console.error(`  ✗ ${s.phone.substring(0,7)}*** error=${result.error}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${s.phone.substring(0,7)}*** ex=${err?.message}`);
    }
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\nDone. Sent=${sent} Failed=${failed}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

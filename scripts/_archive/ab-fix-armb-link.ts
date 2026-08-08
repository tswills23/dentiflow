#!/usr/bin/env npx tsx
// One-time corrective send for Arm B (offer_only) patients whose Day 0 message
// went out with a broken "undefined/r/<token>" link due to BACKEND_URL not being
// set in the local .env when scripts/ab-launch.ts was run on 2026-05-12.
//
// Sends a short apology + the raw Dentrix booking URL (no tracked redirect, since
// the goal is to give patients a working link immediately).
//
// Targets: recall_sequences where experiment_arm='offer_only' AND last_sent_at IS NOT NULL
// AND template_id='offer_only_day0' AND practice='Village Dental'.
//
// Skips: opted-out patients, patients with no phone.

import { resolve } from 'path';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';
import { sendSMS } from '../src/services/execution/smsService';
import { saveMessage } from '../src/services/execution/conversationStore';
import { logAutomation } from '../src/services/execution/metricsTracker';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const FIX_BODY = `Sorry — link in our last text didn't work. Book your visit here: https://bookit.dentrixascend.com/soe/new/dental?pid=ASC13000000001048&mode=externalLink`;

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');

  console.log('\n========== ARM B BROKEN-LINK FIX ==========');
  console.log(`Practice: ${PRACTICE_ID}`);
  console.log(`Body (${FIX_BODY.length} chars):`);
  console.log(`  "${FIX_BODY}"\n`);

  // Get practice for twilio_phone
  const { data: practice, error: pErr } = await supabase
    .from('practices')
    .select('id, name, twilio_phone')
    .eq('id', PRACTICE_ID)
    .single();
  if (pErr || !practice?.twilio_phone) {
    console.error('Practice or twilio_phone missing'); process.exit(1);
  }

  // Find target sequences (joined to patient phone + opt-out + status)
  const { data: seqs, error: sErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, template_id, last_sent_at, patients!inner(phone, recall_opt_out, first_name, location)')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'offer_only')
    .eq('template_id', 'offer_only_day0')
    .not('last_sent_at', 'is', null);
  if (sErr) { console.error('Query err:', sErr.message); process.exit(1); }

  const eligible = (seqs || []).filter((s: any) => {
    const p = s.patients;
    return p && p.phone && !p.recall_opt_out && p.location === 'Village Dental';
  });

  console.log(`Eligible Arm B sequences (sent + has phone + not opted-out + VD): ${eligible.length}`);

  if (eligible.length === 0) {
    console.log('Nothing to send.');
    process.exit(0);
  }

  if (!confirm) {
    console.log('\nDry run. Re-run with --confirm to send.');
    process.exit(0);
  }

  const expected = `send fix ${eligible.length}`;
  console.log(`\nType exactly: ${expected}`);
  const ans = await prompt('> ');
  if (ans !== expected) {
    console.log('Confirmation phrase did not match. Aborting. Zero sends.');
    process.exit(1);
  }

  console.log(`\nSending fix to ${eligible.length} patients at 1/sec... (~${Math.ceil(eligible.length / 60)} min)\n`);

  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const seq of eligible as any[]) {
    try {
      const phone = seq.patients.phone;
      const result = await sendSMS(phone, FIX_BODY, practice.twilio_phone as string);
      if (result.success) {
        sent++;
        await saveMessage({
          practiceId: PRACTICE_ID,
          patientId: seq.patient_id,
          channel: 'sms',
          direction: 'outbound',
          messageBody: FIX_BODY,
          automationType: 'recall',
          twilioSid: result.sid,
          metadata: { templateId: 'offer_only_day0_fix', sequenceDay: 0, voice: 'offer', fix_for: 'broken_undefined_link' },
        });
        await logAutomation({
          practiceId: PRACTICE_ID,
          patientId: seq.patient_id,
          automationType: 'recall',
          action: 'broken_link_fix',
          result: 'sent',
          messageBody: FIX_BODY,
          metadata: { sequenceId: seq.id, simulated: result.simulated },
        });
      } else {
        failed++;
        errors.push(`${phone}: ${result.error}`);
      }
    } catch (err: any) {
      failed++;
      errors.push(`seq ${seq.id}: ${err?.message || err}`);
    }
    // Hard 1msg/sec rate limit per CLAUDE.md Twilio safety rule
    await new Promise(r => setTimeout(r, 1000));

    if ((sent + failed) % 25 === 0) {
      console.log(`  progress: ${sent + failed}/${eligible.length} (sent=${sent} failed=${failed})`);
    }
  }

  console.log('\n========== FIX SEND COMPLETE ==========');
  console.log(`Sent:    ${sent}`);
  console.log(`Failed:  ${failed}`);
  if (errors.length > 0) {
    console.log('First 10 errors:');
    errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

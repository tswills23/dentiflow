#!/usr/bin/env npx tsx
// Launch script SCOPED TO THE A/B TEST sequences only.
//
// Activates only sequences where experiment_arm IN ('control_voice', 'offer_only'),
// then calls runDay0Outreach which sends Day 0 at 1/sec with location filter.
//
// This exists because scripts/recall-launch.ts picks up all paused + exited-paused
// sequences regardless of experiment_arm — for the A/B test we need strict scoping.

import { resolve } from 'path';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';
import { runDay0Outreach } from '../src/services/recall/outreachEngine';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LOCATION = 'Village Dental';
const EXPERIMENT_ARMS = ['control_voice', 'offer_only'] as const;

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');

  console.log('\n========== A/B LAUNCH (experiment-scoped) ==========');
  console.log(`Practice: ${PRACTICE_ID}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Experiment arms: ${EXPERIMENT_ARMS.join(', ')}\n`);

  // Pull paused sequences for the A/B test only.
  const { data: paused, error: qErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, sequence_status, sequence_day, last_sent_at')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', EXPERIMENT_ARMS as unknown as string[])
    .eq('sequence_status', 'paused')
    .eq('sequence_day', 0)
    .is('last_sent_at', null);
  if (qErr) { console.error('Query error:', qErr.message); process.exit(1); }

  const byArm: Record<string, number> = { control_voice: 0, offer_only: 0 };
  for (const s of paused || []) byArm[s.experiment_arm as string]++;

  console.log(`Eligible paused A/B sequences:`);
  console.log(`  control_voice: ${byArm.control_voice}`);
  console.log(`  offer_only:    ${byArm.offer_only}`);
  console.log(`  TOTAL:         ${(paused || []).length}\n`);

  if ((paused || []).length === 0) {
    console.log('Nothing to send. Exiting.');
    process.exit(0);
  }

  if (!confirm) {
    console.log('Dry run — re-run with --confirm to activate and send.');
    process.exit(0);
  }

  // Hard confirmation phrase.
  const expected = `send ${(paused || []).length}`;
  console.log(`Type exactly: ${expected}`);
  const answer = await prompt('> ');
  if (answer !== expected) {
    console.log('Confirmation phrase did not match. Aborting. Zero changes.');
    process.exit(1);
  }

  // Activate in chunks of 200 to stay under PostgREST URL length cap.
  const ids = (paused || []).map(s => s.id);
  const CHUNK = 200;
  let activated = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error: upErr, count } = await supabase
      .from('recall_sequences')
      .update({ sequence_status: 'active', exit_reason: null, next_send_at: null }, { count: 'exact' })
      .in('id', slice);
    if (upErr) { console.error('Activation error on chunk:', upErr.message); process.exit(1); }
    activated += count || slice.length;
  }
  console.log(`\nActivated ${activated} sequences.`);

  // Sanity: make sure nothing outside the experiment got flipped.
  const { count: rogueActive } = await supabase
    .from('recall_sequences')
    .select('*', { count: 'exact', head: true })
    .eq('practice_id', PRACTICE_ID)
    .eq('sequence_status', 'active')
    .is('experiment_arm', null);
  console.log(`Sanity: active sequences without experiment_arm = ${rogueActive ?? 0} (expected 3 pre-existing)`);

  // Fire Day 0 outreach. runDay0Outreach already:
  //   - filters by patients.location (we pass LOCATION)
  //   - rate-limits to 1 msg/sec (CLAUDE.md Twilio safety rule)
  //   - selects template via experiment_arm branch (outreachEngine.ts:181)
  console.log(`\nSending Day 0 SMS at 1/sec... (~${Math.ceil(activated / 60)} min)\n`);
  const result = await runDay0Outreach(PRACTICE_ID, { location: LOCATION });

  console.log('\n========== SEND COMPLETE ==========');
  console.log(`Sent:    ${result.sent}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed:  ${result.failed}`);
  if (result.errors.length > 0) {
    console.log('First 10 errors:');
    result.errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

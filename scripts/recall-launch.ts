#!/usr/bin/env npx tsx
// Recall Launch CLI
// Two-phase gated launch: segment → approve → load DB → confirm → send
//
// Usage:
//   npx tsx scripts/recall-launch.ts --file patients.csv --location "32 Cottage"
//     → shows count for that location, exits. No DB writes.
//
//   npx tsx scripts/recall-launch.ts --file patients.csv --location "32 Cottage" --confirm
//     → upserts patients, creates paused sequences, then prompts:
//       "N sequences ready. Send SMS now? (y/N)"
//       y → activates sequences, sends at 1 msg/sec
//       N → exits, sequences stay paused

import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { runSegmentAgent } from '../src/services/recall/segmentAgent';
import { runPatientAgent } from '../src/services/recall/patientAgent';
import { runSequenceAgent } from '../src/services/recall/sequenceAgent';
import { runDay0Outreach } from '../src/services/recall/outreachEngine';
import { supabase } from '../src/lib/supabase';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const DEFAULT_PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

interface Args {
  file: string;
  location: string;
  confirm: boolean;
  practiceId: string;
  dbOnly: boolean;
  limit: number | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    file: '',
    location: '',
    confirm: false,
    practiceId: DEFAULT_PRACTICE_ID,
    dbOnly: false,
    limit: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file': result.file = args[++i] || ''; break;
      case '--location': result.location = args[++i] || ''; break;
      case '--confirm': result.confirm = true; break;
      case '--practice-id': result.practiceId = args[++i] || ''; break;
      case '--db-only': result.dbOnly = true; break;
      case '--limit': {
        const n = parseInt(args[++i] || '', 10);
        result.limit = isNaN(n) ? null : n;
        break;
      }
    }
  }

  if (!result.dbOnly && !result.file) {
    console.error('Usage: npx tsx scripts/recall-launch.ts --file <csv> --location <name> [--confirm] [--limit N]');
    console.error('       npx tsx scripts/recall-launch.ts --db-only --location <name> [--confirm] [--limit N]');
    process.exit(1);
  }
  if (!result.location) {
    console.error('--location is required. Example: --location "Village Dental"');
    console.error('This ensures you review one location at a time before sending.');
    process.exit(1);
  }

  return result;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function launchFromDB(args: Args): Promise<void> {
  console.log('\n========== RECALL LAUNCH (DB MODE) ==========');
  console.log(`Location: ${args.location}`);
  console.log(`Limit:    ${args.limit ?? 'none (all eligible)'}`);

  // Eligible = sequences never sent. Use patients!inner join to filter by location
  // without passing a large IN list (PostgREST rejects URLs exceeding ~8KB).
  // Two sets: genuinely paused + April-8-incident exited with exit_reason='paused'.
  const [{ data: paused, error: e1 }, { data: exitedUnset, error: e2 }] = await Promise.all([
    supabase
      .from('recall_sequences')
      .select('id, patient_id, sequence_status, created_at, patients!inner(location)')
      .eq('practice_id', args.practiceId)
      .eq('sequence_day', 0)
      .eq('sequence_status', 'paused')
      .is('last_sent_at', null)
      .ilike('patients.location', `%${args.location}%`)
      .order('created_at', { ascending: true }),
    supabase
      .from('recall_sequences')
      .select('id, patient_id, sequence_status, created_at, patients!inner(location)')
      .eq('practice_id', args.practiceId)
      .eq('sequence_day', 0)
      .eq('sequence_status', 'exited')
      .eq('exit_reason', 'paused')
      .is('last_sent_at', null)
      .ilike('patients.location', `%${args.location}%`)
      .order('created_at', { ascending: true }),
  ]);

  if (e1 || e2) {
    console.error('DB query error:', (e1 || e2)!.message);
    process.exit(1);
  }

  if (!paused?.length && !exitedUnset?.length) {
    console.log(`\nNo patients found for location "${args.location}".`);
    process.exit(0);
  }

  // Merge and sort oldest-first so --limit batches are deterministic
  const eligible = [...(paused || []), ...(exitedUnset || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const total = eligible?.length ?? 0;
  const batch = args.limit ? (eligible || []).slice(0, args.limit) : (eligible || []);

  console.log(`\nEligible (never sent): ${total}`);
  console.log(`This batch:            ${batch.length}`);

  if (batch.length === 0) {
    console.log('\nNo eligible sequences to send. All may have already been sent or none exist.');
    process.exit(0);
  }

  if (!args.confirm) {
    console.log('\nDry run — no changes made.');
    const limitFlag = args.limit ? ` --limit ${args.limit}` : '';
    console.log(`\nTo send this batch, run with --confirm:`);
    console.log(`  npx tsx scripts/recall-launch.ts --db-only --location "${args.location}"${limitFlag} --confirm`);
    process.exit(0);
  }

  // Reset batch sequences to proper paused state (cleans up exited/paused data anomaly),
  // then immediately activate them so runDay0Outreach picks them up.
  const batchIds = batch.map((s: any) => s.id);

  const { error: resetErr } = await supabase
    .from('recall_sequences')
    .update({
      sequence_status: 'active',
      exit_reason: null,
      next_send_at: null,
    })
    .in('id', batchIds);

  if (resetErr) {
    console.error('Failed to activate sequences:', resetErr.message);
    process.exit(1);
  }

  console.log(`\nActivated ${batchIds.length} sequences.`);
  console.log(`Sending... (1/sec, ~${Math.ceil(batchIds.length / 60)} minutes)\n`);

  const outreach = await runDay0Outreach(args.practiceId, { location: args.location });

  console.log('\n========== SEND COMPLETE ==========');
  console.log(`Sent:    ${outreach.sent}`);
  console.log(`Skipped: ${outreach.skipped}`);
  console.log(`Failed:  ${outreach.failed}`);
  if (outreach.errors.length > 0) {
    console.log('Errors:');
    outreach.errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }
}

async function launchFromCSV(args: Args): Promise<void> {
  // Step 1: Read and segment CSV
  const csvPath = resolve(args.file);
  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf-8');
  } catch {
    console.error(`Cannot read file: ${csvPath}`);
    process.exit(1);
  }

  const segResult = runSegmentAgent(csvText);

  // Filter to requested location
  const filtered = segResult.records.filter(r =>
    (r.location || '').toLowerCase().includes(args.location.toLowerCase())
  );

  console.log('\n========== RECALL LAUNCH ==========');
  console.log(`File:     ${csvPath}`);
  console.log(`Location: ${args.location}`);
  console.log(`Eligible: ${filtered.length} patients`);

  if (filtered.length === 0) {
    console.log(`\nNo eligible patients found for location "${args.location}".`);
    console.log('Available locations:');
    for (const [loc, count] of Object.entries(segResult.byLocation).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${loc}: ${count}`);
    }
    process.exit(0);
  }

  // Show voice breakdown for this location
  const voiceCounts: Record<string, number> = {};
  for (const r of filtered) {
    voiceCounts[r.voice] = (voiceCounts[r.voice] || 0) + 1;
  }
  console.log('\nVoice tiers:');
  for (const [v, count] of Object.entries(voiceCounts)) {
    console.log(`  ${v}: ${count}`);
  }

  if (!args.confirm) {
    console.log('\nDry run complete. No database writes.');
    console.log(`\nTo load patients and create sequences, run with --confirm:`);
    console.log(`  npx tsx scripts/recall-launch.ts --file "${args.file}" --location "${args.location}" --confirm`);
    process.exit(0);
  }

  // Step 2: Upsert patients
  console.log('\n--- Step 1/3: Upserting patients ---');
  const patientResult = await runPatientAgent(args.practiceId, filtered);
  console.log(`  Upserted: ${patientResult.upserted} | Skipped: ${patientResult.skipped} | Errors: ${patientResult.errors.length}`);
  if (patientResult.errors.length > 0) {
    patientResult.errors.slice(0, 5).forEach(e => console.log(`  ERROR: ${e}`));
  }

  if (patientResult.patientIds.length === 0) {
    console.log('\nNo patients to process. Exiting.');
    process.exit(0);
  }

  // Step 3: Create paused sequences
  console.log('\n--- Step 2/3: Creating sequences (paused) ---');
  const seqResult = await runSequenceAgent(args.practiceId, patientResult.patientIds);
  console.log(`  Created: ${seqResult.created} | Skipped (already exists): ${seqResult.skipped} | Errors: ${seqResult.errors.length}`);
  if (seqResult.errors.length > 0) {
    seqResult.errors.slice(0, 5).forEach(e => console.log(`  ERROR: ${e}`));
  }

  if (seqResult.created === 0) {
    console.log('\nNo new sequences created (all patients already have sequences). Exiting.');
    process.exit(0);
  }

  // Step 4: Interactive send confirmation
  console.log(`\n--- Step 3/3: Ready to send ---`);
  console.log(`${seqResult.created} sequences are queued and paused.`);
  console.log(`Send will go at 1 message/second (~${Math.ceil(seqResult.created / 60)} minutes total).`);

  const answer = await prompt(`\nSend ${seqResult.created} SMS to "${args.location}" patients now? (y/N): `);

  if (answer.toLowerCase() !== 'y') {
    console.log('\nLaunch cancelled. Sequences remain paused — run again and type y when ready.');
    process.exit(0);
  }

  // Activate sequences for this location (limited if --limit set)
  console.log('\nActivating sequences...');
  const { data: locationPatients } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', args.practiceId)
    .ilike('location', `%${args.location}%`);

  const locationPatientIds = (locationPatients || []).map((p: any) => p.id);

  let activateQuery = supabase
    .from('recall_sequences')
    .select('id, created_at')
    .eq('practice_id', args.practiceId)
    .eq('sequence_status', 'paused')
    .eq('sequence_day', 0)
    .is('last_sent_at', null)
    .in('patient_id', locationPatientIds)
    .order('created_at', { ascending: true });

  if (args.limit) {
    activateQuery = activateQuery.limit(args.limit);
  }

  const { data: toActivate } = await activateQuery;
  const batchIds = (toActivate || []).map((s: any) => s.id);

  await supabase
    .from('recall_sequences')
    .update({ sequence_status: 'active' })
    .in('id', batchIds);

  // Send at 1/sec (rate limit enforced inside runDay0Outreach)
  console.log(`Sending... (1/sec, will take ~${Math.ceil(batchIds.length / 60)} minutes)\n`);
  const outreach = await runDay0Outreach(args.practiceId, { location: args.location });

  console.log('\n========== SEND COMPLETE ==========');
  console.log(`Sent:    ${outreach.sent}`);
  console.log(`Skipped: ${outreach.skipped}`);
  console.log(`Failed:  ${outreach.failed}`);
  if (outreach.errors.length > 0) {
    console.log('Errors:');
    outreach.errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }
}

async function main() {
  const args = parseArgs();

  if (args.dbOnly) {
    await launchFromDB(args);
  } else {
    await launchFromCSV(args);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

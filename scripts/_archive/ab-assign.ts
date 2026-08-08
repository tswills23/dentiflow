#!/usr/bin/env npx tsx
// A/B test assignment script for the 2026-05-11 Village Dental recall launch.
//
// Selects 500 fresh patients (no prior recall sequence) at Village Dental,
// stratifies by overdue tier (lt_6 / gte_6_lt_12 / gte_12), assigns half to
// Arm A (control_voice) and half to Arm B (offer_only), and creates paused
// recall_sequences rows.
//
// Usage:
//   npx tsx scripts/ab-assign.ts --dry-run
//     → preview only, zero DB writes
//
//   npx tsx scripts/ab-assign.ts --confirm
//     → prompts for "yes assign N patients" then creates paused sequences
//
// Sequences are created PAUSED. Activate via:
//   npx tsx scripts/recall-launch.ts --db-only --location "Village Dental" --confirm

import { resolve } from 'path';
import { createHash } from 'crypto';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';
import { runSequenceAgent } from '../src/services/recall/sequenceAgent';
import type { ExperimentArm } from '../src/types/recall';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const DEFAULT_PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LOCATION = 'Village Dental';
const TARGET_TOTAL = 400; // Fresh VD patients with no prior sequence (verified 2026-05-12)
const ASSIGN_SEED = '2026-05-11-village-recall-ab'; // deterministic shuffle seed

interface Args {
  dryRun: boolean;
  confirm: boolean;
  practiceId: string;
  total: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    dryRun: false,
    confirm: false,
    practiceId: DEFAULT_PRACTICE_ID,
    total: TARGET_TOTAL,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': result.dryRun = true; break;
      case '--confirm': result.confirm = true; break;
      case '--practice-id': result.practiceId = args[++i] || ''; break;
      case '--total': {
        const n = parseInt(args[++i] || '', 10);
        if (!isNaN(n)) result.total = n;
        break;
      }
    }
  }
  if (!result.dryRun && !result.confirm) {
    console.error('Specify either --dry-run (preview) or --confirm (write paused sequences)');
    process.exit(1);
  }
  return result;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(question, a => { rl.close(); res(a.trim()); }));
}

// Deterministic shuffle: hash(seed + id) → sort key.
// Same seed + same patient list always produces same order.
function seededShuffle<T extends { id: string }>(items: T[], seed: string): T[] {
  return [...items]
    .map(item => ({
      item,
      key: createHash('md5').update(seed + item.id).digest('hex'),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ item }) => item);
}

interface EligiblePatient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  recall_segment: 'lt_6' | 'gte_6_lt_12' | 'gte_12' | null;
  last_visit_date: string | null;
}

async function fetchEligible(practiceId: string): Promise<EligiblePatient[]> {
  // Village Dental patients eligible for recall who don't already have a
  // sequence in any state. We pull all sequences once and exclude those patient_ids.
  const { data: seqRows, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('patient_id')
    .eq('practice_id', practiceId);
  if (seqErr) throw new Error(`Failed to fetch existing sequences: ${seqErr.message}`);
  const excluded = new Set((seqRows || []).map(r => r.patient_id));

  // Fetch eligible patients in pages (PostgREST 1000-row default cap).
  const eligible: EligiblePatient[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, recall_segment, last_visit_date, location, recall_eligible, recall_opt_out')
      .eq('practice_id', practiceId)
      .eq('location', LOCATION)
      .eq('recall_eligible', true)
      .eq('recall_opt_out', false)
      .not('phone', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch patients: ${error.message}`);
    if (!data?.length) break;
    for (const p of data) {
      if (!excluded.has(p.id)) {
        eligible.push({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          recall_segment: (p.recall_segment as EligiblePatient['recall_segment']) ?? null,
          last_visit_date: p.last_visit_date,
        });
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return eligible;
}

interface Assignment {
  control: EligiblePatient[];
  offer: EligiblePatient[];
}

function stratifiedAssign(eligible: EligiblePatient[], total: number): Assignment {
  // Bucket by recall_segment. Patients with null segment go in their own bucket
  // and are split last (shouldn't normally happen for Village Dental).
  const buckets: Record<string, EligiblePatient[]> = {
    lt_6: [],
    gte_6_lt_12: [],
    gte_12: [],
    unknown: [],
  };
  for (const p of eligible) {
    const key = p.recall_segment || 'unknown';
    buckets[key].push(p);
  }

  // Shuffle each bucket deterministically.
  for (const k of Object.keys(buckets)) {
    buckets[k] = seededShuffle(buckets[k], ASSIGN_SEED + ':' + k);
  }

  // Compute per-bucket take, proportional to bucket size, capped at total.
  const totalAvailable = eligible.length;
  const result: Assignment = { control: [], offer: [] };
  if (totalAvailable === 0) return result;

  const targetPerBucket: Record<string, number> = {};
  let allocated = 0;
  const bucketKeys = ['lt_6', 'gte_6_lt_12', 'gte_12', 'unknown'];
  for (const k of bucketKeys) {
    const share = Math.min(
      buckets[k].length,
      Math.round((buckets[k].length / totalAvailable) * total)
    );
    targetPerBucket[k] = share;
    allocated += share;
  }
  // Adjust rounding drift to hit exactly `total`.
  let diff = total - allocated;
  for (const k of bucketKeys) {
    if (diff === 0) break;
    if (diff > 0 && buckets[k].length > targetPerBucket[k]) {
      const add = Math.min(diff, buckets[k].length - targetPerBucket[k]);
      targetPerBucket[k] += add;
      diff -= add;
    } else if (diff < 0 && targetPerBucket[k] > 0) {
      const sub = Math.min(-diff, targetPerBucket[k]);
      targetPerBucket[k] -= sub;
      diff += sub;
    }
  }

  // Within each bucket, alternate control/offer to keep arms balanced per tier.
  for (const k of bucketKeys) {
    const take = buckets[k].slice(0, targetPerBucket[k]);
    take.forEach((p, i) => {
      if (i % 2 === 0) result.control.push(p);
      else result.offer.push(p);
    });
  }
  return result;
}

function summarize(label: string, patients: EligiblePatient[]): void {
  const bySegment: Record<string, number> = { lt_6: 0, gte_6_lt_12: 0, gte_12: 0, unknown: 0 };
  for (const p of patients) bySegment[p.recall_segment || 'unknown']++;
  console.log(`  ${label}: ${patients.length} total`);
  console.log(`    lt_6 (<6mo): ${bySegment.lt_6}`);
  console.log(`    gte_6_lt_12 (6-12mo): ${bySegment.gte_6_lt_12}`);
  console.log(`    gte_12 (12mo+): ${bySegment.gte_12}`);
  if (bySegment.unknown > 0) console.log(`    unknown segment: ${bySegment.unknown}`);
  console.log(`    sample: ${patients.slice(0, 5).map(p => `${p.first_name || '?'} ${p.last_name || ''}`.trim()).join(', ')}`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('\n========== RECALL A/B ASSIGNMENT ==========');
  console.log(`Practice: ${args.practiceId}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Target total: ${args.total} (${args.total / 2} per arm)`);
  console.log(`Mode: ${args.dryRun ? 'DRY RUN (no writes)' : 'WRITE (paused sequences)'}`);
  console.log(`Seed: ${ASSIGN_SEED}\n`);

  console.log('Fetching eligible patients...');
  const eligible = await fetchEligible(args.practiceId);
  console.log(`Eligible patients (no prior sequence): ${eligible.length}\n`);

  if (eligible.length < args.total) {
    console.error(`Only ${eligible.length} eligible patients available, need ${args.total}. Aborting.`);
    process.exit(1);
  }

  const assignment = stratifiedAssign(eligible, args.total);

  console.log('Stratified assignment preview:');
  summarize('Arm A (control_voice)', assignment.control);
  summarize('Arm B (offer_only)', assignment.offer);

  const totalAssigned = assignment.control.length + assignment.offer.length;
  console.log(`\nTotal to be tagged: ${totalAssigned}`);

  if (args.dryRun) {
    console.log('\nDRY RUN — no DB writes. Re-run with --confirm to create paused sequences.');
    return;
  }

  // Hard confirmation per CLAUDE.md HIGHEST PRIORITY rule.
  const expected = `yes assign ${totalAssigned} patients`;
  console.log(`\nType exactly: ${expected}`);
  const answer = await prompt('> ');
  if (answer !== expected) {
    console.log('Confirmation phrase did not match. Aborting. Zero writes.');
    process.exit(1);
  }

  // Build patientId → arm map and call sequenceAgent in two passes
  // (one per arm) so we don't need a heterogeneous map at the call site.
  const armMap: Record<string, ExperimentArm> = {};
  for (const p of assignment.control) armMap[p.id] = 'control_voice';
  for (const p of assignment.offer) armMap[p.id] = 'offer_only';

  const allIds = [...assignment.control.map(p => p.id), ...assignment.offer.map(p => p.id)];
  console.log(`\nCreating paused sequences for ${allIds.length} patients...`);
  const result = await runSequenceAgent(args.practiceId, allIds, { experimentArmByPatient: armMap });

  console.log(`\nResult: created=${result.created}, skipped=${result.skipped}, errors=${result.errors.length}`);
  if (result.errors.length > 0) {
    console.log('First 5 errors:');
    result.errors.slice(0, 5).forEach(e => console.log(`  ${e}`));
  }

  // Verify in DB.
  const { data: verify } = await supabase
    .from('recall_sequences')
    .select('experiment_arm', { count: 'exact' })
    .eq('practice_id', args.practiceId)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  const counts: Record<string, number> = { control_voice: 0, offer_only: 0 };
  for (const r of verify || []) counts[r.experiment_arm as string]++;
  console.log(`\nDB verify — control_voice: ${counts.control_voice}, offer_only: ${counts.offer_only}`);

  console.log('\nDone. Sequences are PAUSED. Next step:');
  console.log(`  npx tsx scripts/recall-launch.ts --db-only --location "${LOCATION}" --confirm`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

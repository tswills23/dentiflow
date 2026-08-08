#!/usr/bin/env npx tsx
// Village Dental round-2 data prep (2026-06-03)
// Stages two changes; DRY RUN by default, pass --confirm to write.
//
//   1. Flip recall_eligible=true on the 501 shelved patients
//      (exited/exit_reason='paused', Day 0, never sent).
//   2. Exclude the 3 already-active Day-0 never-sent sequences
//      (2 offer_only + 1 control_voice) by setting them to
//      exited/exit_reason='round2_excluded' so neither the launcher
//      nor runDay0Outreach picks them up. Net send cohort = 501.
//
// After this, launch with:
//   npx tsx scripts/recall-launch.ts --db-only --location "Village Dental" --confirm
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LOCATION = 'Village Dental';
const CONFIRM = process.argv.includes('--confirm');

(async () => {
  // Village patient ids
  const { data: pts, error: pErr } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', PID)
    .eq('location', LOCATION);
  if (pErr) { console.error('patients query failed:', pErr.message); process.exit(1); }
  const ids = (pts || []).map(p => p.id);

  // Day-0 never-sent sequences for these patients
  let seqs: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('recall_sequences')
      .select('id, patient_id, sequence_status, exit_reason, experiment_arm')
      .eq('practice_id', PID)
      .eq('sequence_day', 0)
      .is('last_sent_at', null)
      .in('patient_id', ids.slice(i, i + 200));
    if (error) { console.error('seq query failed:', error.message); process.exit(1); }
    seqs = seqs.concat(data || []);
  }

  const shelved = seqs.filter(s => s.sequence_status === 'exited' && s.exit_reason === 'paused');
  const active = seqs.filter(s => s.sequence_status === 'active');
  const shelvedPatientIds = shelved.map(s => s.patient_id);
  const activeSeqIds = active.map(s => s.id);

  console.log('\n========== VILLAGE ROUND-2 PREP ==========');
  console.log(`Mode: ${CONFIRM ? 'CONFIRM (will write)' : 'DRY RUN (no writes)'}`);
  console.log(`\nShelved to send (exited/paused, Day0, never sent): ${shelved.length}`);
  console.log(`  → will set recall_eligible=true on these ${shelvedPatientIds.length} patients`);
  console.log(`\nAlready-active to EXCLUDE: ${active.length}`);
  active.forEach(s => console.log(`  → seq ${s.id}  arm=${s.experiment_arm || 'null'}  (will set exited/round2_excluded)`));
  console.log(`\nNet send cohort after prep: ${shelved.length}`);

  if (!CONFIRM) {
    console.log('\nDry run — no changes made. Re-run with --confirm to apply.');
    return;
  }

  // 1. Flip recall_eligible on shelved patients (chunked)
  let eligUpdated = 0;
  for (let i = 0; i < shelvedPatientIds.length; i += 200) {
    const chunk = shelvedPatientIds.slice(i, i + 200);
    const { error } = await supabase
      .from('patients')
      .update({ recall_eligible: true })
      .in('id', chunk);
    if (error) { console.error('recall_eligible update failed:', error.message); process.exit(1); }
    eligUpdated += chunk.length;
  }
  console.log(`\nrecall_eligible=true set on ${eligUpdated} patients.`);

  // 2. Exclude the already-active sequences
  if (activeSeqIds.length) {
    const { error } = await supabase
      .from('recall_sequences')
      .update({ sequence_status: 'exited', exit_reason: 'round2_excluded', next_send_at: null })
      .in('id', activeSeqIds);
    if (error) { console.error('exclude update failed:', error.message); process.exit(1); }
    console.log(`Excluded ${activeSeqIds.length} already-active sequences.`);
  }

  console.log('\nPrep complete. Next: recall-launch --db-only --location "Village Dental" --confirm');
})();

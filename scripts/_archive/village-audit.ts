import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  // 1. All distinct location values + counts
  const { data: allP } = await supabase
    .from('patients')
    .select('id, location, recall_eligible, recall_opt_out')
    .eq('practice_id', PRACTICE_ID);
  console.log(`Total patients in practice: ${allP?.length || 0}`);

  const byLoc: Record<string, number> = {};
  for (const p of allP || []) {
    const k = p.location ?? '(null)';
    byLoc[k] = (byLoc[k] || 0) + 1;
  }
  console.log('\nAll location values (patients table):');
  for (const [k, v] of Object.entries(byLoc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(5)}  "${k}"`);
  }

  // 2. Case-insensitive match — any patient with "village" anywhere in location
  const villageLike = (allP || []).filter(p =>
    p.location && p.location.toLowerCase().includes('village')
  );
  console.log(`\nPatients matching ilike '%village%': ${villageLike.length}`);

  // 3. Compare to sequences — sequences are scoped via patient join, so
  //    look at recall_sequences and see how many distinct patients in this practice ever had one
  const { data: allSeqs } = await supabase
    .from('recall_sequences')
    .select('patient_id, segment_overdue, experiment_arm, sequence_status, created_at')
    .eq('practice_id', PRACTICE_ID);
  console.log(`\nTotal recall_sequences rows in practice: ${allSeqs?.length || 0}`);
  const seqPatients = new Set((allSeqs || []).map(s => s.patient_id));
  console.log(`Distinct patient_ids ever in a recall_sequence: ${seqPatients.size}`);

  // Cross-reference: of patients in sequences, what locations?
  const seqLocCounts: Record<string, number> = {};
  const patientLocById = new Map<string, string | null>();
  for (const p of allP || []) patientLocById.set(p.id, p.location);
  for (const pid of seqPatients) {
    const loc = patientLocById.get(pid) ?? '(not-in-patients-table)';
    seqLocCounts[loc] = (seqLocCounts[loc] || 0) + 1;
  }
  console.log('\nDistinct sequence patients by location:');
  for (const [k, v] of Object.entries(seqLocCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(5)}  "${k}"`);
  }

  // 4. How many patients sent at least 1 outbound, by location?
  const { data: convs } = await supabase
    .from('conversations')
    .select('patient_id')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'outbound');
  const touched = new Set((convs || []).map(c => c.patient_id));
  const touchedByLoc: Record<string, number> = {};
  for (const pid of touched) {
    const loc = patientLocById.get(pid as string) ?? '(not-in-patients-table)';
    touchedByLoc[loc] = (touchedByLoc[loc] || 0) + 1;
  }
  console.log('\nDistinct outbound-touched patients by location:');
  for (const [k, v] of Object.entries(touchedByLoc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(5)}  "${k}"`);
  }
})();

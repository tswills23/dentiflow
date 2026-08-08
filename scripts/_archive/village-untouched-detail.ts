import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  // 1. Village patients — pull more fields
  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', PRACTICE_ID)
    .eq('location', 'Village Dental');
  const allIds = (patients || []).map((p: any) => p.id);

  if (patients && patients[0]) {
    console.log('patients columns:', Object.keys(patients[0]).join(', '));
  }

  // 2. Outbound-touched set
  const touched = new Set<string>();
  for (let i = 0; i < allIds.length; i += 200) {
    const chunk = allIds.slice(i, i + 200);
    const { data: msgs } = await supabase
      .from('conversations')
      .select('patient_id')
      .eq('practice_id', PRACTICE_ID)
      .eq('direction', 'outbound')
      .in('patient_id', chunk);
    for (const m of msgs || []) if (m.patient_id) touched.add(m.patient_id);
  }

  // 3. Sequences
  const seqByPatient = new Map<string, any>();
  for (let i = 0; i < allIds.length; i += 200) {
    const chunk = allIds.slice(i, i + 200);
    const { data: seqs } = await supabase
      .from('recall_sequences')
      .select('*')
      .eq('practice_id', PRACTICE_ID)
      .in('patient_id', chunk);
    for (const s of seqs || []) seqByPatient.set(s.patient_id, s);
  }

  // 4. Untouched
  const untouched = (patients || []).filter((p: any) => !touched.has(p.id));
  console.log(`\nUntouched at Village Dental: ${untouched.length}`);

  // Group by recall_eligible / recall_opt_out / sequence_status
  const buckets: Record<string, number> = {};
  const eligByOverdue: Record<string, number> = {};
  for (const p of untouched as any[]) {
    const seq = seqByPatient.get(p.id);
    const key = `eligible=${p.recall_eligible}|opt_out=${p.recall_opt_out}|seq_status=${seq?.sequence_status ?? 'none'}|arm=${seq?.experiment_arm ?? 'none'}`;
    buckets[key] = (buckets[key] || 0) + 1;
    if (p.recall_eligible && !p.recall_opt_out) {
      const seg = seq?.segment_overdue ?? 'unknown';
      eligByOverdue[seg] = (eligByOverdue[seg] || 0) + 1;
    }
  }
  console.log('\nBuckets (untouched only):');
  for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }

  // Reasons for ineligible — check months_overdue distribution
  const moDist: Record<string, number> = {};
  for (const p of untouched as any[]) {
    const seq = seqByPatient.get(p.id);
    const mo = seq?.months_overdue;
    const bucket = mo == null ? 'null' : mo < 6 ? '<6' : mo < 12 ? '6-12' : mo < 18 ? '12-18' : mo < 24 ? '18-24' : '24+';
    moDist[bucket] = (moDist[bucket] || 0) + 1;
  }
  console.log('\nUntouched — months_overdue distribution:');
  for (const [k, v] of Object.entries(moDist)) console.log(`  ${k.padStart(6)}: ${v}`);

  // Untouched who are NOT opted out (the realistic ceiling for next round)
  const untouchedNotOptedOut = untouched.filter((p: any) => !p.recall_opt_out);
  console.log(`\nUntouched & not opted out (true ceiling for next round): ${untouchedNotOptedOut.length}`);
})();

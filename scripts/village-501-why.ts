import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  // All Village patients
  const { data: patients } = await supabase
    .from('patients')
    .select('id, created_at, recall_eligible, recall_opt_out, location, last_visit_date')
    .eq('practice_id', PRACTICE_ID)
    .eq('location', 'Village Dental');
  const ids = (patients || []).map(p => p.id);

  // Sequences
  const seqs: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('recall_sequences')
      .select('*')
      .eq('practice_id', PRACTICE_ID)
      .in('patient_id', ids.slice(i, i + 200));
    seqs.push(...(data || []));
  }

  // Outbound-touched
  const touched = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('conversations')
      .select('patient_id')
      .eq('practice_id', PRACTICE_ID)
      .eq('direction', 'outbound')
      .in('patient_id', ids.slice(i, i + 200));
    for (const c of data || []) if (c.patient_id) touched.add(c.patient_id);
  }

  const seqByPatient = new Map<string, any>();
  for (const s of seqs) seqByPatient.set(s.patient_id, s);

  const untouched = (patients || []).filter(p => !touched.has(p.id));
  const exitedBucket = untouched.filter(p => {
    const s = seqByPatient.get(p.id);
    return s && s.sequence_status === 'exited';
  });

  console.log(`Untouched + sequence=exited: ${exitedBucket.length}`);

  // Exit reasons
  const exitReasons: Record<string, number> = {};
  const armCounts: Record<string, number> = {};
  const segCounts: Record<string, number> = {};
  const monthBuckets: Record<string, number> = {};
  const createdMonth: Record<string, number> = {};
  for (const p of exitedBucket) {
    const s = seqByPatient.get(p.id);
    exitReasons[s.exit_reason ?? '(null)'] = (exitReasons[s.exit_reason ?? '(null)'] || 0) + 1;
    armCounts[s.experiment_arm ?? '(null)'] = (armCounts[s.experiment_arm ?? '(null)'] || 0) + 1;
    segCounts[s.segment_overdue ?? '(null)'] = (segCounts[s.segment_overdue ?? '(null)'] || 0) + 1;
    const mo = s.months_overdue;
    const mb = mo == null ? 'null' : mo < 6 ? '<6' : mo < 12 ? '6-12' : mo < 18 ? '12-18' : mo < 24 ? '18-24' : '24+';
    monthBuckets[mb] = (monthBuckets[mb] || 0) + 1;
    const cm = (s.created_at || '').slice(0, 7);
    createdMonth[cm] = (createdMonth[cm] || 0) + 1;
  }

  console.log('\nexit_reason:'); for (const [k,v] of Object.entries(exitReasons).sort((a,b)=>b[1]-a[1])) console.log(`  ${v.toString().padStart(4)}  ${k}`);
  console.log('\nexperiment_arm:'); for (const [k,v] of Object.entries(armCounts).sort((a,b)=>b[1]-a[1])) console.log(`  ${v.toString().padStart(4)}  ${k}`);
  console.log('\nsegment_overdue:'); for (const [k,v] of Object.entries(segCounts).sort((a,b)=>b[1]-a[1])) console.log(`  ${v.toString().padStart(4)}  ${k}`);
  console.log('\nmonths_overdue distribution:'); for (const [k,v] of Object.entries(monthBuckets)) console.log(`  ${k.padStart(6)}: ${v}`);
  console.log('\nsequence created_at by month:'); for (const [k,v] of Object.entries(createdMonth).sort()) console.log(`  ${k}: ${v}`);

  // Sample 5 rows
  console.log('\nSample sequence rows:');
  for (const p of exitedBucket.slice(0, 5)) {
    const s = seqByPatient.get(p.id);
    console.log({
      patient_id: p.id, created_at: s.created_at, exit_reason: s.exit_reason,
      sequence_status: s.sequence_status, experiment_arm: s.experiment_arm,
      segment_overdue: s.segment_overdue, months_overdue: s.months_overdue,
      assigned_voice: s.assigned_voice, booking_stage: s.booking_stage,
      next_send_at: s.next_send_at, last_sent_at: s.last_sent_at,
      patient_recall_eligible: p.recall_eligible,
    });
  }
})();

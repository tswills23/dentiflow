import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  // 1. All Village Dental patients
  const { data: patients, error: pErr } = await supabase
    .from('patients')
    .select('id, first_name, last_name, phone, location, recall_eligible, recall_opt_out')
    .eq('practice_id', PRACTICE_ID)
    .eq('location', 'Village Dental');
  if (pErr) { console.error('patients query failed:', pErr); process.exit(1); }
  const allIds = (patients || []).map(p => p.id);
  console.log(`Total Village Dental patients in DB: ${patients?.length || 0}`);

  // 2. Patients with any OUTBOUND conversation (real SMS sent)
  const withOutbound = new Set<string>();
  for (let i = 0; i < allIds.length; i += 200) {
    const chunk = allIds.slice(i, i + 200);
    const { data: msgs, error: mErr } = await supabase
      .from('conversations')
      .select('patient_id')
      .eq('practice_id', PRACTICE_ID)
      .eq('direction', 'outbound')
      .in('patient_id', chunk);
    if (mErr) { console.error('conversations query failed:', mErr); process.exit(1); }
    for (const m of msgs || []) if (m.patient_id) withOutbound.add(m.patient_id);
  }

  // 3. Patients with any recall_sequence row (paused or otherwise)
  const withSeq = new Set<string>();
  const seqStatusByPatient = new Map<string, string[]>();
  for (let i = 0; i < allIds.length; i += 200) {
    const chunk = allIds.slice(i, i + 200);
    const { data: seqs, error: sErr } = await supabase
      .from('recall_sequences')
      .select('*')
      .eq('practice_id', PRACTICE_ID)
      .in('patient_id', chunk);
    if (sErr) { console.error('seq query failed:', sErr); process.exit(1); }
    for (const s of seqs || []) {
      if (!s.patient_id) continue;
      if (i === 0 && Array.from(withSeq).length === 0) {
        console.log('recall_sequences columns:', Object.keys(s).join(', '));
      }
      withSeq.add(s.patient_id);
      const arr = seqStatusByPatient.get(s.patient_id) || [];
      arr.push(`${s.sequence_status}`);
      seqStatusByPatient.set(s.patient_id, arr);
    }
  }

  // 4. "Untouched" = no outbound SMS ever
  const untouched = (patients || []).filter(p => !withOutbound.has(p.id));
  const untouchedNoSeq = untouched.filter(p => !withSeq.has(p.id));
  const untouchedPausedSeq = untouched.filter(p => withSeq.has(p.id));
  const untouchedEligible = untouched.filter(p => p.recall_eligible && !p.recall_opt_out);
  const untouchedOptOut = untouched.filter(p => p.recall_opt_out);

  console.log('\n========== VILLAGE DENTAL — UNTOUCHED ==========');
  console.log(`Total Village patients in DB:                     ${patients?.length || 0}`);
  console.log(`  Received at least one outbound SMS (touched):   ${withOutbound.size}`);
  console.log(`  Never received any outbound SMS (untouched):    ${untouched.length}`);
  console.log('');
  console.log('Breakdown of untouched:');
  console.log(`  No recall_sequence row at all:                  ${untouchedNoSeq.length}`);
  console.log(`  Has a recall_sequence but never sent:           ${untouchedPausedSeq.length}`);
  console.log(`  recall_eligible=true & not opted out:           ${untouchedEligible.length}  <-- sendable for next round`);
  console.log(`  recall_opt_out=true (cannot contact):           ${untouchedOptOut.length}`);

  // Sample a few untouched-eligible
  console.log('\nSample untouched + eligible (first 10):');
  for (const p of untouchedEligible.slice(0, 10)) {
    const tags = seqStatusByPatient.get(p.id) || ['no-seq'];
    console.log(`  ${p.first_name} ${p.last_name}  ${p.phone}  [${tags.join(',')}]`);
  }
})();

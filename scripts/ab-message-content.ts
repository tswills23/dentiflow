import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  // Inspect the actual appointments table
  const { data: aptSample } = await supabase.from('appointments').select('*').limit(1);
  console.log('appointments columns:', aptSample && aptSample[0] ? Object.keys(aptSample[0]).join(', ') : 'NO ROWS');

  const { count: totalApts } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('practice_id', PRACTICE_ID);
  console.log('Total appointments for practice:', totalApts);

  const { count: aptsAfterLaunch } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('practice_id', PRACTICE_ID).gte('created_at', '2026-05-12T00:00:00Z');
  console.log('Appointments created on/after 2026-05-12:', aptsAfterLaunch);

  // Inbound SMS via processed_inbound_sms
  const { data: pinbSample } = await supabase.from('processed_inbound_sms').select('*').limit(1);
  console.log('\nprocessed_inbound_sms columns:', pinbSample && pinbSample[0] ? Object.keys(pinbSample[0]).join(', ') : 'NO ROWS');

  const { count: pinbCount } = await supabase
    .from('processed_inbound_sms')
    .select('*', { count: 'exact', head: true })
    .eq('practice_id', PRACTICE_ID)
    .gte('created_at', '2026-05-12T00:00:00Z');
  console.log('Inbound SMS count since 2026-05-12:', pinbCount);

  // Pull recall_sequences with linked appointment data for both arms
  const { data: seqs } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, link_clicked_at, booking_stage, exit_reason, sequence_status, created_at')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  if (!seqs) { console.log('no seqs'); return; }

  // For each arm: who has an appointment created after their seq.created_at?
  const patIds = seqs.map(s => s.patient_id);
  const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const aptsAll: any[] = [];
  for (const c of chunk(patIds, 100)) {
    const { data } = await supabase
      .from('appointments')
      .select('patient_id, status, scheduled_at, created_at')
      .eq('practice_id', PRACTICE_ID)
      .in('patient_id', c);
    if (data) aptsAll.push(...data);
  }
  console.log(`\nTotal appointments matched to A/B patients: ${aptsAll.length}`);

  // Build per-patient: earliest appointment created AFTER sequence start
  const seqByPatient = new Map(seqs.map(s => [s.patient_id, s]));
  const attributedByArm: Record<string, { patients: Set<string>; statuses: Record<string, number> }> = {
    control_voice: { patients: new Set(), statuses: {} },
    offer_only: { patients: new Set(), statuses: {} },
  };
  for (const apt of aptsAll) {
    const seq = seqByPatient.get(apt.patient_id);
    if (!seq) continue;
    const seqStart = new Date(seq.created_at || 0);
    const aptCreated = new Date(apt.created_at || 0);
    if (aptCreated <= seqStart) continue; // existed before sequence
    const arm = attributedByArm[seq.experiment_arm];
    if (!arm) continue;
    arm.patients.add(apt.patient_id);
    arm.statuses[apt.status || 'unknown'] = (arm.statuses[apt.status || 'unknown'] || 0) + 1;
  }

  console.log('\n========== ATTRIBUTED BOOKINGS (appt created AFTER seq start) ==========');
  for (const arm of ['control_voice', 'offer_only']) {
    const a = attributedByArm[arm];
    const total = seqs.filter(s => s.experiment_arm === arm).length;
    const label = arm === 'control_voice' ? 'ARM A — 3-voice (Day 0/1/3)' : 'ARM B — offer_only (single Day 0, 30% off)';
    console.log(`\n${label}`);
    console.log(`  Sent: ${total}`);
    console.log(`  Patients with attributed appt: ${a.patients.size} (${((a.patients.size / total) * 100).toFixed(1)}%)`);
    console.log(`  Status counts: ${JSON.stringify(a.statuses)}`);
  }

  // Also count S6_COMPLETED and EXIT_OPT_OUT etc per arm
  const armStages: Record<string, Record<string, number>> = { control_voice: {}, offer_only: {} };
  for (const s of seqs) {
    const stage = s.booking_stage || 'none';
    armStages[s.experiment_arm][stage] = (armStages[s.experiment_arm][stage] || 0) + 1;
  }
  console.log('\n========== SEQUENCE END STATES PER ARM ==========');
  for (const arm of ['control_voice', 'offer_only']) {
    console.log(`\n${arm}: ${JSON.stringify(armStages[arm], null, 2)}`);
  }
})();

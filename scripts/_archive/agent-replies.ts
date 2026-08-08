import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const SINCE = '2026-05-12T00:00:00Z';

async function main() {
  // 1. A/B sequences
  const { data: seqs, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, booking_stage, exit_reason, link_clicked_at, reply_count, sequence_status')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  if (seqErr) throw seqErr;
  console.log(`Sequences: ${seqs!.length}`);

  const seqByPatient = new Map<string, any>();
  const patientIds: string[] = [];
  for (const s of seqs!) {
    seqByPatient.set(s.patient_id, s);
    patientIds.push(s.patient_id);
  }

  // 2. Patients
  const pts: any[] = [];
  for (let i = 0; i < patientIds.length; i += 50) {
    const chunk = patientIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone')
      .in('id', chunk);
    if (error) throw error;
    pts.push(...(data || []));
  }
  const ptById = new Map(pts.map(p => [p.id, p]));

  // 3. SMS messages — inspect first row to confirm columns
  const { data: sample, error: smsErr } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);
  if (smsErr) throw smsErr;
  if (sample && sample[0]) {
    console.log('conversations columns:', Object.keys(sample[0]).join(', '));
  }

  // Pull all messages (inbound + outbound) for these patients since SINCE
  const allMsgs: any[] = [];
  const chunkSize = 50;
  for (let i = 0; i < patientIds.length; i += chunkSize) {
    const chunk = patientIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .in('patient_id', chunk)
      .gte('created_at', SINCE)
      .order('created_at', { ascending: true });
    if (error) throw error;
    allMsgs.push(...(data || []));
  }
  console.log(`Total messages: ${allMsgs.length}`);

  const inbound = allMsgs.filter(m => m.direction === 'inbound');
  const outbound = allMsgs.filter(m => m.direction === 'outbound');
  console.log(`Inbound: ${inbound.length}, Outbound: ${outbound.length}`);

  // Group by patient for context
  const byPatient = new Map<string, any[]>();
  for (const m of allMsgs) {
    if (!byPatient.has(m.patient_id)) byPatient.set(m.patient_id, []);
    byPatient.get(m.patient_id)!.push(m);
  }

  // Print full conversation thread per patient that replied
  const repliers = new Set(inbound.map(m => m.patient_id));
  console.log(`\nUnique repliers: ${repliers.size}\n`);
  console.log('='.repeat(80));

  for (const pid of repliers) {
    const pt = ptById.get(pid);
    const seq = seqByPatient.get(pid);
    const msgs = byPatient.get(pid) || [];
    console.log(`\n--- ${pt?.first_name} ${pt?.last_name?.[0]}. | ${seq?.experiment_arm} | stage=${seq?.booking_stage} | status=${seq?.sequence_status} | exit=${seq?.exit_reason} | overdue=${pt?.months_overdue}mo | link_clicked=${!!seq?.link_clicked_at} ---`);
    for (const m of msgs) {
      const tag = m.direction === 'inbound' ? '>>> IN ' : '<<< OUT';
      const body = (m.message_body || m.body || '').replace(/\s+/g, ' ').trim();
      console.log(`${tag} [${m.created_at?.slice(5,16)}] ${body.slice(0, 300)}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PRACTICE = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('id, experiment_arm, assigned_voice, sequence_day, sequence_status, booking_stage, exit_reason, patient_id, link_clicked_at, reply_count, created_at')
    .in('experiment_arm', ['control_voice', 'offer_only'])
    .limit(2000);
  if (!seqs) { console.log('no seqs'); return; }
  console.log(`Loaded ${seqs.length} sequences`);

  const patientIds = seqs.map(s => s.patient_id);
  const { data: patients } = await sb
    .from('patients')
    .select('id, recall_opt_out')
    .in('id', patientIds)
    .limit(2000);
  const optOutMap = new Map((patients || []).map(p => [p.id, p.recall_opt_out]));

  // Earliest sequence created_at — use as start of test window
  const testStart = seqs.reduce((min, s) => s.created_at < min ? s.created_at : min, seqs[0].created_at);
  console.log(`Test start: ${testStart}`);

  const chunk = <T,>(arr: T[], n: number) => { const o: T[][] = []; for (let i=0;i<arr.length;i+=n) o.push(arr.slice(i,i+n)); return o; };

  // Pull conversations for these patients since test start, recall-context only
  const allMsgs: any[] = [];
  for (const c of chunk(patientIds, 100)) {
    const { data } = await sb
      .from('conversations')
      .select('patient_id, direction, service_context, automation_type, created_at')
      .eq('practice_id', PRACTICE)
      .in('patient_id', c)
      .gte('created_at', testStart)
      .limit(10000);
    if (data) allMsgs.push(...data);
  }
  console.log(`Loaded ${allMsgs.length} conversation rows`);
  // distinct service_context / automation_type
  const ctx = new Set(allMsgs.map(m => `${m.service_context}|${m.automation_type}`));
  console.log(`Distinct ctx:`, Array.from(ctx).slice(0, 10));

  // patient → seq lookup
  const patToSeq = new Map(seqs.map(s => [s.patient_id, s]));

  for (const arm of ['control_voice', 'offer_only']) {
    const armSeqs = seqs.filter(s => s.experiment_arm === arm);
    const armPatIds = new Set(armSeqs.map(s => s.patient_id));
    const armMsgs = allMsgs.filter(m => armPatIds.has(m.patient_id));
    // Restrict to recall-related: automation_type contains 'recall'
    const recallMsgs = armMsgs.filter(m => (m.automation_type || '').includes('recall') || (m.service_context || '').includes('recall'));
    const sentOut = recallMsgs.filter(m => m.direction === 'outbound');
    const replies = recallMsgs.filter(m => m.direction === 'inbound');

    const optOuts = armSeqs.filter(s => optOutMap.get(s.patient_id) === true).length;
    const declined = armSeqs.filter(s => s.exit_reason === 'declined').length;
    const wrongNumber = armSeqs.filter(s => s.exit_reason === 'wrong_number').length;
    const completed = armSeqs.filter(s => s.booking_stage === 'S6_COMPLETED').length;
    const active = armSeqs.filter(s => s.sequence_status === 'active').length;
    const exited = armSeqs.filter(s => s.sequence_status === 'exited').length;
    const clicked = armSeqs.filter(s => s.link_clicked_at).length;
    const repliedPats = new Set(replies.map(m => m.patient_id));

    console.log(`\n=== Arm: ${arm} — ${armSeqs.length} patients ===`);
    console.log(`Total outbound (recall):  ${sentOut.length}`);
    console.log(`Patients w/ ≥1 reply:     ${repliedPats.size}`);
    console.log(`Total inbound:            ${replies.length}`);
    console.log(`Sequences w/ link click:  ${clicked}`);
    console.log(`Booking intent (S6):      ${completed}`);
    console.log(`Opt-outs:                 ${optOuts}`);
    console.log(`Declined:                 ${declined}`);
    console.log(`Wrong number:             ${wrongNumber}`);
    console.log(`Active:                   ${active}`);
    console.log(`Exited:                   ${exited}`);
  }

  const ctrl = seqs.filter(s => s.experiment_arm === 'control_voice');
  const stages: Record<string, number> = {};
  ctrl.forEach(s => { stages[s.booking_stage || 'null'] = (stages[s.booking_stage || 'null'] || 0) + 1; });
  console.log(`\n=== Arm A booking_stage distribution ===`);
  Object.entries(stages).sort((a,b) => b[1]-a[1]).forEach(([s,n]) => console.log(`  ${s}: ${n}`));
  const exits: Record<string, number> = {};
  ctrl.filter(s => s.exit_reason).forEach(s => { exits[s.exit_reason!] = (exits[s.exit_reason!] || 0) + 1; });
  console.log(`\n=== Arm A exit_reason ===`);
  Object.entries(exits).sort((a,b) => b[1]-a[1]).forEach(([e,n]) => console.log(`  ${e}: ${n}`));
}
main().catch(e => { console.error(e); process.exit(1); });

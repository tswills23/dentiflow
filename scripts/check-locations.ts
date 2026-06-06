import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('id, patient_id, sequence_status, sequence_day, next_send_at')
    .eq('experiment_arm','control_voice')
    .eq('sequence_status','active')
    .limit(500);
  if (!seqs) return;
  const patIds = seqs.map(s => s.patient_id);
  const { data: pats } = await sb
    .from('patients')
    .select('id, location')
    .in('id', patIds)
    .limit(500);
  const locMap = new Map((pats||[]).map(p => [p.id, p.location]));
  const byLoc: Record<string, number> = {};
  seqs.forEach(s => {
    const l = locMap.get(s.patient_id) || 'null';
    byLoc[l] = (byLoc[l] || 0) + 1;
  });
  console.log(`Active Arm A by location:`);
  Object.entries(byLoc).forEach(([l,n]) => console.log(`  ${l}: ${n}`));

  // Day-1 active with past next_send_at, by location
  const now = new Date().toISOString();
  const pending = seqs.filter(s => s.sequence_day === 1 && s.next_send_at && s.next_send_at <= now);
  const pendByLoc: Record<string, number> = {};
  pending.forEach(s => {
    const l = locMap.get(s.patient_id) || 'null';
    pendByLoc[l] = (pendByLoc[l] || 0) + 1;
  });
  console.log(`\nPending (day=1, next_send_at past) by location:`);
  Object.entries(pendByLoc).forEach(([l,n]) => console.log(`  ${l}: ${n}`));
}
main();

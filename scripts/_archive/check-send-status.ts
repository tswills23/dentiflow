import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('id, sequence_day, sequence_status, next_send_at, last_sent_at, experiment_arm')
    .eq('experiment_arm','control_voice')
    .limit(500);
  if (!seqs) return;
  console.log(`Total Arm A: ${seqs.length}`);
  const byDayStatus: Record<string, number> = {};
  seqs.forEach(s => {
    const k = `day${s.sequence_day} | ${s.sequence_status}`;
    byDayStatus[k] = (byDayStatus[k] || 0) + 1;
  });
  Object.entries(byDayStatus).sort((a,b)=>b[1]-a[1]).forEach(([k,n]) => console.log(`  ${k}: ${n}`));

  // last_sent_at in last 30 min
  const cutoff = new Date(Date.now() - 30*60*1000).toISOString();
  const recentSends = seqs.filter(s => s.last_sent_at && s.last_sent_at >= cutoff);
  console.log(`\nSequences with last_sent_at in last 30 min: ${recentSends.length}`);

  // Day 3 specifically
  const day3 = seqs.filter(s => s.sequence_day === 3);
  console.log(`\nSequence_day=3 total: ${day3.length}`);
  const day3Sent = day3.filter(s => s.last_sent_at && s.last_sent_at >= cutoff);
  console.log(`Day 3 sent in last 30 min: ${day3Sent.length}`);

  // Active still on day 1 with next_send_at past
  const stillPending = seqs.filter(s => s.sequence_status === 'active' && s.sequence_day === 1 && s.next_send_at && s.next_send_at <= new Date().toISOString());
  console.log(`\nStill pending (active, day=1, next_send_at past): ${stillPending.length}`);
}
main();

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await sb
    .from('recall_sequences')
    .select('next_send_at, sequence_day, sequence_status, experiment_arm')
    .eq('experiment_arm','control_voice')
    .eq('sequence_status','active')
    .limit(500);
  if (!data) return;
  const buckets: Record<string, number> = {};
  data.forEach(s => {
    const key = s.next_send_at ? s.next_send_at.slice(0,16) : 'null';
    buckets[`day${s.sequence_day} | ${key}`] = (buckets[`day${s.sequence_day} | ${key}`] || 0) + 1;
  });
  console.log(`Total active Arm A: ${data.length}`);
  Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([k,n]) => console.log(`  ${k}: ${n}`));
}
main();

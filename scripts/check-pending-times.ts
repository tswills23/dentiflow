import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('next_send_at, sequence_day, sequence_status')
    .eq('experiment_arm','control_voice')
    .eq('sequence_status','active')
    .eq('sequence_day', 1)
    .limit(500);
  const now = new Date();
  console.log(`Now: ${now.toISOString()}`);
  const buckets: Record<string, number> = {};
  (seqs||[]).forEach(s => {
    if (!s.next_send_at) { buckets['null'] = (buckets['null']||0)+1; return; }
    const k = s.next_send_at.slice(11,16);
    buckets[k] = (buckets[k]||0)+1;
  });
  Object.entries(buckets).sort().forEach(([k,n]) => console.log(`  ${k}: ${n}`));
}
main();

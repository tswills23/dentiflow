import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const { data } = await supabase
  .from('recall_sequences')
  .select('last_sent_at, next_send_at, sequence_day, sequence_status')
  .eq('practice_id', PID)
  .eq('sequence_status', 'active')
  .gte('last_sent_at', '2026-06-03T00:00:00');

const rows = (data || []).filter(r => r.next_send_at);
const ns = rows.map(r => r.next_send_at).sort();
const ls = rows.map(r => r.last_sent_at).sort();
console.log(`Active 6/3 sequences w/ next_send_at: ${rows.length}`);
console.log(`Day 0 last_sent_at:  min ${ls[0]}  max ${ls[ls.length-1]}`);
console.log(`next_send_at (Day1): min ${ns[0]}  max ${ns[ns.length-1]}`);
// dist of sequence_day
const byDay = {}; (data||[]).forEach(r => byDay[r.sequence_day] = (byDay[r.sequence_day]||0)+1);
console.log('sequence_day dist (active):', byDay);
process.exit(0);

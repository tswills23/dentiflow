import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const { data, error } = await supabase
  .from('recall_sequences')
  .select('id, created_at, last_sent_at, booking_stage, experiment_arm, assigned_voice')
  .eq('practice_id', PID);
if (error) { console.error(error.message); process.exit(1); }

const byDay = (field) => {
  const m = {};
  (data||[]).forEach(r => { const d = (r[field]||'null').slice(0,10); m[d]=(m[d]||0)+1; });
  return Object.entries(m).sort();
};
console.log('TOTAL sequences:', data.length);
console.log('\ncreated_at by day:'); byDay('created_at').forEach(([d,c])=>console.log(`  ${d}: ${c}`));
console.log('\nlast_sent_at by day:'); byDay('last_sent_at').forEach(([d,c])=>console.log(`  ${d}: ${c}`));
console.log('\nexperiment_arm:'); { const m={}; data.forEach(r=>{m[r.experiment_arm||'null']=(m[r.experiment_arm||'null']||0)+1;}); Object.entries(m).forEach(([k,v])=>console.log(`  ${k}: ${v}`)); }
process.exit(0);

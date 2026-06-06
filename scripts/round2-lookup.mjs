import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const NEEDLES = ['rante', 'richardson', 'nicholas', 'rivera', 'reid', 'saada'];

for (const needle of NEEDLES) {
  // search both first and last name
  const { data: byLast } = await supabase
    .from('patients').select('id, first_name, last_name, phone, location, recall_eligible, recall_opt_out')
    .eq('practice_id', PID).ilike('last_name', `%${needle}%`);
  const { data: byFirst } = await supabase
    .from('patients').select('id, first_name, last_name, phone, location, recall_eligible, recall_opt_out')
    .eq('practice_id', PID).ilike('first_name', `%${needle}%`);
  const seen = new Set();
  const rows = [...(byLast||[]), ...(byFirst||[])].filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  console.log(`\n=== "${needle}" → ${rows.length} match(es) ===`);
  for (const p of rows) {
    // get their sequence(s)
    const { data: sq } = await supabase
      .from('recall_sequences').select('id, last_sent_at, booking_stage, sequence_status, link_clicked_at')
      .eq('practice_id', PID).eq('patient_id', p.id);
    const sinfo = (sq||[]).map(s => `seq[sent ${s.last_sent_at?.slice(0,10)||'-'} stage ${s.booking_stage||'-'} status ${s.sequence_status}]`).join(' ') || 'no sequence';
    console.log(`  ${p.first_name} ${p.last_name} | ${p.phone} | ${p.location} | elig=${p.recall_eligible} optout=${p.recall_opt_out} | id=${p.id}`);
    console.log(`     ${sinfo}`);
  }
}
process.exit(0);

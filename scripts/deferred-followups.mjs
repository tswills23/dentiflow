// Office follow-up list: patients who deferred to a timeframe, with the date the
// system will auto re-engage them. Run anytime to hand the front desk the upcoming queue.
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
  .select('patient_id, defer_until, patients!inner(first_name,last_name,phone,location)')
  .eq('practice_id', PID)
  .eq('exit_reason', 'deferred')
  .not('defer_until', 'is', null)
  .order('defer_until', { ascending: true });

const rows = (data || []).filter(r => (r.patients?.location || '').includes('Village'));
console.log(`DEFERRED FOLLOW-UP QUEUE — ${rows.length} patient(s) (auto re-engages on date)\n`);
rows.forEach(r => {
  const p = r.patients;
  console.log(`  ${r.defer_until.slice(0,10)}  ${p.first_name} ${p.last_name}  ${p.phone}`);
});

// Also surface the office-log rows (with the patient's own words) from callback_requests
const { data: cb } = await supabase
  .from('callback_requests')
  .select('patient_name, phone, message, created_at')
  .eq('practice_id', PID)
  .eq('request_type', 'deferred_followup')
  .order('created_at', { ascending: false });
if ((cb || []).length) {
  console.log(`\n--- logged with their words (${cb.length}) ---`);
  cb.forEach(c => console.log(`  ${c.patient_name} ${c.phone || ''} — ${c.message}`));
}
process.exit(0);

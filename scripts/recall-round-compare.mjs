import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

// 1) what tables exist for messages?
const probe = async (t) => {
  const { error, count } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('practice_id', PID);
  return error ? `ERR(${error.code||error.message})` : `${count} rows`;
};
for (const t of ['messages','recall_messages','sms_messages','conversations','inbound_messages']) {
  console.log(`table ${t}: ${await probe(t)}`);
}

// 2) link clicks: today vs total, among today's-sent
const { data: sent } = await supabase
  .from('recall_sequences')
  .select('id, patient_id, link_clicked_at, booking_stage, reply_count, updated_at, last_sent_at')
  .eq('practice_id', PID)
  .gte('last_sent_at', '2026-06-03T00:00:00');
const seqs = sent || [];
const clickedTotal = seqs.filter(s => s.link_clicked_at).length;
const clickedToday = seqs.filter(s => s.link_clicked_at && s.link_clicked_at >= '2026-06-03').length;
const bookedTotal = seqs.filter(s => s.booking_stage === 'S6_COMPLETED').length;
const bookedUpdToday = seqs.filter(s => s.booking_stage === 'S6_COMPLETED' && (s.updated_at||'') >= '2026-06-03').length;
console.log(`\nToday-sent cohort = ${seqs.length}`);
console.log(`  link_clicked_at: total=${clickedTotal}, today=${clickedToday}`);
console.log(`  booked(S6): total=${bookedTotal}, updated today=${bookedUpdToday}`);

// 3) automation_log today — full rows to see structure
const { data: logs } = await supabase
  .from('automation_log')
  .select('automation_type, action, result, created_at')
  .eq('practice_id', PID)
  .gte('created_at', '2026-06-03T00:00:00')
  .order('created_at', { ascending: true })
  .limit(700);
const byTypeAction = {};
(logs||[]).forEach(l => {
  const k = `${l.automation_type} / ${l.action ?? '-'} / ${l.result ?? '-'}`;
  byTypeAction[k] = (byTypeAction[k]||0)+1;
});
console.log('\nToday automation_log (type / action / result):');
Object.entries(byTypeAction).sort((a,b)=>b[1]-a[1]).forEach(([k,c])=>console.log(`  ${k}: ${c}`));

process.exit(0);

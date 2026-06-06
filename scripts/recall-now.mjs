import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const SINCE = '2026-06-03T00:00:00';

const { data: sent } = await supabase
  .from('recall_sequences')
  .select('id, patient_id, assigned_voice, sequence_status, booking_stage, sequence_day, reply_count, opt_out, link_clicked_at, last_sent_at, defer_until, exit_reason')
  .eq('practice_id', PID)
  .gte('last_sent_at', SINCE);

const seqs = sent || [];

const pids = [...new Set(seqs.map(s => s.patient_id))];
const loc = new Map();
for (let i = 0; i < pids.length; i += 300) {
  const { data } = await supabase.from('patients').select('id, location').in('id', pids.slice(i, i+300));
  (data||[]).forEach(p => loc.set(p.id, p.location));
}

function summarize(rows, label) {
  const sentN = rows.length;
  const replied = rows.filter(s => s.reply_count > 0).length;
  const clicked = rows.filter(s => s.link_clicked_at !== null).length;
  const booked = rows.filter(s => s.booking_stage === 'S6_COMPLETED').length;
  const optedOut = rows.filter(s => s.opt_out || s.booking_stage === 'EXIT_OPT_OUT').length;
  const rr = sentN ? (replied/sentN*100).toFixed(1) : '0';
  const cr = sentN ? (clicked/sentN*100).toFixed(1) : '0';
  const br = sentN ? (booked/sentN*100).toFixed(1) : '0';
  console.log(`\n=== ${label} ===`);
  console.log(`  Sent:       ${sentN}`);
  console.log(`  Replied:    ${replied}  (${rr}%)`);
  console.log(`  Clicked:    ${clicked}  (${cr}%)`);
  console.log(`  Booked:     ${booked}  (${br}%)`);
  console.log(`  Opted out:  ${optedOut}`);
}

summarize(seqs, 'ALL LOCATIONS — round 2 cohort (since 2026-06-03)');

const byLoc = {};
for (const s of seqs) {
  const l = loc.get(s.patient_id) ?? '(unknown)';
  (byLoc[l] = byLoc[l] || []).push(s);
}
for (const [l, rows] of Object.entries(byLoc).sort((a,b)=>b[1].length-a[1].length)) {
  summarize(rows, l);
}

// progression by day
console.log('\n=== SEQUENCE STATUS ===');
const byStatus = {};
seqs.forEach(s => byStatus[s.sequence_status] = (byStatus[s.sequence_status]||0)+1);
Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).forEach(([k,c])=>console.log(`  ${k}: ${c}`));

console.log('\n=== CURRENT DAY ===');
const byDay = {};
seqs.forEach(s => byDay[s.sequence_day] = (byDay[s.sequence_day]||0)+1);
Object.entries(byDay).sort((a,b)=>a[0]-b[0]).forEach(([k,c])=>console.log(`  day ${k}: ${c}`));

console.log('\n=== BY VOICE ===');
for (const v of ['office','hygienist','doctor']) {
  const rows = seqs.filter(s => s.assigned_voice === v);
  const replied = rows.filter(s => s.reply_count > 0).length;
  const clicked = rows.filter(s => s.link_clicked_at).length;
  const booked = rows.filter(s => s.booking_stage === 'S6_COMPLETED').length;
  console.log(`  ${v}: sent ${rows.length}, replied ${replied} (${rows.length?(replied/rows.length*100).toFixed(1):'0'}%), clicked ${clicked}, booked ${booked}`);
}

process.exit(0);

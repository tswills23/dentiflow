import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const ROUND_START = '2026-06-03T00:00:00';

// Round-2 cohort = sequences last touched on/after 6/3 (Day-0 6/3, Day-1 6/4)
const { data: seqs } = await supabase
  .from('recall_sequences')
  .select('id, patient_id, assigned_voice, sequence_day, booking_stage, sequence_status, reply_count, opt_out, link_clicked_at, last_sent_at, exit_reason, patients!inner(first_name,last_name,location)')
  .eq('practice_id', PID)
  .gte('last_sent_at', ROUND_START);

const rows = (seqs || []).filter(r => (r.patients?.location || '').includes('Village'));
const n = rows.length;

const booked   = rows.filter(r => r.booking_stage === 'S6_COMPLETED');
const clicked  = rows.filter(r => r.link_clicked_at);
const replied  = rows.filter(r => r.reply_count > 0);
const optout   = rows.filter(r => r.opt_out || r.booking_stage === 'EXIT_OPT_OUT' || r.exit_reason === 'opt_out');
const active   = rows.filter(r => r.sequence_status === 'active');
const exited   = rows.filter(r => r.sequence_status === 'exited');
const completed= rows.filter(r => r.sequence_status === 'completed');
const deepFunnel = rows.filter(r => ['S3_TIME_PREF','S4_AVAILABILITY','S6_COMPLETED'].includes(r.booking_stage));

const pct = (x) => n ? (x / n * 100).toFixed(1) + '%' : '0%';

console.log('================ VILLAGE ROUND-2 RECALL — PARTNER SNAPSHOT ================');
console.log('As of:', new Date().toISOString());
console.log('Day 0 sent: 2026-06-03  |  Day 1 sent: 2026-06-04  |  Day 3: pending (~6/6)');
console.log('');
console.log('Cohort (patients texted):     ', n);
console.log('Link clicks:                  ', clicked.length, '(' + pct(clicked.length) + ')');
console.log('Replied:                      ', replied.length, '(' + pct(replied.length) + ')');
console.log('Reached deep funnel (S3+):    ', deepFunnel.length, '(' + pct(deepFunnel.length) + ')');
console.log('Booked in-system (S6):        ', booked.length);
console.log('Opted out / removed:          ', optout.length);
console.log('');
console.log('Sequence status: active', active.length, '| exited', exited.length, '| completed', completed.length);

// outreach send counts from automation_log
const { data: logs } = await supabase
  .from('automation_log')
  .select('action')
  .eq('practice_id', PID).eq('automation_type','recall')
  .gte('created_at', ROUND_START).limit(5000);
const a = {}; (logs||[]).forEach(l => a[l.action] = (a[l.action]||0)+1);
console.log('');
console.log('Sends logged: Day0 =', a.outreach_day0||0, '| Day1 =', a.outreach_day1||0, '| link follow-ups =', a.link_followup||0);
console.log('Total link_click events:', a.link_click||0, '| opt-out events:', (a.opt_out_silent||0)+(a.acknowledge_optout||0));

// confirmed booked names (S6) + note office-confirmed
console.log('');
console.log('--- In-system booked (S6_COMPLETED) ---');
booked.forEach((r,i)=>console.log('  '+(i+1)+'. '+r.patients.first_name+' '+r.patients.last_name));

// by voice
console.log('');
console.log('--- By voice (reply rate) ---');
for (const v of ['office','hygienist','doctor']) {
  const vr = rows.filter(r => r.assigned_voice === v);
  const vrep = vr.filter(r => r.reply_count > 0).length;
  const vclick = vr.filter(r => r.link_clicked_at).length;
  console.log('  '+v+': sent '+vr.length+', clicked '+vclick+', replied '+vrep+' ('+(vr.length?(vrep/vr.length*100).toFixed(1):'0')+'%)');
}
process.exit(0);

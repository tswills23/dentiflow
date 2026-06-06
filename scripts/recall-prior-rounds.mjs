import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

// Pull ALL recall automation_log, page through
const rows = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from('automation_log')
    .select('automation_type, action, result, created_at')
    .eq('practice_id', PID)
    .like('automation_type', 'recall%')
    .order('created_at', { ascending: true })
    .range(from, from + 999);
  if (error) { console.error(error); break; }
  rows.push(...(data||[]));
  if (!data || data.length < 1000) break;
  from += 1000;
}
console.log(`total recall log rows: ${rows.length}`);

// Day-0 outreach sent, grouped by date
const day0 = {};
for (const r of rows) {
  if (r.action === 'outreach_day0' && r.result === 'sent') {
    const d = r.created_at.slice(0,10);
    day0[d] = (day0[d]||0)+1;
  }
}
console.log('\nDay-0 outreach SENT by date (each = a launch day):');
Object.entries(day0).sort().forEach(([d,c])=>console.log(`  ${d}: ${c}`));

// For each launch date, count engagement actions that occurred SAME calendar day
const launchDates = Object.keys(day0).sort();
const replyActions = new Set(['send_booking_link','explain_reason','acknowledge_decline','confirm_external_booking','identify_practice','clarify_intent','handoff_cost','handoff_urgent','offer_slots','confirm_booking']);
for (const ld of launchDates) {
  const sameDay = rows.filter(r => r.created_at.slice(0,10) === ld);
  const sent = sameDay.filter(r => r.action==='outreach_day0' && r.result==='sent').length;
  const failed = sameDay.filter(r => r.action==='outreach_day0' && r.result==='failed').length;
  const clicks = sameDay.filter(r => r.action==='link_click').length;
  const replyResp = sameDay.filter(r => replyActions.has(r.action)).length;
  const optouts = sameDay.filter(r => r.action && r.action.startsWith('opt_out')).length;
  console.log(`\n[${ld}] Day-0 launch`);
  console.log(`  sent ${sent}, failed ${failed}`);
  console.log(`  same-day reply responses: ${replyResp}`);
  console.log(`  same-day link clicks: ${clicks}`);
  console.log(`  same-day opt-out actions: ${optouts}`);
}
process.exit(0);

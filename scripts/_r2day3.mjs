import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from('automation_log')
  .select('action,result,created_at')
  .eq('automation_type','recall')
  .gte('created_at','2026-06-03T00:00:00Z');
if (error) { console.error(error); process.exit(1); }

const agg = {};
const byDay = {};
for (const r of data) {
  const k = `${r.action} / ${r.result}`;
  agg[k] = (agg[k]||0)+1;
  const d = r.created_at.slice(0,10);
  byDay[d] = byDay[d]||{};
  byDay[d][k] = (byDay[d][k]||0)+1;
}
console.log('=== recall automation_log since 6/3, by action/result ===');
for (const [k,v] of Object.entries(agg).sort((a,b)=>b[1]-a[1])) console.log(`${String(v).padStart(4)}  ${k}`);

console.log('\n=== sends by date ===');
for (const d of Object.keys(byDay).sort()) {
  const row = byDay[d];
  console.log(`${d}:  day0=${row['outreach_day0 / sent']||0}  day1=${row['outreach_day1 / sent']||0}  day3=${row['outreach_day3 / sent']||0}  (day0_fail=${row['outreach_day0 / failed']||0} day1_fail=${row['outreach_day1 / failed']||0} day3_fail=${row['outreach_day3 / failed']||0})`);
}

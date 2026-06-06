import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

// All recall automation activity in the last 24h, newest first.
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data, error } = await supabase
  .from('automation_log')
  .select('created_at, action, result')
  .eq('practice_id', PID)
  .eq('automation_type', 'recall')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(500);
if (error) { console.error(error.message); process.exit(1); }

console.log(`Now (UTC):     ${new Date().toISOString()}`);
console.log(`recall automation_log rows in last 24h: ${data.length}`);
if (data[0]) {
  const mins = Math.round((Date.now() - new Date(data[0].created_at).getTime()) / 60000);
  console.log(`Most recent recall action: ${data[0].created_at} (${mins} min ago) — ${data[0].action}/${data[0].result}`);
}

// Bucket by hour to reveal the hourly cron cadence
const byHour = {};
for (const r of data) {
  const h = r.created_at.slice(0, 13) + ':00';
  (byHour[h] = byHour[h] || { total: 0, actions: {} });
  byHour[h].total++;
  byHour[h].actions[r.action] = (byHour[h].actions[r.action] || 0) + 1;
}
console.log('\nActivity by UTC hour (proves cron ticks):');
Object.entries(byHour).sort().reverse().forEach(([h, v]) =>
  console.log(`  ${h}Z  ${v.total.toString().padStart(3)}  ${JSON.stringify(v.actions)}`));
process.exit(0);

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// The hourly orchestrator writes a 'system' / cron_orchestrate row every tick.
const { data, error } = await supabase
  .from('automation_log')
  .select('created_at, result, metadata')
  .eq('practice_id', 'system')
  .eq('automation_type', 'recall')
  .eq('action', 'cron_orchestrate')
  .order('created_at', { ascending: false })
  .limit(12);
if (error) { console.error(error.message); process.exit(1); }

console.log('Most recent cron_orchestrate ticks (UTC):');
(data || []).forEach(r => console.log(`  ${r.created_at}  ${r.result}  ${JSON.stringify(r.metadata)}`));
if (data && data[0]) {
  const last = new Date(data[0].created_at).getTime();
  // no Date.now() allowed in workflow scripts, but this is a plain node script — fine
  const mins = Math.round((Date.now() - last) / 60000);
  console.log(`\nLast tick was ${mins} min ago.`);
}
process.exit(0);

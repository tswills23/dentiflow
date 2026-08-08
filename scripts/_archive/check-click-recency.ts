import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  const { data } = await supabase
    .from('recall_sequences')
    .select('link_clicked_at, experiment_arm')
    .eq('practice_id', PRACTICE_ID)
    .not('link_clicked_at','is',null)
    .order('link_clicked_at', { ascending: false })
    .limit(10);
  console.log('Last 10 clicks across all recall sequences:');
  for (const r of data || []) console.log(' ', r.link_clicked_at, r.experiment_arm);

  // Last outbound
  const { data: lastOut } = await supabase
    .from('conversations')
    .select('created_at, automation_type')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('\nLast 3 outbound SMS:');
  for (const r of lastOut || []) console.log(' ', r.created_at, r.automation_type);
})();

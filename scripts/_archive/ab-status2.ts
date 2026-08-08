import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  // Sample one of each arm
  const { data: a } = await supabase.from('recall_sequences').select('id, experiment_arm, template_id, booking_link_token, link_clicked_at').eq('practice_id', PRACTICE_ID).eq('experiment_arm','offer_only').limit(3);
  console.log('Arm B sample:', a);
  const { data: msgs } = await supabase.from('sms_messages').select('*').eq('practice_id', PRACTICE_ID).gte('created_at','2026-05-12').limit(2);
  if (msgs?.[0]) console.log('\nsms_messages columns:', Object.keys(msgs[0]).join(', '));
  // count by direction
  const { count: ci } = await supabase.from('sms_messages').select('*',{count:'exact',head:true}).eq('practice_id', PRACTICE_ID).eq('direction','inbound').gte('created_at','2026-05-12');
  const { count: co } = await supabase.from('sms_messages').select('*',{count:'exact',head:true}).eq('practice_id', PRACTICE_ID).eq('direction','outbound').gte('created_at','2026-05-12');
  console.log(`\nSince 2026-05-12: outbound=${co} inbound=${ci}`);
  // reply_count on sequences
  const { data: rep } = await supabase.from('recall_sequences').select('experiment_arm, reply_count').eq('practice_id', PRACTICE_ID).in('experiment_arm',['control_voice','offer_only']);
  const tot:Record<string,number> = {};
  const nonzero:Record<string,number> = {};
  for (const r of rep||[]) { tot[r.experiment_arm]=(tot[r.experiment_arm]||0)+(r.reply_count||0); if((r.reply_count||0)>0) nonzero[r.experiment_arm]=(nonzero[r.experiment_arm]||0)+1; }
  console.log('\nreply_count totals:', tot);
  console.log('Patients who replied (reply_count>0):', nonzero);
})();

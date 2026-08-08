import dotenv from 'dotenv'; import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname,'..','.env') });
import { supabase } from '../src/lib/supabase';
(async () => {
  const { data: seqs } = await supabase
    .from('recall_sequences')
    .select('patient_id, reply_count, experiment_arm, booking_stage')
    .eq('practice_id','a3f04cf9-54aa-4bd6-939a-d0417c42d941')
    .in('experiment_arm',['control_voice','offer_only']);
  const all = seqs||[];
  const withReplies = all.filter((s:any)=>(s.reply_count||0)>0);
  console.log('total seqs:', all.length, 'with reply_count>0:', withReplies.length);
  const byArm: any = {};
  withReplies.forEach((s:any)=>{ byArm[s.experiment_arm]=(byArm[s.experiment_arm]||0)+1; });
  console.log('reply_count>0 by arm:', byArm);
  console.log('non-S0 stages:');
  const nonS0 = all.filter((s:any)=>s.booking_stage!=='S0_OPENING');
  const byStage: any = {};
  nonS0.forEach((s:any)=>{const k=s.experiment_arm+':'+s.booking_stage;byStage[k]=(byStage[k]||0)+1;});
  console.log(byStage);

  // Check conversations
  const ids = all.map((s:any)=>s.patient_id);
  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .in('patient_id', ids)
    .eq('direction','inbound')
    .gte('created_at','2026-05-12T00:00:00Z');
  console.log('inbound conversations since 5/12 for A/B patients:', count);
  const { count: outCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .in('patient_id', ids)
    .eq('direction','outbound')
    .gte('created_at','2026-05-12T00:00:00Z');
  console.log('outbound conversations since 5/12 for A/B patients:', outCount);
})();

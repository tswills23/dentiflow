import dotenv from 'dotenv'; import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname,'..','.env') });
import { supabase } from '../src/lib/supabase';
(async () => {
  const { data: seqs } = await supabase
    .from('recall_sequences')
    .select('patient_id')
    .eq('practice_id','a3f04cf9-54aa-4bd6-939a-d0417c42d941')
    .in('experiment_arm',['control_voice','offer_only']);
  const ids = (seqs||[]).map((s:any)=>s.patient_id);
  let inboundTotal = 0, outboundTotal = 0;
  const allInbound: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i+50);
    const { data: inb } = await supabase
      .from('conversations')
      .select('patient_id, direction, message_body, automation_type, created_at')
      .in('patient_id', batch)
      .gte('created_at','2026-05-12T00:00:00Z');
    if (inb) {
      for (const c of inb) {
        if (c.direction==='inbound') { inboundTotal++; allInbound.push(c); }
        else outboundTotal++;
      }
    }
  }
  console.log('inbound:', inboundTotal, 'outbound:', outboundTotal);
  console.log('automation_type breakdown of inbound:');
  const t: any = {};
  allInbound.forEach(c=>{const k=c.automation_type||'null';t[k]=(t[k]||0)+1;});
  console.log(t);
  console.log('first 5 inbound:');
  allInbound.slice(0,5).forEach(c=>console.log(' ',c.created_at,(c.message_body||'').slice(0,60)));
})();

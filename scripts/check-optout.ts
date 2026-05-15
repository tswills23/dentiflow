import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PRACTICE = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const names = [['Karen','Blonn'],['Dayanna','Hargrow'],['Shari','Labuda']];
async function main() {
  for (const [first,last] of names) {
    const { data } = await sb
      .from('patients')
      .select('id, first_name, last_name, phone, recall_opt_out, recall_eligible, location, updated_at')
      .eq('practice_id', PRACTICE)
      .ilike('first_name', first)
      .ilike('last_name', last);
    if (!data || !data.length) { console.log(`${first} ${last}: NOT FOUND`); continue; }
    for (const p of data) {
      console.log(`${p.first_name} ${p.last_name} | phone=${p.phone} | recall_opt_out=${p.recall_opt_out} | eligible=${p.recall_eligible} | loc=${p.location} | updated=${p.updated_at}`);
      const { data: seq } = await sb
        .from('recall_sequences')
        .select('id, sequence_status, booking_stage, exit_reason, experiment_arm, updated_at')
        .eq('patient_id', p.id);
      if (seq && seq.length) {
        for (const s of seq) console.log(`  seq: status=${s.sequence_status} stage=${s.booking_stage} exit=${s.exit_reason} arm=${s.experiment_arm} updated=${s.updated_at}`);
      } else {
        console.log('  no sequence');
      }
    }
  }
}
main();

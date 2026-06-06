import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('id, patient_id, link_clicked_at, link_followup_sent, sequence_status, booking_stage, experiment_arm')
    .in('experiment_arm', ['control_voice','offer_only'])
    .not('link_clicked_at', 'is', null)
    .limit(500);
  if (!seqs) return;
  console.log(`Sequences with link clicks: ${seqs.length}`);
  const sent = seqs.filter(s => s.link_followup_sent);
  const pending = seqs.filter(s => !s.link_followup_sent && s.sequence_status === 'active');
  console.log(`  link_followup_sent=true:  ${sent.length}`);
  console.log(`  pending (active+no fup):  ${pending.length}`);
  console.log(`\nSamples sent:`);
  sent.slice(0,5).forEach(s => console.log(`  ${s.id.slice(0,8)} clicked=${s.link_clicked_at?.slice(0,16)} stage=${s.booking_stage}`));
}
main();

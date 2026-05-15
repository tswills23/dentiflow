import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PRACTICE = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  // 1. Opt out Dayanna Hargrow
  const dayannaId = (await sb.from('patients').select('id').eq('practice_id', PRACTICE).ilike('first_name','Dayanna').ilike('last_name','Hargrow').single()).data?.id;
  if (!dayannaId) { console.log('Dayanna lookup failed'); return; }

  const { error: pErr } = await sb
    .from('patients')
    .update({ recall_opt_out: true, recall_eligible: false })
    .eq('id', dayannaId);
  console.log('Dayanna patient update:', pErr?.message || 'OK');

  const { error: sErr } = await sb
    .from('recall_sequences')
    .update({ sequence_status: 'exited', booking_stage: 'EXIT_OPT_OUT', exit_reason: 'opt_out' })
    .eq('patient_id', dayannaId)
    .eq('sequence_status', 'active');
  console.log('Dayanna sequence exit:', sErr?.message || 'OK');

  // 2. Search Karen across variants
  console.log('\n--- Karen search ---');
  const variants = [
    { f: 'Karen', l: 'Blonn' },
    { f: 'Karen', l: 'Blon' },
    { f: 'Karen', l: 'Bloom' },
    { f: 'Karen', l: 'Blohn' },
    { f: 'Karen', l: 'Bloen' },
    { f: 'Karen', l: 'Blain' },
  ];
  for (const v of variants) {
    const { data } = await sb.from('patients').select('first_name,last_name,phone,location,recall_opt_out').eq('practice_id', PRACTICE).ilike('first_name', v.f).ilike('last_name', `${v.l}%`);
    if (data?.length) console.log(`${v.f} ${v.l}*:`, data.map(d => `${d.first_name} ${d.last_name} ${d.phone} (${d.location}, opt_out=${d.recall_opt_out})`).join(' | '));
  }
  // Broader: any Karen at VD with last starting B
  const { data: karens } = await sb.from('patients').select('first_name,last_name,phone,location,recall_opt_out').eq('practice_id', PRACTICE).ilike('first_name', 'Karen').ilike('last_name', 'B%');
  console.log(`All Karens lastname B*:`, karens?.length || 0);
  karens?.forEach(k => console.log(`  ${k.first_name} ${k.last_name} ${k.phone} (${k.location}, opt_out=${k.recall_opt_out})`));

  // Any patient with last_name containing 'lonn'
  const { data: lonn } = await sb.from('patients').select('first_name,last_name,phone,location').eq('practice_id', PRACTICE).ilike('last_name', '%lonn%');
  console.log(`Lastname *lonn*:`, lonn?.length || 0);
  lonn?.forEach(k => console.log(`  ${k.first_name} ${k.last_name} ${k.phone} (${k.location})`));
}
main();

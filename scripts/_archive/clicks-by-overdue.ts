import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('id, patient_id, link_clicked_at, assigned_voice, segment_overdue, months_overdue, booking_stage, sequence_status, experiment_arm')
    .eq('experiment_arm','control_voice')
    .not('link_clicked_at', 'is', null)
    .limit(500);
  if (!seqs) return;
  console.log(`Total Arm A link clickers: ${seqs.length}\n`);

  // By months_overdue bucket
  const buckets = { '<3': 0, '3-6': 0, '6-12': 0, '12-24': 0, '24+': 0 };
  seqs.forEach(s => {
    const m = s.months_overdue || 0;
    if (m < 3) buckets['<3']++;
    else if (m < 6) buckets['3-6']++;
    else if (m < 12) buckets['6-12']++;
    else if (m < 24) buckets['12-24']++;
    else buckets['24+']++;
  });
  console.log('Clickers by months_overdue:');
  Object.entries(buckets).forEach(([k,n]) => console.log(`  ${k}m: ${n}`));

  // By assigned voice (proxy for overdue tier)
  const byVoice: Record<string, number> = {};
  seqs.forEach(s => { byVoice[s.assigned_voice] = (byVoice[s.assigned_voice]||0)+1; });
  console.log('\nClickers by voice (tier):');
  console.log(`  office (<6m):     ${byVoice.office||0}`);
  console.log(`  hygienist (6-12): ${byVoice.hygienist||0}`);
  console.log(`  doctor (12+):     ${byVoice.doctor||0}`);

  // Compare vs total assigned per voice (click rate by tier)
  const { data: allSeqs } = await sb
    .from('recall_sequences')
    .select('assigned_voice')
    .eq('experiment_arm','control_voice')
    .limit(500);
  const totalByVoice: Record<string, number> = {};
  (allSeqs||[]).forEach(s => { totalByVoice[s.assigned_voice] = (totalByVoice[s.assigned_voice]||0)+1; });
  console.log('\nClick rate by voice:');
  console.log(`  office:    ${byVoice.office||0} / ${totalByVoice.office||0} = ${(100*(byVoice.office||0)/(totalByVoice.office||1)).toFixed(1)}%`);
  console.log(`  hygienist: ${byVoice.hygienist||0} / ${totalByVoice.hygienist||0} = ${(100*(byVoice.hygienist||0)/(totalByVoice.hygienist||1)).toFixed(1)}%`);
  console.log(`  doctor:    ${byVoice.doctor||0} / ${totalByVoice.doctor||0} = ${(100*(byVoice.doctor||0)/(totalByVoice.doctor||1)).toFixed(1)}%`);

  // Booking intent (S6) among clickers
  const completed = seqs.filter(s => s.booking_stage === 'S6_COMPLETED');
  console.log(`\nClickers who reached S6_COMPLETED: ${completed.length}`);
  completed.forEach(s => console.log(`  voice=${s.assigned_voice} months_overdue=${s.months_overdue}`));

  // Pull patient names + months for the full clicker list (sorted by overdue)
  const patIds = seqs.map(s => s.patient_id);
  const { data: pats } = await sb.from('patients').select('id, first_name, last_name').in('id', patIds);
  const patMap = new Map((pats||[]).map(p => [p.id, p]));
  const sorted = [...seqs].sort((a,b) => (a.months_overdue||0) - (b.months_overdue||0));
  console.log(`\nFull clicker list (sorted by months_overdue):`);
  sorted.forEach(s => {
    const p = patMap.get(s.patient_id);
    const m = s.months_overdue?.toFixed(1) || '?';
    console.log(`  ${m}mo | ${s.assigned_voice.padEnd(9)} | ${p?.first_name} ${p?.last_name} | ${s.booking_stage}`);
  });
}
main();

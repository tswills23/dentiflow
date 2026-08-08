import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { selectTemplate, renderTemplate, getTemplateId } from '../src/services/recall/templates';
import { isDay3DeadlineArm, day3DeadlineTestEnabled, computeOfferDeadline } from '../src/services/recall/offerDeadline';
import type { SequenceDay } from '../src/types/recall';

const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  const { data: practice } = await supabase.from('practices').select('*').eq('id', PID).single();
  console.log('gate live:', day3DeadlineTestEnabled(practice as never));

  const { data: seqs } = await supabase.from('recall_sequences')
    .select('patient_id,assigned_voice,sequence_status,experiment_arm')
    .eq('practice_id', PID).gte('last_sent_at', '2026-06-03T00:00:00').eq('sequence_status', 'active');
  const rows = seqs || [];
  const pids = [...new Set(rows.map(s => s.patient_id))];
  const ph = new Map<string, { phone: string | null; first_name: string | null }>();
  for (let i = 0; i < pids.length; i += 300) {
    const { data } = await supabase.from('patients').select('id,phone,first_name').in('id', pids.slice(i, i + 300));
    (data || []).forEach(p => ph.set(p.id, p));
  }

  let dl = 0, ctl = 0; const byVoice: Record<string, { dl: number; ctl: number }> = {};
  for (const sq of rows) {
    const p = ph.get(sq.patient_id); if (!p?.phone) continue;
    const arm = isDay3DeadlineArm(p.phone); arm ? dl++ : ctl++;
    byVoice[sq.assigned_voice] = byVoice[sq.assigned_voice] || { dl: 0, ctl: 0 };
    arm ? byVoice[sq.assigned_voice].dl++ : byVoice[sq.assigned_voice].ctl++;
  }
  console.log('\nProjected Day 3 split (active cohort):');
  console.log('  deadline arm:', dl, '| control arm:', ctl, '| total:', dl + ctl);
  console.log('  by voice:', JSON.stringify(byVoice));

  const sendISO = '2026-06-06T16:00:00Z';
  console.log(`\nSample DEADLINE sends (simulated send ${sendISO}, deadline auto = ${computeOfferDeadline(sendISO, practice as never, 5)}):`);
  for (const v of ['office', 'hygienist', 'doctor'] as const) {
    const sq = rows.find(s => s.assigned_voice === v && ph.get(s.patient_id)?.phone && isDay3DeadlineArm(ph.get(s.patient_id)!.phone!));
    if (!sq) { console.log(`  ${v}: (no deadline-arm sample)`); continue; }
    const p = ph.get(sq.patient_id)!;
    const tpl = selectTemplate(v, 3 as SequenceDay, p.phone!, sq.experiment_arm ?? null, true);
    const dlStr = computeOfferDeadline(sendISO, practice as never, 5);
    const body = renderTemplate(tpl, p.first_name || 'there', practice!.name, 'Philip', 'hygiene team', 'https://dentiflow-production.up.railway.app/r/SAMPLE', dlStr);
    console.log(`  [${getTemplateId(v, 3 as SequenceDay, p.phone!, sq.experiment_arm ?? null, true)}]: ${body}`);
  }
  process.exit(0);
}
main();

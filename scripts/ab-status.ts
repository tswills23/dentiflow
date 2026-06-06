import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  const { data: seqs, error } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  if (error) { console.error(error); process.exit(1); }

  if (seqs && seqs[0]) console.log('Columns:', Object.keys(seqs[0]).join(', '), '\n');

  const arms: Record<string, any> = {
    control_voice: { sent:0, linkClicks:0, intentBooked:0, replied:0, optedOut:0, active:0, completed:0, exited:0, stages:{} as Record<string,number> },
    offer_only:    { sent:0, linkClicks:0, intentBooked:0, replied:0, optedOut:0, active:0, completed:0, exited:0, stages:{} as Record<string,number> },
  };
  for (const s of seqs || []) {
    const a = arms[s.experiment_arm]; if (!a) continue;
    a.sent++;
    if (s.link_clicked_at) a.linkClicks++;
    if (s.booking_stage === 'S6_COMPLETED') a.intentBooked++;
    if (s.booking_stage && s.booking_stage !== 'S0_INITIAL' && s.booking_stage !== 'S1_INTENT') a.replied++;
    if (s.exit_reason === 'opted_out' || s.sequence_status === 'opted_out') a.optedOut++;
    if (s.sequence_status === 'active') a.active++;
    if (s.sequence_status === 'completed') a.completed++;
    if (s.sequence_status === 'exited') a.exited++;
    a.stages[s.booking_stage] = (a.stages[s.booking_stage] || 0) + 1;
  }

  const pct = (n:number,d:number)=> d? `${(n/d*100).toFixed(1)}%`:'0%';
  console.log('========== A/B STATUS — as of', new Date().toISOString(),'==========');
  console.log('Launch: 2026-05-12  |  End: 2026-05-26  |  Today: 2026-05-19 (day 7 of 14)\n');
  for (const arm of ['control_voice','offer_only']) {
    const a = arms[arm];
    const label = arm === 'control_voice' ? 'ARM A — control_voice (3-touch: Day 0/1/3)' : 'ARM B — offer_only (single Day 0 send w/ 30% off)';
    console.log(`\n${label}`);
    console.log(`  Sent:           ${a.sent}`);
    console.log(`  Link clicks:    ${a.linkClicks} (${pct(a.linkClicks, a.sent)})`);
    console.log(`  Intent booked:  ${a.intentBooked} (${pct(a.intentBooked, a.sent)})`);
    console.log(`  Engaged (past intent stage): ${a.replied} (${pct(a.replied, a.sent)})`);
    console.log(`  Opt-outs:       ${a.optedOut}`);
    console.log(`  Status: active=${a.active}  completed=${a.completed}  exited=${a.exited}`);
    console.log(`  Stage breakdown:`, a.stages);
  }

  const { data: replies } = await supabase
    .from('sms_messages')
    .select('id')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'inbound')
    .gte('created_at', '2026-05-12T00:00:00Z');
  console.log(`\nTotal inbound SMS since launch: ${replies?.length || 0}`);
})();

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

// round-2 cohort that replied
const { data: seqs } = await supabase
  .from('recall_sequences')
  .select('patient_id, assigned_voice, booking_stage, sequence_status, reply_count, opt_out, exit_reason')
  .eq('practice_id', PID)
  .gte('last_sent_at', '2026-06-03T00:00:00')
  .gt('reply_count', 0);

const pids = [...new Set((seqs||[]).map(s => s.patient_id))];
const seqByPid = new Map((seqs||[]).map(s => [s.patient_id, s]));

// patient info
const pat = new Map();
for (let i = 0; i < pids.length; i += 200) {
  const { data } = await supabase.from('patients').select('id, first_name, last_name, phone').in('id', pids.slice(i, i+200));
  (data||[]).forEach(p => pat.set(p.id, p));
}

// full conversation thread for each (since launch)
const { data: convos } = await supabase
  .from('conversations')
  .select('patient_id, direction, message_body, automation_type, created_at')
  .eq('practice_id', PID)
  .in('patient_id', pids)
  .gte('created_at', '2026-06-03T00:00:00')
  .order('created_at', { ascending: true });

const byPid = {};
(convos||[]).forEach(c => (byPid[c.patient_id] = byPid[c.patient_id] || []).push(c));

for (const pid of pids) {
  const p = pat.get(pid) || {};
  const sq = seqByPid.get(pid) || {};
  const name = `${p.first_name||'?'} ${p.last_name||''}`.trim();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${name}  |  ${p.phone||'?'}  |  voice=${sq.assigned_voice} stage=${sq.booking_stage} status=${sq.sequence_status}${sq.opt_out?' OPTOUT':''}${sq.exit_reason?' exit='+sq.exit_reason:''}`);
  for (const c of (byPid[pid]||[])) {
    const who = c.direction === 'inbound' ? 'PT >>' : '   << us';
    const t = c.created_at.slice(5,16).replace('T',' ');
    console.log(`  [${t}] ${who}: ${(c.message_body||'').replace(/\n/g,' ')}`);
  }
}
process.exit(0);

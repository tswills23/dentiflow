import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

// label, patient_id, permanent opt-out?, exit reason, exit stage
// Reversible removal only: recall_eligible=false + exit active sequences.
// No permanent recall_opt_out flag (that is irreversible; not setting it here).
const TARGETS = [
  { who: 'Yoav Saada',            pid: '6e4f2002-f265-40e8-a053-268568a7793d', optOut: false, reason: 'declined', stage: 'EXIT_DECLINED' },
  { who: 'Nicholas Rivera',       pid: '64b5f780-e69b-42af-af70-9d1fd7867278', optOut: false, reason: 'declined', stage: 'EXIT_DECLINED' },
  { who: 'Nicholas Rivera (dup)', pid: '3b466311-2340-42d0-909b-bff0a763874d', optOut: false, reason: 'declined', stage: 'EXIT_DECLINED' },
];

for (const t of TARGETS) {
  // 1) patient flags
  const patientUpdate = t.optOut
    ? { recall_eligible: false, recall_opt_out: true }
    : { recall_eligible: false };
  const { error: pErr } = await supabase.from('patients').update(patientUpdate).eq('id', t.pid);
  if (pErr) { console.error(`PATIENT update FAILED for ${t.who}: ${pErr.message}`); continue; }

  // 2) exit any active sequences so the cron stops sending
  const { data: exited, error: sErr } = await supabase
    .from('recall_sequences')
    .update({ sequence_status: 'exited', exit_reason: t.reason, booking_stage: t.stage, next_send_at: null })
    .eq('practice_id', PID)
    .eq('patient_id', t.pid)
    .eq('sequence_status', 'active')
    .select('id');
  if (sErr) { console.error(`SEQUENCE update FAILED for ${t.who}: ${sErr.message}`); continue; }

  console.log(`✓ ${t.who}: patient flags set (${JSON.stringify(patientUpdate)}); ${exited?.length || 0} active sequence(s) exited [${t.reason}]`);
}

// verify
console.log('\n--- verify ---');
for (const t of TARGETS) {
  const { data: p } = await supabase.from('patients').select('first_name,last_name,recall_eligible,recall_opt_out').eq('id', t.pid).single();
  const { data: sq } = await supabase.from('recall_sequences').select('sequence_status,booking_stage,exit_reason').eq('patient_id', t.pid).eq('practice_id', PID);
  console.log(`${p.first_name} ${p.last_name}: elig=${p.recall_eligible} optout=${p.recall_opt_out} | seqs: ${sq.map(s=>`${s.sequence_status}/${s.booking_stage}/${s.exit_reason}`).join(', ')}`);
}
process.exit(0);

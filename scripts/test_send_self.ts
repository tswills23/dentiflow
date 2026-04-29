// One-shot: send Day 0 recall to a single patient by phone number
// Usage: npx tsx scripts/test_send_self.ts --phone +16306400029
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
import { runDay0Outreach } from '../src/services/recall/outreachEngine';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  const phoneArg = process.argv[process.argv.indexOf('--phone') + 1];
  if (!phoneArg) { console.error('Usage: --phone +1XXXXXXXXXX'); process.exit(1); }

  // Find patient
  const { data: patient, error: pErr } = await supabase
    .from('patients')
    .select('id, first_name, last_name, phone')
    .eq('practice_id', PRACTICE_ID)
    .eq('phone', phoneArg)
    .single();

  if (pErr || !patient) { console.error('Patient not found:', phoneArg); process.exit(1); }
  console.log(`Patient: ${patient.first_name} ${patient.last_name} (${patient.phone})`);

  // Find their sequence
  const { data: seq, error: sErr } = await supabase
    .from('recall_sequences')
    .select('id, sequence_status, sequence_day, last_sent_at, exit_reason')
    .eq('practice_id', PRACTICE_ID)
    .eq('patient_id', patient.id)
    .eq('sequence_day', 0)
    .is('last_sent_at', null)
    .single();

  if (sErr || !seq) { console.error('No eligible Day 0 sequence found for this patient.'); process.exit(1); }
  console.log(`Sequence: ${seq.id} | status: ${seq.sequence_status} | exit_reason: ${seq.exit_reason}`);

  // Activate it
  await supabase
    .from('recall_sequences')
    .update({ sequence_status: 'active', exit_reason: null, next_send_at: null })
    .eq('id', seq.id);

  console.log('Activated. Sending...');

  const result = await runDay0Outreach(PRACTICE_ID, { location: 'Village Dental' });
  console.log(`Sent: ${result.sent} | Skipped: ${result.skipped} | Failed: ${result.failed}`);
  if (result.errors.length) result.errors.forEach(e => console.log('  ERROR:', e));
}

main().catch(console.error);

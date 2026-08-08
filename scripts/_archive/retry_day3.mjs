// Retry Day 3 send for the test sequence that hit cooldown
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TEST_PRACTICE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SERVER_URL = 'http://localhost:3000';

// Set sequence to have a past next_send_at so orchestrator retries
const { data: seq } = await supabase
  .from('recall_sequences')
  .select('id, sequence_day, last_sent_at')
  .eq('practice_id', TEST_PRACTICE_ID)
  .single();

console.log(`Sequence: Day ${seq.sequence_day}, last_sent_at: ${seq.last_sent_at}`);

if (seq.sequence_day === 3 && !seq.last_sent_at) {
  // Revert to Day 1 with a past timestamp so orchestrator can advance to Day 3 again
  const pastTime = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('recall_sequences')
    .update({
      sequence_day: 1,
      last_sent_at: pastTime,
      next_send_at: pastTime,
    })
    .eq('id', seq.id);

  console.log('Reset to Day 1 with past timestamps. Calling orchestrator...');

  const resp = await fetch(`${SERVER_URL}/api/recall/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ practiceId: TEST_PRACTICE_ID }),
  });
  const data = await resp.json();
  console.log('Result:', JSON.stringify(data, null, 2));

  // Check status
  const { data: updated } = await supabase
    .from('recall_sequences')
    .select('sequence_day, sequence_status, last_sent_at')
    .eq('id', seq.id)
    .single();
  console.log(`Updated: Day ${updated.sequence_day}, status=${updated.sequence_status}, last_sent=${updated.last_sent_at}`);
} else {
  console.log('Sequence not in expected state for retry.');
}

import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  // Look for any outbound messages containing "undefined" or malformed link
  const { data: msgs, error } = await supabase
    .from('sms_messages')
    .select('id, body, direction, created_at, sequence_id')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'outbound')
    .gte('created_at', '2026-05-12')
    .ilike('body', '%undefined%');
  console.log('Messages containing "undefined":', msgs?.length || 0);
  for (const m of msgs || []) console.log('---\n', m.created_at, '\n', m.body);

  // Also pull all Day 3 messages and inspect a few
  const { data: day3 } = await supabase
    .from('recall_sequences')
    .select('id, sequence_day, template_id, booking_link_token, experiment_arm')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'control_voice')
    .gte('sequence_day', 3)
    .limit(5);
  console.log('\nDay 3+ Arm A sequences sample:', day3?.length || 0);
  for (const s of day3 || []) {
    const { data: sent } = await supabase
      .from('sms_messages')
      .select('body, created_at')
      .eq('sequence_id', s.id)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1);
    console.log('\nseq', s.id, 'template:', s.template_id, 'day:', s.sequence_day);
    if (sent?.[0]) console.log('  last sent:', sent[0].body.slice(0, 200));
  }
})();

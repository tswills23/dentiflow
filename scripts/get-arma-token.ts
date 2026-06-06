import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  const { data } = await supabase
    .from('recall_sequences')
    .select('id, booking_link_token, link_clicked_at')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'control_voice')
    .not('booking_link_token','is',null)
    .limit(3);
  console.log(data);
})();

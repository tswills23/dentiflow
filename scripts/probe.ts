import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  const { count: c1c } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'inbound')
    .gte('created_at', '2026-05-12T00:00:00Z');
  console.log('inbound since 5/12 count:', c1c);

  const { data: c1 } = await supabase
    .from('conversations')
    .select('patient_id, direction, created_at, body')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'inbound')
    .gte('created_at', '2026-05-12T00:00:00Z')
    .limit(10);
  console.log('sample:', c1);

  const { data: armB } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'offer_only')
    .limit(1);
  console.log('Arm B sample keys:', armB?.[0] ? Object.keys(armB[0]) : 'none');
})();

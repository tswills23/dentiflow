import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  const { data } = await supabase
    .from('conversations')
    .select('message_body, automation_type, created_at')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction','outbound')
    .ilike('message_body','%undefined%')
    .limit(3);
  for (const r of data || []) {
    console.log('=====', r.created_at, r.automation_type, '=====');
    console.log(r.message_body);
    console.log();
  }
})();

import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  // Probe all candidate tables
  const tables = ['sms_messages','messages','conversations','recall_reply_audit','sms_log','outbound_messages','message_log'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*',{count:'exact',head:true});
    console.log(`${t}: count=${count} err=${error?.message||'ok'}`);
  }
})();

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  for (const t of ['recall_messages','sms_messages','conversations','messages']) {
    const { data, error } = await sb.from(t).select('*').limit(1);
    console.log(t, '->', error ? `ERR: ${error.message}` : `ok, keys: ${data?.[0] ? Object.keys(data[0]).join(',') : 'empty'}`);
  }
}
main();

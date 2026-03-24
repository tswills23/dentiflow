import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('conversations')
  .select('id, direction, message_body, twilio_sid, automation_type, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error.message);
} else if (!data || data.length === 0) {
  console.log('No conversations found.');
} else {
  for (const c of data) {
    console.log(`[${c.direction}] ${c.created_at}`);
    console.log(`  Body: ${c.message_body?.substring(0, 100)}`);
    console.log(`  SID: ${c.twilio_sid}`);
    console.log(`  Type: ${c.automation_type}`);
    console.log('');
  }
}

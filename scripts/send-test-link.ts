import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { sendSMS } from '../src/services/execution/smsService';
import { supabase } from '../src/lib/supabase';

(async () => {
  const to = '+16306400029';
  const { data: practice } = await supabase
    .from('practices')
    .select('twilio_phone')
    .eq('id', process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941')
    .single();
  const from = practice?.twilio_phone || '';
  const body = [
    'Dentiflow test — 3 Dentrix URL variants. Tap each and tell me which actually loads the booking form:',
    '',
    '1) Current (used in recall): https://bookit.dentrixascend.com/soe/new/dental?pid=ASC13000000001048&mode=externalLink',
    '',
    '2) Drop mode param: https://bookit.dentrixascend.com/soe/new/dental?pid=ASC13000000001048',
    '',
    '3) /test path (from error page): https://bookit.dentrixascend.com/soe/new/test?pid=ASC13000000001048',
  ].join('\n');
  console.log('SMS_LIVE_MODE =', process.env.SMS_LIVE_MODE);
  console.log('From:', from, '\nTo:', to, '\nLen:', body.length);
  const result = await sendSMS(to, body, from);
  console.log('Result:', result);
})();

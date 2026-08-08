import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  const { data } = await supabase.from('practices').select('id, name, booking_url, website, phone').eq('id', PRACTICE_ID).single();
  console.log('Practice config:', data);
})();

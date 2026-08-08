import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  // Pull all outbound recall msgs since launch, look for link patterns
  const { data: msgs } = await supabase
    .from('sms_messages')
    .select('id, body, created_at')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction', 'outbound')
    .gte('created_at', '2026-05-12')
    .limit(2000);
  console.log('Total outbound since 2026-05-12:', msgs?.length || 0);
  // bucket by link pattern
  const buckets: Record<string, number> = {};
  const samples: Record<string, string> = {};
  for (const m of msgs || []) {
    const b = m.body || '';
    let key = 'no-link';
    const match = b.match(/https?:\/\/[^\s]+/);
    if (match) {
      const url = match[0];
      if (url.includes('undefined')) key = 'BROKEN-undefined';
      else if (url.includes('/r/')) key = 'good-/r/';
      else key = 'other:'+url.slice(0,40);
    }
    buckets[key] = (buckets[key]||0)+1;
    if (!samples[key]) samples[key] = b.slice(0, 200);
  }
  console.log('\nLink-pattern buckets:'); console.log(buckets);
  console.log('\nSamples:');
  for (const [k,v] of Object.entries(samples)) console.log(`\n[${k}]\n${v}`);
})();

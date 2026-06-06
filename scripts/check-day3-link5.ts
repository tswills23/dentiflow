import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  // ilike on message_body
  const { data: bad, count: badCount } = await supabase
    .from('conversations')
    .select('message_body, direction, created_at, automation_type', {count:'exact'})
    .eq('practice_id', PRACTICE_ID)
    .eq('direction','outbound')
    .gte('created_at','2026-05-12')
    .ilike('message_body','%undefined%');
  console.log(`Outbound msgs containing "undefined" since launch: ${badCount}`);
  for (const r of (bad||[]).slice(0,8)) console.log('---\n', r.created_at, r.automation_type, '\n', (r.message_body||'').slice(0,250));

  // Now bucket all outbound recall sends by URL pattern
  const { data: all, count: allCount } = await supabase
    .from('conversations')
    .select('message_body', {count:'exact'})
    .eq('practice_id', PRACTICE_ID)
    .eq('direction','outbound')
    .gte('created_at','2026-05-12');
  console.log(`\nTotal outbound since launch: ${allCount}`);
  const buckets: Record<string,number> = {};
  for (const r of all || []) {
    const b = r.message_body || '';
    const m = b.match(/https?:\/\/[^\s]+/);
    let key = 'no-link';
    if (m) {
      if (m[0].includes('undefined')) key = 'BROKEN-undefined';
      else if (m[0].includes('/r/')) key = 'good-/r/';
      else key = 'other-link';
    }
    buckets[key] = (buckets[key]||0)+1;
  }
  console.log('Link buckets:', buckets);
})();

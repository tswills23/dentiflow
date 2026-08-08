import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  const { data: row } = await supabase.from('conversations').select('*').limit(1);
  if (row?.[0]) console.log('conversations cols:', Object.keys(row[0]).join(', '));
  // Search for 'undefined' in body-like fields
  const { data: bad } = await supabase.from('conversations').select('*').eq('practice_id', PRACTICE_ID).ilike('body','%undefined%').limit(20);
  console.log('\nconversations with "undefined" in body:', bad?.length || 0);
  for (const r of bad || []) console.log('---\n', r.created_at, r.direction, '\n', (r.body||'').slice(0,250));
  // Also check for /r/ links
  const { data: links, count } = await supabase.from('conversations').select('body, direction, created_at', {count:'exact'}).eq('practice_id', PRACTICE_ID).eq('direction','outbound').gte('created_at','2026-05-12').ilike('body','%/r/%').limit(5);
  console.log(`\nOutbound with /r/ since launch: count=${count}`);
  for (const r of links || []) console.log('  ', (r.body||'').slice(0,180));
})();

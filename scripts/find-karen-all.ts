import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // ALL Karens in the entire DB, any practice, any location
  const { data: allKarens } = await sb
    .from('patients')
    .select('first_name, last_name, phone, location, practice_id, recall_opt_out')
    .ilike('first_name', 'Karen')
    .limit(2000);
  console.log(`Total Karens in DB: ${allKarens?.length || 0}`);

  // Filter likely matches: last name with "B" or sounds-like
  const filtered = (allKarens || []).filter(k => {
    const ln = (k.last_name || '').toLowerCase();
    return ln.startsWith('b') || ln.includes('lon') || ln.includes('bl');
  });
  console.log(`\nKarens with last name starting B / containing 'lon' or 'bl':`);
  filtered.forEach(k => console.log(`  ${k.first_name} ${k.last_name} | ${k.phone} | loc=${k.location} | opt_out=${k.recall_opt_out}`));

  // 32 Cottage
  const { data: cottage } = await sb
    .from('patients')
    .select('first_name, last_name, phone, recall_opt_out')
    .ilike('location', '%Cottage%')
    .ilike('first_name', 'Karen')
    .limit(100);
  console.log(`\n32 Cottage — Karens: ${cottage?.length || 0}`);
  cottage?.forEach(k => console.log(`  ${k.first_name} ${k.last_name} ${k.phone} opt_out=${k.recall_opt_out}`));

  // Western Springs
  const { data: ws } = await sb
    .from('patients')
    .select('first_name, last_name, phone, recall_opt_out')
    .ilike('location', '%Western%')
    .ilike('first_name', 'Karen')
    .limit(100);
  console.log(`\nWestern Springs — Karens: ${ws?.length || 0}`);
  ws?.forEach(k => console.log(`  ${k.first_name} ${k.last_name} ${k.phone} opt_out=${k.recall_opt_out}`));
}
main();

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Nicholas Rivera, +17739510426 — leaving the practice, requested records.
// User explicitly authorized PERMANENT opt-out (irreversible).
const IDS = [
  '64b5f780-e69b-42af-af70-9d1fd7867278',
  '3b466311-2340-42d0-909b-bff0a763874d',
];

for (const id of IDS) {
  const { data, error } = await supabase
    .from('patients')
    .update({ recall_opt_out: true, recall_eligible: false })
    .eq('id', id)
    .select('first_name,last_name,phone,recall_opt_out,recall_eligible')
    .single();
  if (error) { console.error(`FAILED ${id}: ${error.message}`); continue; }
  console.log(`✓ ${data.first_name} ${data.last_name} ${data.phone}: opt_out=${data.recall_opt_out} elig=${data.recall_eligible}`);
}
process.exit(0);

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

const ROUND_START = '2026-06-03T00:00:00';

// The 6/3 round cohort = sequences last sent on/after 6/3 (round-2 reused March rows)
const { data: seqs, error } = await supabase
  .from('recall_sequences')
  .select('id, patient_id, created_at, last_sent_at, booking_stage, link_clicked_at, reply_count, sequence_status, patients!inner(first_name, last_name, phone, location)')
  .eq('practice_id', PID)
  .gte('last_sent_at', ROUND_START)
  .order('last_sent_at', { ascending: true });
if (error) { console.error(error.message); process.exit(1); }

const rows = seqs || [];
const booked = rows.filter(r => r.booking_stage === 'S6_COMPLETED');
const clickedOnly = rows.filter(r => r.link_clicked_at && r.booking_stage !== 'S6_COMPLETED');

const name = (r) => `${r.patients?.first_name ?? '[?]'} ${r.patients?.last_name ?? '[?]'}`.trim();

console.log(`6/3 ROUND COHORT: ${rows.length} sequences created since ${ROUND_START.slice(0,10)}\n`);

console.log(`=== BOOKED (S6_COMPLETED, system-confirmed): ${booked.length} ===`);
booked.forEach((r, i) => {
  console.log(`${i + 1}. ${name(r)}  |  ${r.patients?.phone ?? ''}  |  ${r.patients?.location ?? ''}  |  clicked ${r.link_clicked_at ? r.link_clicked_at.slice(0,10) : '-'}`);
});

console.log(`\n=== LINK-CLICKERS, not S6 (likely booked outside our loop): ${clickedOnly.length} ===`);
clickedOnly.forEach((r, i) => {
  console.log(`${i + 1}. ${name(r)}  |  ${r.patients?.phone ?? ''}  |  ${r.patients?.location ?? ''}  |  clicked ${r.link_clicked_at.slice(0,10)}  |  stage ${r.booking_stage ?? '-'}`);
});

process.exit(0);

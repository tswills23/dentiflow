import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { supabase } = await import('../src/lib/supabase.js');

const { count: patientCount } = await supabase
  .from('patients')
  .select('*', { count: 'exact', head: true })
  .eq('practice_id', 'a3f04cf9-54aa-4bd6-939a-d0417c42d941');

const { count: seqCount } = await supabase
  .from('recall_sequences')
  .select('*', { count: 'exact', head: true })
  .eq('practice_id', 'a3f04cf9-54aa-4bd6-939a-d0417c42d941');

const { count: activeSeqCount } = await supabase
  .from('recall_sequences')
  .select('*', { count: 'exact', head: true })
  .eq('practice_id', 'a3f04cf9-54aa-4bd6-939a-d0417c42d941')
  .eq('sequence_status', 'active');

// Location breakdown
const { data: locData } = await supabase
  .from('patients')
  .select('location')
  .eq('practice_id', 'a3f04cf9-54aa-4bd6-939a-d0417c42d941')
  .eq('recall_eligible', true);

const locs = {};
(locData || []).forEach(p => {
  const loc = p.location || '(none)';
  locs[loc] = (locs[loc] || 0) + 1;
});

// Voice breakdown
const { data: voiceData } = await supabase
  .from('recall_sequences')
  .select('assigned_voice, segment_overdue')
  .eq('practice_id', 'a3f04cf9-54aa-4bd6-939a-d0417c42d941')
  .eq('sequence_status', 'active');

const voices = {};
(voiceData || []).forEach(s => {
  const key = `${s.assigned_voice} (${s.segment_overdue})`;
  voices[key] = (voices[key] || 0) + 1;
});

console.log('=== DATABASE STATUS ===');
console.log(`Patients: ${patientCount}`);
console.log(`Recall sequences (total): ${seqCount}`);
console.log(`Recall sequences (active): ${activeSeqCount}`);
console.log('');
console.log('=== LOCATIONS (recall eligible) ===');
Object.entries(locs).sort((a, b) => b[1] - a[1]).forEach(([loc, count]) => console.log(`  ${loc}: ${count}`));
console.log('');
console.log('=== VOICE TIERS (active sequences) ===');
Object.entries(voices).sort((a, b) => b[1] - a[1]).forEach(([voice, count]) => console.log(`  ${voice}: ${count}`));

process.exit(0);

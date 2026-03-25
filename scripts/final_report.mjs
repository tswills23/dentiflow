import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { supabase } = await import('../src/lib/supabase.js');
const pid = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

// Total counts
const { count: patientCount } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('practice_id', pid);
const { count: seqTotal } = await supabase.from('recall_sequences').select('*', { count: 'exact', head: true }).eq('practice_id', pid);
const { count: seqActive } = await supabase.from('recall_sequences').select('*', { count: 'exact', head: true }).eq('practice_id', pid).eq('sequence_status', 'active');
const { count: recallEligible } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('practice_id', pid).eq('recall_eligible', true);

// Location breakdown (using RPC or multiple queries to get around 1000 limit)
const locations = ['32 Cottage Dental Care', 'Village Dental', '32 Western Springs Dentistry'];
const locCounts = {};
for (const loc of locations) {
  const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('practice_id', pid).eq('recall_eligible', true).eq('location', loc);
  locCounts[loc] = count;
}
const { count: noLoc } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('practice_id', pid).eq('recall_eligible', true).is('location', null);
locCounts['(no location)'] = noLoc;

// Voice breakdown
const voiceTiers = ['office', 'hygienist', 'doctor'];
const voiceCounts = {};
for (const v of voiceTiers) {
  const { count } = await supabase.from('recall_sequences').select('*', { count: 'exact', head: true }).eq('practice_id', pid).eq('sequence_status', 'active').eq('assigned_voice', v);
  voiceCounts[v] = count;
}

// Segment breakdown
const segments = ['lt_6', 'gte_6_lt_12', 'gte_12'];
const segNames = { lt_6: '<6 months', gte_6_lt_12: '6-12 months', gte_12: '12+ months' };
const segCounts = {};
for (const s of segments) {
  const { count } = await supabase.from('recall_sequences').select('*', { count: 'exact', head: true }).eq('practice_id', pid).eq('sequence_status', 'active').eq('segment_overdue', s);
  segCounts[segNames[s]] = count;
}

console.log('='.repeat(50));
console.log('RECALL IMPORT — FINAL REPORT');
console.log('='.repeat(50));
console.log(`Total patients in DB: ${patientCount}`);
console.log(`Recall eligible: ${recallEligible}`);
console.log(`Recall sequences (total): ${seqTotal}`);
console.log(`Recall sequences (active): ${seqActive}`);
console.log('');
console.log('BY LOCATION:');
Object.entries(locCounts).sort((a, b) => b[1] - a[1]).forEach(([loc, count]) => console.log(`  ${loc}: ${count}`));
console.log('');
console.log('BY VOICE TIER:');
Object.entries(voiceCounts).sort((a, b) => b[1] - a[1]).forEach(([voice, count]) => console.log(`  ${voice}: ${count}`));
console.log('');
console.log('BY OVERDUE SEGMENT:');
Object.entries(segCounts).sort((a, b) => b[1] - a[1]).forEach(([seg, count]) => console.log(`  ${seg}: ${count}`));
console.log('');
console.log('STATUS: Import complete. No texts sent.');
console.log('NEXT: POST /api/recall/launch to send Day 0 outreach.');

process.exit(0);

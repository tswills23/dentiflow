import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
(async () => {
  // Join broken msgs to sequences to figure out arm + day
  const { data: bad } = await supabase
    .from('conversations')
    .select('message_body, created_at, patient_id')
    .eq('practice_id', PRACTICE_ID)
    .eq('direction','outbound')
    .ilike('message_body','%undefined%')
    .limit(500);
  if (!bad) return;
  const patientIds = Array.from(new Set(bad.map(b => b.patient_id).filter(Boolean)));
  // Get arm per patient
  const { data: seqs } = await supabase
    .from('recall_sequences')
    .select('patient_id, experiment_arm')
    .eq('practice_id', PRACTICE_ID)
    .in('patient_id', patientIds);
  const armOf = new Map<string,string>();
  for (const s of seqs || []) armOf.set(s.patient_id, s.experiment_arm);

  const counts: Record<string,number> = {};
  const dateRanges: Record<string,{min:string,max:string}> = {};
  for (const b of bad) {
    const arm = armOf.get(b.patient_id) || 'unknown';
    counts[arm] = (counts[arm]||0)+1;
    if (!dateRanges[arm]) dateRanges[arm] = {min:b.created_at,max:b.created_at};
    else { if (b.created_at<dateRanges[arm].min) dateRanges[arm].min=b.created_at; if (b.created_at>dateRanges[arm].max) dateRanges[arm].max=b.created_at;}
  }
  console.log('Broken-link "undefined" msgs by arm:', counts);
  console.log('Date ranges:', dateRanges);
})();

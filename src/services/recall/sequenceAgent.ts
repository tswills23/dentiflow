// Sequence Agent
// Takes a list of patient IDs (already in DB) and creates paused recall sequences.
// This is the ONLY place recall_sequences rows are created.
//
// Sequences are always created as status='paused'.
// They stay paused until explicitly activated via /api/recall/launch.
// Skips patients who already have an active or paused sequence.

import { supabase } from '../../lib/supabase';
import { assignVoiceFromLastVisit } from './voiceAssignment';
import type { SequenceAgentResult, SequenceDay } from '../../types/recall';

export async function runSequenceAgent(
  practiceId: string,
  patientIds: string[]
): Promise<SequenceAgentResult> {
  const result: SequenceAgentResult = {
    created: 0,
    skipped: 0,
    errors: [],
    sequenceIds: [],
  };

  for (const patientId of patientIds) {
    try {
      // Skip if patient already has an active or paused sequence
      const { data: existing } = await supabase
        .from('recall_sequences')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('patient_id', patientId)
        .in('sequence_status', ['active', 'paused'])
        .limit(1)
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      // Get patient to read last_visit_date for voice assignment
      const { data: patient } = await supabase
        .from('patients')
        .select('last_visit_date, recall_voice, recall_segment')
        .eq('id', patientId)
        .single();

      if (!patient) {
        result.errors.push(`Patient not found: ${patientId}`);
        result.skipped++;
        continue;
      }

      const lastVisit = patient.last_visit_date ? new Date(patient.last_visit_date) : null;
      const { segment, voice, monthsOverdue } = assignVoiceFromLastVisit(lastVisit);

      const { data: seq, error: insertErr } = await supabase
        .from('recall_sequences')
        .insert({
          practice_id: practiceId,
          patient_id: patientId,
          assigned_voice: voice,
          segment_overdue: segment,
          months_overdue: Math.round(monthsOverdue * 10) / 10,
          sequence_day: 0 as SequenceDay,
          sequence_status: 'paused',
          booking_stage: 'S0_OPENING',
          next_send_at: null,
        })
        .select('id')
        .single();

      if (insertErr || !seq) {
        result.errors.push(`Failed to create sequence for ${patientId}: ${insertErr?.message}`);
        result.skipped++;
        continue;
      }

      result.sequenceIds.push(seq.id);
      result.created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error for patient ${patientId}: ${msg}`);
      result.skipped++;
    }
  }

  console.log(
    `[sequenceAgent] created=${result.created}, skipped=${result.skipped}, errors=${result.errors.length}`
  );

  return result;
}

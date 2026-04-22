// Patient Agent
// Takes an approved SegmentedRecord[] and upserts patients into Supabase.
// Sets recall_eligible=true (segmentation flag: overdue, no upcoming appt).
// Does NOT create sequences — that is sequenceAgent's job.
//
// Returns patientIds of successfully upserted patients for handoff to sequenceAgent.

import { supabase } from '../../lib/supabase';
import { findPatientByPhone } from '../execution/patientManager';
import { normalizePhone } from './phoneUtils';
import type { SegmentedRecord, PatientAgentResult } from '../../types/recall';

export async function runPatientAgent(
  practiceId: string,
  records: SegmentedRecord[]
): Promise<PatientAgentResult> {
  const result: PatientAgentResult = {
    upserted: 0,
    skipped: 0,
    errors: [],
    patientIds: [],
  };

  for (const record of records) {
    try {
      // Defensive phone check (should already be normalized by segmentAgent)
      const phone = normalizePhone(record.phone) || record.phone;

      // Look up existing patient
      const existing = await findPatientByPhone(practiceId, phone);

      if (!existing) {
        // Create new patient
        const { data: newPatient, error: createErr } = await supabase
          .from('patients')
          .insert({
            practice_id: practiceId,
            phone,
            first_name: record.firstName,
            last_name: record.lastName || null,
            email: record.email || null,
            source: 'manual' as const,
            status: 'inactive' as const,
            patient_type: 'existing_patient' as const,
            last_visit_date: record.lastVisitDate || null,
            location: record.location || null,
            recall_eligible: true,
            recall_voice: record.voice,
            recall_segment: record.segment,
          })
          .select()
          .single();

        if (createErr || !newPatient) {
          result.errors.push(`Failed to create patient ${phone}: ${createErr?.message}`);
          result.skipped++;
          continue;
        }

        result.patientIds.push(newPatient.id);
        result.upserted++;
        continue;
      }

      // Never re-enable a hard opt-out
      if (existing.recall_opt_out) {
        result.skipped++;
        continue;
      }

      // Update existing patient's recall fields
      const updates: Record<string, unknown> = {
        recall_eligible: true,
        recall_voice: record.voice,
        recall_segment: record.segment,
      };
      if (record.lastVisitDate && record.lastVisitDate !== existing.last_visit_date) {
        updates.last_visit_date = record.lastVisitDate;
      }
      if (record.location && record.location !== existing.location) {
        updates.location = record.location;
      }

      const { error: updateErr } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', existing.id);

      if (updateErr) {
        result.errors.push(`Failed to update patient ${phone}: ${updateErr.message}`);
        result.skipped++;
        continue;
      }

      result.patientIds.push(existing.id);
      result.upserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error processing ${record.phone}: ${msg}`);
      result.skipped++;
    }
  }

  console.log(
    `[patientAgent] upserted=${result.upserted}, skipped=${result.skipped}, errors=${result.errors.length}`
  );

  return result;
}

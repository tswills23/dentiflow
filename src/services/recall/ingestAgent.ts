// Recall Ingest Agent
// Phase 2: CSV import → Supabase with voice assignment
//
// Takes a list of patient records, normalizes phones, calculates overdue
// segment, assigns voice, and creates recall_sequences rows.

import { supabase } from '../../lib/supabase';
import { findPatientByPhone } from '../execution/patientManager';
import { logAutomation } from '../execution/metricsTracker';
import { assignVoiceFromLastVisit } from './voiceAssignment';
import type { IngestResult, SequenceDay } from '../../types/recall';

export interface IngestRecord {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  lastVisitDate?: string; // ISO date string
  location?: string;      // Office location (e.g. "Downtown", "Northside")
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11 && digits.startsWith('+')) return raw.trim();
  return null; // Invalid
}

export async function ingestPatients(
  practiceId: string,
  records: IngestRecord[]
): Promise<IngestResult> {
  const result: IngestResult = { imported: 0, skipped: 0, errors: [] };

  for (const record of records) {
    try {
      // 1. Normalize phone
      const phone = normalizePhone(record.phone);
      if (!phone) {
        result.skipped++;
        result.errors.push(`Invalid phone: ${record.phone}`);
        continue;
      }

      // 2. Find existing patient
      const existing = await findPatientByPhone(practiceId, phone);
      if (!existing) {
        // Create patient for recall
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
            recall_eligible: true,
            location: record.location || null,
          })
          .select()
          .single();

        if (createErr || !newPatient) {
          result.errors.push(`Failed to create patient ${phone}: ${createErr?.message}`);
          result.skipped++;
          continue;
        }

        await createSequence(practiceId, newPatient.id, record.lastVisitDate, phone);
        result.imported++;
        continue;
      }

      // 3. Check eligibility
      if (existing.recall_opt_out) {
        result.skipped++;
        continue;
      }

      // 4. Check for existing active sequence
      const { data: existingSeq } = await supabase
        .from('recall_sequences')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('patient_id', existing.id)
        .eq('sequence_status', 'active')
        .limit(1)
        .single();

      if (existingSeq) {
        result.skipped++; // Already has active sequence
        continue;
      }

      // 5. Update patient recall fields and create sequence
      const lastVisit = record.lastVisitDate || existing.last_visit_date;
      await createSequence(practiceId, existing.id, lastVisit, phone);

      // Update patient fields if provided
      const patientUpdates: Record<string, unknown> = { recall_eligible: true };
      if (record.lastVisitDate && record.lastVisitDate !== existing.last_visit_date) {
        patientUpdates.last_visit_date = record.lastVisitDate;
      }
      if (record.location) {
        patientUpdates.location = record.location;
      }
      if (Object.keys(patientUpdates).length > 1) {
        await supabase
          .from('patients')
          .update(patientUpdates)
          .eq('id', existing.id);
      }

      result.imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error processing ${record.phone}: ${msg}`);
      result.skipped++;
    }
  }

  // Log the ingest
  await logAutomation({
    practiceId,
    automationType: 'recall',
    action: 'ingest',
    result: 'sent',
    metadata: {
      imported: result.imported,
      skipped: result.skipped,
      errorCount: result.errors.length,
    },
  });

  console.log(
    `[ingestAgent] Imported ${result.imported}, skipped ${result.skipped}, errors ${result.errors.length}`
  );

  return result;
}

async function createSequence(
  practiceId: string,
  patientId: string,
  lastVisitDate: string | null | undefined,
  phone: string
): Promise<void> {
  const lastVisit = lastVisitDate ? new Date(lastVisitDate) : null;
  const { segment, voice, monthsOverdue } = assignVoiceFromLastVisit(lastVisit);

  // Update patient recall fields
  await supabase
    .from('patients')
    .update({
      recall_eligible: true,
      recall_voice: voice,
      recall_segment: segment,
    })
    .eq('id', patientId);

  // Create recall sequence
  const { error } = await supabase.from('recall_sequences').insert({
    practice_id: practiceId,
    patient_id: patientId,
    assigned_voice: voice,
    segment_overdue: segment,
    months_overdue: Math.round(monthsOverdue * 10) / 10,
    sequence_day: 0 as SequenceDay,
    sequence_status: 'active',
    booking_stage: 'S0_OPENING',
    next_send_at: null, // Will be set by outreach engine
  });

  if (error) {
    throw new Error(`Failed to create sequence for ${phone}: ${error.message}`);
  }
}

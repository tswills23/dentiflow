// Recall Ingest Agent
// Legacy entry point kept for backward compatibility.
// New flow: use segmentAgent → patientAgent → sequenceAgent instead.
//
// This file now only handles patient upsert (no sequence creation).
// Sequence creation is handled by sequenceAgent.ts.

import { supabase } from '../../lib/supabase';
import { findPatientByPhone } from '../execution/patientManager';
import { logAutomation } from '../execution/metricsTracker';
import { normalizePhone } from './phoneUtils';
import type { IngestResult } from '../../types/recall';

export interface IngestRecord {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  lastVisitDate?: string; // ISO date string
  location?: string;
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
        // Create patient
        const { error: createErr } = await supabase
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
          });

        if (createErr) {
          result.errors.push(`Failed to create patient ${phone}: ${createErr.message}`);
          result.skipped++;
          continue;
        }

        result.imported++;
        continue;
      }

      // 3. Check eligibility
      if (existing.recall_opt_out) {
        result.skipped++;
        continue;
      }

      // 4. Update patient recall fields
      const patientUpdates: Record<string, unknown> = { recall_eligible: true };
      if (record.lastVisitDate && record.lastVisitDate !== existing.last_visit_date) {
        patientUpdates.last_visit_date = record.lastVisitDate;
      }
      if (record.location && record.location !== existing.location) {
        patientUpdates.location = record.location;
      }

      await supabase
        .from('patients')
        .update(patientUpdates)
        .eq('id', existing.id);

      result.imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error processing ${record.phone}: ${msg}`);
      result.skipped++;
    }
  }

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
    `[ingestAgent] imported=${result.imported}, skipped=${result.skipped}, errors=${result.errors.length}`
  );

  return result;
}

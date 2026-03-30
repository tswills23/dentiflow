// Booking Attribution Service
// Cross-references active reactivation sequences with new appointments
// to auto-detect bookings made via the external scheduling link.
//
// Called hourly from recallCron and on-demand from PMS webhook/CSV import.

import { supabase } from '../../lib/supabase';
import { logAutomation } from '../execution/metricsTracker';

export interface AttributionResult {
  attributed: number;
  errors: string[];
}

/**
 * Check all active reactivation sequences for a practice and see if
 * any of those patients now have appointments created after their
 * sequence started. If so, mark the sequence as S6_COMPLETED.
 */
export async function attributeReactivationBookings(
  practiceId: string
): Promise<AttributionResult> {
  const result: AttributionResult = { attributed: 0, errors: [] };

  // 1. Get all active sequences (not already completed/exited)
  const { data: sequences, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, created_at, booking_stage')
    .eq('practice_id', practiceId)
    .eq('sequence_status', 'active');

  if (seqErr || !sequences?.length) {
    return result;
  }

  // 2. Get patient IDs
  const patientIds = sequences.map((s: { patient_id: string }) => s.patient_id);

  // 3. Find appointments for these patients created after their sequence start
  const { data: appointments, error: aptErr } = await supabase
    .from('appointments')
    .select('id, patient_id, created_at, status')
    .eq('practice_id', practiceId)
    .in('patient_id', patientIds)
    .in('status', ['scheduled', 'confirmed']);

  if (aptErr || !appointments?.length) {
    return result;
  }

  // 4. Build lookup: patient_id → earliest appointment created_at
  const aptByPatient = new Map<string, string>();
  for (const apt of appointments) {
    const existing = aptByPatient.get(apt.patient_id);
    if (!existing || apt.created_at < existing) {
      aptByPatient.set(apt.patient_id, apt.created_at);
    }
  }

  // 5. For each sequence, check if patient has a new appointment
  for (const seq of sequences) {
    const aptCreated = aptByPatient.get(seq.patient_id);
    if (!aptCreated) continue;

    // Only attribute if appointment was created AFTER the sequence started
    if (new Date(aptCreated) <= new Date(seq.created_at)) continue;

    // Already at S6_COMPLETED somehow — skip
    if (seq.booking_stage === 'S6_COMPLETED') continue;

    try {
      // Mark sequence as completed
      await supabase
        .from('recall_sequences')
        .update({
          booking_stage: 'S6_COMPLETED',
          sequence_status: 'completed',
          exit_reason: 'completed',
          next_send_at: null,
        })
        .eq('id', seq.id);

      // Increment recall_booked metric
      await supabase.rpc('increment_recall_metric', {
        p_practice_id: practiceId,
        p_date: new Date().toISOString().split('T')[0],
        p_field: 'recall_booked',
      });

      await logAutomation({
        practiceId,
        patientId: seq.patient_id,
        automationType: 'recall',
        action: 'booking_attributed',
        result: 'completed',
        metadata: {
          sequenceId: seq.id,
          method: 'appointment_cross_reference',
        },
      });

      result.attributed++;
      console.log(`[bookingAttribution] Attributed booking for sequence ${seq.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Sequence ${seq.id}: ${msg}`);
    }
  }

  return result;
}

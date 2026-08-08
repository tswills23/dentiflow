// PMS Booking Service — the write-back entry point.
// PMS-agnostic: resolves the practice's integration + adapter, verifies the
// adapter supports booking, then reads availability / creates appointments.
//
// SAFETY: booking writes to a real PMS. This is an EXPLICIT call only — never
// auto-invoked. Every create attempt is logged to pms_sync_log (source 'manual').

import { supabase } from '../../lib/supabase';
import { getPmsAdapter } from './adapterRegistry';
import { supportsBooking } from '../../types/pms';
import type {
  PmsIntegration,
  PmsSlot,
  PmsSlotQuery,
  PmsBookingRequest,
  PmsBookingResult,
} from '../../types/pms';

async function loadActiveIntegration(practiceId: string): Promise<PmsIntegration> {
  const { data, error } = await supabase
    .from('pms_integrations')
    .select('*')
    .eq('practice_id', practiceId)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`[pmsBooking] No PMS integration configured for practice ${practiceId}`);
  }
  if (!data.active) {
    throw new Error(`[pmsBooking] PMS integration for practice ${practiceId} is inactive`);
  }
  return data as PmsIntegration;
}

/**
 * List bookable openings from the practice's PMS.
 */
export async function getAvailableSlots(
  practiceId: string,
  query: PmsSlotQuery
): Promise<PmsSlot[]> {
  const integration = await loadActiveIntegration(practiceId);
  const adapter = getPmsAdapter(integration.pms_type);
  if (!supportsBooking(adapter)) {
    throw new Error(`[pmsBooking] PMS type "${integration.pms_type}" does not support booking`);
  }
  return adapter.getAvailableSlots(integration, query);
}

/**
 * Book an appointment in the practice's PMS. Explicit call only.
 */
export async function bookAppointment(
  practiceId: string,
  request: PmsBookingRequest
): Promise<PmsBookingResult> {
  const integration = await loadActiveIntegration(practiceId);
  const adapter = getPmsAdapter(integration.pms_type);
  if (!supportsBooking(adapter)) {
    throw new Error(`[pmsBooking] PMS type "${integration.pms_type}" does not support booking`);
  }

  const result = await adapter.createAppointment(integration, request);

  // Audit every attempt (best-effort — never let logging break the booking result)
  try {
    await supabase.from('pms_sync_log').insert({
      practice_id: practiceId,
      pms_event_id: `booking_${request.pmsPatientId}_${request.slot.startTime}`,
      pms_appointment_id: result.pmsAppointmentId || 'pending',
      pms_patient_id: request.pmsPatientId,
      event_type: 'booking_created',
      source: 'manual',
      action_taken: result.success ? 'appointment_booked' : 'booking_failed',
      success: result.success,
      error_message: result.error || null,
    });
  } catch (err) {
    console.error('[pmsBooking] Failed to write booking audit log:', err);
  }

  return result;
}

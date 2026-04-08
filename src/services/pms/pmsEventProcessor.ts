// PMS Event Processor — Core Logic
// Takes a normalized PmsAppointmentEvent and dispatches to the right DentiFlow action.
// Handles idempotency, patient resolution, appointment upsert, and status-to-action mapping.

import { supabase } from '../../lib/supabase';
import { findPatientByPmsId, findPatientByPhone, createPatient, updatePatient } from '../execution/patientManager';
import { createNoshowSequence } from '../noshow/noshowService';
import { createReviewSequence, getReviewConfig, sendSurvey } from '../reviews/reviewSequenceService';
import { logAutomation } from '../execution/metricsTracker';
import type { PmsAppointmentEvent, PmsIntegration, PmsProcessResult } from '../../types/pms';
import type { Patient, Practice } from '../../types/database';

// =============================================================================
// Main Entry Point
// =============================================================================

export async function processPmsEvent(
  practiceId: string,
  event: PmsAppointmentEvent,
  source: 'webhook' | 'polling',
  integration?: PmsIntegration
): Promise<PmsProcessResult> {
  try {
    // 1. Idempotency check
    const { data: existing } = await supabase
      .from('pms_sync_log')
      .select('id, action_taken')
      .eq('practice_id', practiceId)
      .eq('pms_event_id', event.pmsEventId)
      .limit(1)
      .single();

    if (existing) {
      return { action: 'skipped_duplicate', success: true };
    }

    // 2. Load practice
    const { data: practice } = await supabase
      .from('practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (!practice) {
      return logAndReturn(practiceId, event, source, 'error', false, 'Practice not found');
    }

    // 3. Resolve patient
    const patient = await resolvePatient(practiceId, event);

    // 4. Upsert appointment
    const appointment = await upsertAppointment(practiceId, patient.id, event);

    // 5. Dispatch by status
    let action = 'appointment_synced';
    let sequenceId: string | undefined;

    if (event.status === 'no_show' && (integration?.sync_noshow !== false)) {
      const result = await handleNoShow(practiceId, patient, appointment);
      action = result.action;
      sequenceId = result.sequenceId;
    } else if (event.status === 'completed' && (integration?.sync_complete !== false)) {
      const result = await handleCompleted(practiceId, patient, practice as unknown as Practice, appointment);
      action = result.action;
      sequenceId = result.sequenceId;
    } else if (event.status === 'cancelled' && (integration?.sync_cancelled !== false)) {
      await updateAppointmentStatus(appointment.id, 'cancelled');
      action = 'appointment_cancelled';
    } else if (event.status === 'rescheduled' && (integration?.sync_rescheduled !== false)) {
      await handleRescheduled(appointment);
      action = 'appointment_rescheduled';
    }

    // 6. Log to pms_sync_log
    await logSyncEvent(practiceId, event, source, action, appointment.id, patient.id, true);

    // 7. Log automation
    await logAutomation({
      practiceId,
      patientId: patient.id,
      automationType: 'pms_sync',
      action,
      result: 'triggered',
      metadata: {
        pmsEventId: event.pmsEventId,
        pmsAppointmentId: event.pmsAppointmentId,
        status: event.status,
        source,
        sequenceId,
      },
    });

    return {
      action,
      success: true,
      appointmentId: appointment.id,
      patientId: patient.id,
      sequenceId,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[pmsEventProcessor] Error processing event ${event.pmsEventId}:`, errorMsg);

    // Log failure to sync log
    await logSyncEvent(practiceId, event, source, 'error', undefined, undefined, false, errorMsg);

    return { action: 'error', success: false, error: errorMsg };
  }
}

// =============================================================================
// Patient Resolution
// =============================================================================

async function resolvePatient(practiceId: string, event: PmsAppointmentEvent): Promise<Patient> {
  // Strategy 1: PMS Patient ID (fastest, most reliable)
  if (event.pmsPatientId) {
    const byPmsId = await findPatientByPmsId(practiceId, event.pmsPatientId);
    if (byPmsId) {
      return byPmsId;
    }
  }

  // Strategy 2: Phone number
  if (event.patientPhone) {
    const normalizedPhone = normalizePhone(event.patientPhone);
    const byPhone = await findPatientByPhone(practiceId, normalizedPhone);
    if (byPhone) {
      // Backfill pms_patient_id if missing
      if (event.pmsPatientId && !byPhone.pms_patient_id) {
        await updatePatient(byPhone.id, { pms_patient_id: event.pmsPatientId } as Partial<Patient>);
      }
      return byPhone;
    }
  }

  // Strategy 3: Create new patient
  const newPatient = await createPatient({
    practiceId,
    phone: event.patientPhone ? normalizePhone(event.patientPhone) : '',
    firstName: event.patientFirstName || undefined,
    lastName: event.patientLastName || undefined,
    source: 'manual',
  });

  // Set pms_patient_id
  if (event.pmsPatientId) {
    await updatePatient(newPatient.id, { pms_patient_id: event.pmsPatientId } as Partial<Patient>);
  }

  console.log(`[pmsEventProcessor] Created new patient ${newPatient.id} from PMS event`);
  return newPatient;
}

// =============================================================================
// Appointment Upsert
// =============================================================================

async function upsertAppointment(
  practiceId: string,
  patientId: string,
  event: PmsAppointmentEvent
): Promise<{ id: string; status: string }> {
  // Try to find existing appointment by PMS ID
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('practice_id', practiceId)
    .eq('booking_platform_id', event.pmsAppointmentId)
    .limit(1)
    .single();

  if (existing) {
    // Update existing appointment
    await supabase
      .from('appointments')
      .update({
        status: mapToAppointmentStatus(event.status),
        provider_name: event.providerName || undefined,
        notes: event.location ? `PMS sync | Location: ${event.location}` : 'PMS sync',
      })
      .eq('id', existing.id);

    return { id: existing.id, status: existing.status || 'scheduled' };
  }

  // Create new appointment
  const { data: created, error } = await supabase
    .from('appointments')
    .insert({
      practice_id: practiceId,
      patient_id: patientId,
      service_id: event.serviceType || 'general',
      provider_name: event.providerName || null,
      appointment_time: event.appointmentTime,
      duration_minutes: event.durationMinutes,
      status: mapToAppointmentStatus(event.status),
      source: 'manual',
      booking_platform_id: event.pmsAppointmentId,
      notes: event.location ? `PMS sync | Location: ${event.location}` : 'PMS sync',
    })
    .select('id, status')
    .single();

  if (error) {
    throw new Error(`Failed to create appointment: ${error.message}`);
  }

  return { id: created.id, status: created.status || 'scheduled' };
}

function mapToAppointmentStatus(pmsStatus: string): string {
  switch (pmsStatus) {
    case 'scheduled':
    case 'confirmed':
      return pmsStatus;
    case 'checked_in':
    case 'in_progress':
    case 'late':
      return 'confirmed';
    case 'completed':
      return 'completed';
    case 'no_show':
      return 'no_show';
    case 'cancelled':
      return 'cancelled';
    case 'rescheduled':
      return 'rescheduled';
    default:
      return 'scheduled';
  }
}

async function updateAppointmentStatus(appointmentId: string, status: string): Promise<void> {
  await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId);
}

// =============================================================================
// Status Handlers
// =============================================================================

async function handleNoShow(
  practiceId: string,
  patient: Patient,
  appointment: { id: string; status: string }
): Promise<{ action: string; sequenceId?: string }> {
  // Guard: already no_show
  if (appointment.status === 'no_show') {
    return { action: 'appointment_synced' };
  }

  // Update statuses
  await updateAppointmentStatus(appointment.id, 'no_show');
  await supabase.from('patients').update({ status: 'no_show' }).eq('id', patient.id);

  // Create recovery sequence (has its own dedup check)
  try {
    const sequence = await createNoshowSequence({
      practiceId,
      patientId: patient.id,
      appointmentId: appointment.id,
    });
    console.log(`[pmsEventProcessor] No-show recovery created: ${sequence.id} for ${patient.first_name} ${patient.last_name}`);
    return { action: 'noshow_sequence_created', sequenceId: sequence.id };
  } catch (err) {
    // If sequence already exists, that's fine (idempotent)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Active noshow sequence already exists')) {
      return { action: 'appointment_synced' };
    }
    throw err;
  }
}

async function handleCompleted(
  practiceId: string,
  patient: Patient,
  practice: Practice,
  appointment: { id: string; status: string }
): Promise<{ action: string; sequenceId?: string }> {
  // Guard: already completed
  if (appointment.status === 'completed') {
    return { action: 'appointment_synced' };
  }

  // Update statuses
  await updateAppointmentStatus(appointment.id, 'completed');
  await supabase.from('patients').update({ status: 'completed' }).eq('id', patient.id);

  // Check for existing active review sequence
  const { data: existingReview } = await supabase
    .from('review_sequences')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('patient_id', patient.id)
    .in('status', ['survey_sent', 'survey_reminded', 'score_received', 'review_requested'])
    .limit(1)
    .single();

  if (existingReview) {
    return { action: 'appointment_synced' };
  }

  // No phone = can't send review
  if (!patient.phone) {
    return { action: 'appointment_synced' };
  }

  // Create review sequence
  const reviewConfig = getReviewConfig(practice);
  const delayHours = reviewConfig.review_survey_delay_hours ?? 2;

  const sequence = await createReviewSequence({
    practiceId,
    patientId: patient.id,
    appointmentId: appointment.id,
    delayHours,
  });

  // Send immediately if delay is 0
  if (delayHours === 0) {
    await sendSurvey(sequence, patient, practice);
  }

  console.log(`[pmsEventProcessor] Review sequence created: ${sequence.id} for ${patient.first_name} ${patient.last_name}`);
  return { action: 'review_sequence_created', sequenceId: sequence.id };
}

async function handleRescheduled(
  appointment: { id: string; status: string }
): Promise<void> {
  await updateAppointmentStatus(appointment.id, 'rescheduled');

  // Close any active noshow sequence for this appointment
  await supabase
    .from('noshow_sequences')
    .update({ status: 'rebooked', next_send_at: null })
    .eq('appointment_id', appointment.id)
    .in('status', ['message_1_pending', 'message_1_sent', 'message_2_sent', 'replied']);
}

// =============================================================================
// Helpers
// =============================================================================

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

async function logSyncEvent(
  practiceId: string,
  event: PmsAppointmentEvent,
  source: 'webhook' | 'polling',
  action: string,
  appointmentId?: string,
  patientId?: string,
  success = true,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('pms_sync_log').insert({
      practice_id: practiceId,
      pms_event_id: event.pmsEventId,
      pms_appointment_id: event.pmsAppointmentId,
      pms_patient_id: event.pmsPatientId,
      event_type: event.status,
      source,
      action_taken: action,
      dentiflow_appointment_id: appointmentId || null,
      dentiflow_patient_id: patientId || null,
      success,
      error_message: errorMessage || null,
    });
  } catch (err) {
    // Don't let sync log failures break processing
    console.error('[pmsEventProcessor] Failed to write sync log:', err);
  }
}

// For use in logAndReturn when practice isn't loaded yet
async function logAndReturn(
  practiceId: string,
  event: PmsAppointmentEvent,
  source: 'webhook' | 'polling',
  action: string,
  success: boolean,
  error: string
): Promise<PmsProcessResult> {
  await logSyncEvent(practiceId, event, source, action, undefined, undefined, success, error);
  return { action, success, error };
}

import { supabase } from '../../lib/supabase';
import type { Patient, PatientStatus, PatientSource } from '../../types/database';

export async function findPatientByPmsId(
  practiceId: string,
  pmsPatientId: string
): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('pms_patient_id', pmsPatientId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[patientManager] Error finding patient by PMS ID:', error.message);
  }

  return data as unknown as Patient | null;
}

export async function findPatientByPhone(
  practiceId: string,
  phone: string
): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[patientManager] Error finding patient:', error.message);
  }

  return data as unknown as Patient | null;
}

export async function createPatient(params: {
  practiceId: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  source?: PatientSource;
  interestedService?: string;
}): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      practice_id: params.practiceId,
      phone: params.phone,
      first_name: params.firstName || null,
      last_name: params.lastName || null,
      email: params.email || null,
      source: params.source || 'web_form',
      status: 'new',
      patient_type: 'unknown',
      interested_service: params.interestedService || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create patient: ${error.message}`);
  }

  return data as unknown as Patient;
}

export async function findOrCreatePatient(params: {
  practiceId: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  source?: PatientSource;
  interestedService?: string;
}): Promise<{ patient: Patient; isNew: boolean }> {
  const existing = await findPatientByPhone(params.practiceId, params.phone);

  if (existing) {
    // Update interested service if provided and different
    if (params.interestedService && params.interestedService !== existing.interested_service) {
      await updatePatient(existing.id, { interested_service: params.interestedService });
    }
    return { patient: existing, isNew: false };
  }

  const patient = await createPatient(params);
  return { patient, isNew: true };
}

export async function updatePatientStatus(
  patientId: string,
  status: PatientStatus
): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update({ status })
    .eq('id', patientId);

  if (error) {
    console.error('[patientManager] Error updating status:', error.message);
  }
}

export async function updatePatient(
  patientId: string,
  updates: Partial<Patient>
): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update(updates as any)
    .eq('id', patientId);

  if (error) {
    console.error('[patientManager] Error updating patient:', error.message);
  }
}

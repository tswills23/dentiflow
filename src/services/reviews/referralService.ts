// Referral Service — link generation, hash management, form submission handling

import crypto from 'crypto';
import { supabase } from '../../lib/supabase';
import { createPatient } from '../execution/patientManager';
import { notifyStaff } from '../execution/staffNotifier';
import { logAutomation } from '../execution/metricsTracker';
import type { Practice, Patient } from '../../types/database';
import type { Referral } from '../../types/review';

// Generate a short, unique referral hash from patient ID
export function generateReferralHash(patientId: string): string {
  return crypto
    .createHash('sha256')
    .update(patientId + Date.now().toString())
    .digest('hex')
    .substring(0, 10);
}

// Create a referral record and return the hash
export async function createReferral(
  practiceId: string,
  referringPatientId: string
): Promise<Referral> {
  const hash = generateReferralHash(referringPatientId);

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      practice_id: practiceId,
      referring_patient_id: referringPatientId,
      referral_link_hash: hash,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create referral: ${error.message}`);
  }

  console.log(`[referralService] Created referral ${data.id} with hash ${hash}`);
  return data as Referral;
}

// Look up referral by hash (for landing page)
export async function findReferralByHash(hash: string): Promise<{
  referral: Referral;
  referringPatient: Patient;
  practice: Practice;
} | null> {
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_link_hash', hash)
    .single();

  if (!referral) return null;

  const [{ data: patient }, { data: practice }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', referral.referring_patient_id).single(),
    supabase.from('practices').select('*').eq('id', referral.practice_id).single(),
  ]);

  if (!patient || !practice) return null;

  return {
    referral: referral as Referral,
    referringPatient: patient as unknown as Patient,
    practice: practice as unknown as Practice,
  };
}

// Handle referral form submission
export async function handleReferralSubmission(params: {
  referralHash: string;
  referredName: string;
  referredPhone: string;
}): Promise<{
  success: boolean;
  newPatientId?: string;
  practiceId?: string;
  practiceName?: string;
  error?: string;
}> {
  // 1. Look up the referral
  const lookup = await findReferralByHash(params.referralHash);
  if (!lookup) {
    return { success: false, error: 'Invalid referral link' };
  }

  const { referral, referringPatient, practice } = lookup;

  // 2. Parse name (simple first/last split)
  const nameParts = params.referredName.trim().split(/\s+/);
  const firstName = nameParts[0] || params.referredName;
  const lastName = nameParts.slice(1).join(' ') || null;

  // 3. Normalize phone
  const phone = normalizePhone(params.referredPhone);
  if (!phone) {
    return { success: false, error: 'Invalid phone number' };
  }

  // 4. Create new patient
  const newPatient = await createPatient({
    practiceId: practice.id,
    phone,
    firstName,
    lastName: lastName || undefined,
    source: 'referral',
  });

  // 5. Update referral record
  await supabase
    .from('referrals')
    .update({
      referred_name: params.referredName,
      referred_phone: phone,
      status: 'contacted',
    })
    .eq('id', referral.id);

  // 6. Notify staff
  const referrerName = [referringPatient.first_name, referringPatient.last_name].filter(Boolean).join(' ') || 'Unknown';
  await notifyStaff(practice, {
    level: 'normal',
    reason: `New referral from ${referrerName}`,
    patientName: params.referredName,
    patientPhone: phone,
    message: `Referred by ${referrerName}. Submitted via referral link.`,
  });

  // 7. Log automation
  await logAutomation({
    practiceId: practice.id,
    patientId: newPatient.id,
    automationType: 'review',
    action: 'referral_submitted',
    result: 'triggered',
    metadata: {
      referralId: referral.id,
      referringPatientId: referringPatient.id,
      referrerName,
    },
  });

  console.log(`[referralService] Referral submission: ${params.referredName} → practice ${practice.name}`);

  return {
    success: true,
    newPatientId: newPatient.id,
    practiceId: practice.id,
    practiceName: practice.name,
  };
}

// Simple phone normalization (US numbers)
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith('+1')) return digits;
  return null;
}

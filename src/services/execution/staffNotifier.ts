import type { Practice, Patient } from '../../types/database';
import { sendSMS } from './smsService';

export type EscalationLevel = 'urgent' | 'normal';

export interface StaffNotification {
  level: EscalationLevel;
  reason: string;
  patientName: string;
  patientPhone: string;
  message: string;
  serviceContext?: string;
}

export async function notifyStaff(
  practice: Practice,
  notification: StaffNotification
): Promise<void> {
  const prefix = notification.level === 'urgent' ? '[URGENT]' : '[NEW LEAD]';
  const body = `${prefix} ${notification.patientName} (${notification.patientPhone}): ${notification.reason}. Message: "${truncate(notification.message, 100)}"`;

  // Notify via SMS to practice phone
  if (practice.phone) {
    await sendSMS(practice.phone, body, practice.twilio_phone || '');
    console.log(`[staffNotifier] Sent ${notification.level} notification to ${practice.phone}`);
  }

  // Also log to console for monitoring
  console.log(`[staffNotifier] ${prefix} Practice: ${practice.name}`);
  console.log(`  Patient: ${notification.patientName} (${notification.patientPhone})`);
  console.log(`  Reason: ${notification.reason}`);
  console.log(`  Message: ${notification.message}`);
  if (notification.serviceContext) {
    console.log(`  Service: ${notification.serviceContext}`);
  }
}

export async function notifyNewLead(
  practice: Practice,
  patient: Patient,
  inboundMessage: string,
  serviceContext?: string
): Promise<void> {
  await notifyStaff(practice, {
    level: 'normal',
    reason: 'New lead from speed-to-lead',
    patientName: patient.first_name || 'Unknown',
    patientPhone: patient.phone || 'No phone',
    message: inboundMessage,
    serviceContext,
  });
}

export async function notifyEscalation(
  practice: Practice,
  patient: Patient,
  escalationReason: string,
  inboundMessage: string
): Promise<void> {
  await notifyStaff(practice, {
    level: 'urgent',
    reason: escalationReason,
    patientName: patient.first_name || 'Unknown',
    patientPhone: patient.phone || 'No phone',
    message: inboundMessage,
  });
}

function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.substring(0, maxLen - 3) + '...';
}

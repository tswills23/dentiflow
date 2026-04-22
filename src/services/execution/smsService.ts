import twilio from 'twilio';
import { supabase } from '../../lib/supabase';
import type { Patient } from '../../types/database';

// Read lazily so dotenv has time to load regardless of import order
const getSmsLiveMode = () => process.env.SMS_LIVE_MODE === 'true';
// When set, ALL outbound SMS are blocked unless the recipient matches this number.
// Use during testing to guarantee no patient texts can go out.
const getAllowedPhone = () => process.env.TEST_MODE_ALLOWED_PHONE || null;
const COOLDOWN_MS = 10_000; // 10-second cooldown for testing (production: 60_000)

let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

// Track recent sends for cooldown
const recentSends = new Map<string, number>();

export interface SendResult {
  success: boolean;
  sid?: string;
  error?: string;
  simulated: boolean;
}

export async function sendSMS(
  to: string,
  body: string,
  fromNumber: string
): Promise<SendResult> {
  // Check cooldown
  const lastSend = recentSends.get(to);
  if (lastSend && Date.now() - lastSend < COOLDOWN_MS) {
    console.warn(`[smsService] Cooldown active for ${to}, skipping`);
    return { success: false, error: 'cooldown_active', simulated: false };
  }

  // Hard fence: if TEST_MODE_ALLOWED_PHONE is set, block all sends to other numbers
  const allowedPhone = getAllowedPhone();
  if (allowedPhone && to !== allowedPhone) {
    console.warn(`[smsService] BLOCKED — TEST_MODE_ALLOWED_PHONE is set. Refusing send to ${to}`);
    return { success: false, error: 'blocked_test_mode', simulated: false };
  }

  if (!getSmsLiveMode()) {
    console.log(`[smsService] SIMULATED SMS to ${to} from ${fromNumber}:`);
    console.log(`  Body: ${body}`);
    recentSends.set(to, Date.now());
    return { success: true, sid: `SIM_${Date.now()}`, simulated: true };
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });

    recentSends.set(to, Date.now());

    return {
      success: true,
      sid: message.sid,
      simulated: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Twilio error';
    console.error(`[smsService] Failed to send SMS to ${to}:`, msg);
    return { success: false, error: msg, simulated: false };
  }
}

export async function canSendToPatient(patient: Patient): Promise<boolean> {
  if (patient.status === 'inactive') {
    console.log(`[smsService] Patient ${patient.id} is inactive, cannot send`);
    return false;
  }
  if (!patient.phone) {
    console.log(`[smsService] Patient ${patient.id} has no phone number`);
    return false;
  }
  return true;
}

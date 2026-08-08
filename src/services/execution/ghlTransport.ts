// GoHighLevel SMS transport — Path A (GHL owns the phone number).
// -----------------------------------------------------------------------------
// Drop-in alternative to smsService.sendSMS(): SAME SendResult shape, so the
// recall engine, response validator, intent classifier, and reply handler stay
// byte-for-byte identical — only the wire changes. GHL is the pipe + reporting
// store; Dentiflow still decides WHETHER/WHEN/WHAT to send. Reply-safety logic
// NEVER moves to GHL (partner directive — see [[project_ghl_evaluation]]).
//
// SAFETY: mirrors smsService's two hard guards — SMS_LIVE_MODE simulate and the
// TEST_MODE_ALLOWED_PHONE fence — so switching transports can never bypass them.
//
// Verified GHL v2 endpoints (2026-07-13):
//   Upsert contact : POST https://services.leadconnectorhq.com/contacts/upsert
//                    { locationId, phone, firstName?, lastName? } -> { contact: { id } }
//   Send message   : POST https://services.leadconnectorhq.com/conversations/messages
//                    { type: 'SMS', contactId, message } -> { messageId, conversationId }
//   Auth           : Authorization: Bearer <Private Integration token>  +  Version header
//
// Private Integration Token = single-location (Village) start. Swap for an OAuth
// marketplace-app token later for multi-practice SaaS (same Bearer + endpoints).

import type { SendResult } from './smsService';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const DEFAULT_API_VERSION = '2021-04-15'; // confirm against the practice's GHL API version at setup

const getSmsLiveMode = () => process.env.SMS_LIVE_MODE === 'true';
const getAllowedPhones = (): string[] | null => {
  const val = process.env.TEST_MODE_ALLOWED_PHONE;
  if (!val) return null;
  return val.split(',').map((p) => p.trim()).filter(Boolean);
};

export interface GhlConfig {
  accessToken: string;   // Private Integration token or OAuth access token (Bearer)
  locationId: string;    // GHL sub-account (location) id
  apiVersion?: string;   // GHL Version header; defaults to DEFAULT_API_VERSION
}

// Single-practice config from env. Multi-practice: store per row like pms_integrations.
export function getGhlConfig(): GhlConfig {
  const accessToken = process.env.GHL_ACCESS_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!accessToken || !locationId) {
    throw new Error('[ghlTransport] Missing GHL_ACCESS_TOKEN or GHL_LOCATION_ID');
  }
  return { accessToken, locationId, apiVersion: process.env.GHL_API_VERSION || DEFAULT_API_VERSION };
}

function headers(config: GhlConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    Version: config.apiVersion || DEFAULT_API_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Resolve (create-or-update) a GHL contact by phone and return its contactId.
 * Sending a message requires a contactId, so this runs first.
 */
export async function upsertContact(
  phone: string,
  config: GhlConfig,
  name?: { firstName?: string; lastName?: string }
): Promise<string> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/upsert`, {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({
      locationId: config.locationId,
      phone,
      firstName: name?.firstName,
      lastName: name?.lastName,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[ghlTransport] upsert contact ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = text ? JSON.parse(text) : {};
  const contactId = data?.contact?.id || data?.id || data?.contactId;
  if (!contactId) {
    throw new Error(`[ghlTransport] upsert returned no contactId: ${text.slice(0, 200)}`);
  }
  return String(contactId);
}

/**
 * Send an SMS through GHL. Drop-in for smsService.sendSMS() — same SendResult.
 * `contactId` may be passed (e.g. from an inbound webhook) to skip the upsert.
 */
export async function sendViaGHL(
  to: string,
  body: string,
  opts: { config?: GhlConfig; contactId?: string; name?: { firstName?: string; lastName?: string } } = {}
): Promise<SendResult> {
  // Guard 1: hard test-phone fence (identical to smsService)
  const allowedPhones = getAllowedPhones();
  if (allowedPhones && !allowedPhones.includes(to)) {
    console.warn(`[ghlTransport] BLOCKED — TEST_MODE_ALLOWED_PHONE is set. Refusing send to ${to}`);
    return { success: false, error: 'blocked_test_mode', simulated: false };
  }

  // Guard 2: simulate unless SMS_LIVE_MODE (identical to smsService)
  if (!getSmsLiveMode()) {
    console.log(`[ghlTransport] SIMULATED GHL SMS to ${to}:`);
    console.log(`  Body: ${body}`);
    return { success: true, sid: `SIM_GHL_${Date.now()}`, simulated: true };
  }

  try {
    const config = opts.config || getGhlConfig();
    const contactId = opts.contactId || (await upsertContact(to, config, opts.name));

    const res = await fetch(`${GHL_BASE_URL}/conversations/messages`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({ type: 'SMS', contactId, message: body }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[ghlTransport] send ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = text ? JSON.parse(text) : {};
    return {
      success: true,
      sid: String(data?.messageId || data?.id || ''),
      simulated: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'GHL send error';
    console.error(`[ghlTransport] Failed to send to ${to}:`, msg);
    return { success: false, error: msg, simulated: false };
  }
}

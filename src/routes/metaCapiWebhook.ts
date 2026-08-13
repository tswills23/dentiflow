// Meta Conversions API — server-side `Schedule` event for the ads funnel.
//
// POST /webhooks/meta-capi?secret=<META_CAPI_SECRET>
//
// GHL calls this when a sales call is booked. The browser pixel on the
// thank-you page fires the same event; Meta de-duplicates on `event_id`,
// so both can run and only one conversion is counted. The server-side copy
// is what survives ad blockers and iOS tracking prevention.
//
// This is the ads funnel (Trevor's sales calls) — NOT patient appointments.

import { Router, type Request, type Response } from 'express';
import { createHash } from 'crypto';

const router = Router();

const GRAPH_VERSION = process.env.META_API_VERSION || 'v23.0';
const PIXEL_ID = process.env.META_PIXEL_ID;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || process.env.META_ACCESS_TOKEN;
const SECRET = process.env.META_CAPI_SECRET;

// Meta requires SHA-256 of normalized values. Empty in, empty out — sending
// a hash of "" would be a garbage match signal.
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

const hashEmail = (raw?: string) => {
  const v = (raw || '').trim().toLowerCase();
  return v ? sha(v) : undefined;
};

// E.164 digits, no plus. Bare 10-digit US numbers get a 1 prepended.
const hashPhone = (raw?: string) => {
  let v = (raw || '').replace(/\D/g, '');
  if (!v) return undefined;
  if (v.length === 10) v = '1' + v;
  return sha(v);
};

const hashName = (raw?: string) => {
  const v = (raw || '').trim().toLowerCase();
  return v ? sha(v) : undefined;
};

router.post('/', async (req: Request, res: Response) => {
  if (!SECRET || req.query.secret !== SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.error('[metaCapi] Missing META_PIXEL_ID or META_CAPI_TOKEN');
    res.status(500).json({ error: 'not configured' });
    return;
  }

  const b = req.body || {};

  // Only these two. An unrecognised name would be silently ignored by Meta and
  // we'd never know the server-side copy stopped arriving.
  const ALLOWED = ['Lead', 'Schedule'] as const;
  const eventName = String(b.event_name || 'Schedule');
  if (!ALLOWED.includes(eventName as (typeof ALLOWED)[number])) {
    res.status(400).json({ error: `event_name must be one of ${ALLOWED.join(', ')}` });
    return;
  }

  // GHL field names vary by workflow mapping, so accept the common aliases.
  const email = b.email || b.contact_email || b.Email;
  const phone = b.phone || b.contact_phone || b.Phone;
  const firstName = b.first_name || b.firstName;
  const lastName = b.last_name || b.lastName;

  if (!email && !phone) {
    console.warn('[metaCapi] No email or phone in payload — rejecting');
    res.status(400).json({ error: 'email or phone required for matching' });
    return;
  }

  // Must match the browser pixel's eventID for de-duplication. GHL should send
  // the appointment id; falling back to a time bucket still beats nothing.
  const eventId = String(
    b.event_id || b.appointment_id || b.appointmentId || `sched_${email || phone}_${Math.floor(Date.now() / 60000)}`
  );

  const userData: Record<string, unknown> = {
    em: hashEmail(email) ? [hashEmail(email)] : undefined,
    ph: hashPhone(phone) ? [hashPhone(phone)] : undefined,
    fn: hashName(firstName) ? [hashName(firstName)] : undefined,
    ln: hashName(lastName) ? [hashName(lastName)] : undefined,
    // fbc carries the ad click id — without it Meta attributes far more weakly.
    fbc: b.fbc || undefined,
    fbp: b.fbp || undefined,
    client_ip_address: b.client_ip_address || undefined,
    client_user_agent: b.client_user_agent || undefined,
  };
  Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: b.event_source_url || process.env.META_LANDING_URL,
        user_data: userData,
        // Lead carries the projected production so Meta can weight by value.
        custom_data: b.value ? { value: Number(b.value), currency: 'USD' } : undefined,
      },
    ],
    access_token: CAPI_TOKEN,
  };
  if (b.test_event_code || process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = b.test_event_code || process.env.META_TEST_EVENT_CODE;
  }

  try {
    const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = (await r.json()) as { events_received?: number; error?: unknown };

    if (!r.ok) {
      console.error('[metaCapi] Meta rejected event:', JSON.stringify(j));
      res.status(502).json({ error: 'meta rejected', detail: j });
      return;
    }

    console.log(`[metaCapi] ${eventName} sent — event_id=${eventId} received=${j.events_received}`);
    res.json({ ok: true, event_id: eventId, events_received: j.events_received });
  } catch (err) {
    console.error('[metaCapi] Send failed:', err);
    res.status(500).json({ error: 'send failed' });
  }
});

export default router;

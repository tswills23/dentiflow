// Verify the Meta `Schedule` event pipe end to end.
//
//   npx tsx scripts/meta-capi-test.ts --test-code TEST12345
//     → sends straight to Meta as a TEST event. Shows in Events Manager →
//       Test Events. Does NOT count as a conversion, does not pollute data.
//
//   npx tsx scripts/meta-capi-test.ts --test-code TEST12345 --via-webhook
//     → routes through the deployed /webhooks/meta-capi endpoint instead,
//       which is what GHL will actually call.
//
// Get the test code from Events Manager → your dataset → Test Events.
// Without --test-code this refuses to run: a live Schedule event would show
// up as a real booked call that never happened.

import 'dotenv/config';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

const testCode = arg('test-code');
const viaWebhook = has('via-webhook');

if (!testCode) {
  console.error('Refusing to send. Pass --test-code TEST12345 (Events Manager → Test Events).');
  console.error('A live Schedule event would register as a booked call that never happened.');
  process.exit(1);
}

const GRAPH_VERSION = process.env.META_API_VERSION || 'v23.0';
const PIXEL_ID = process.env.META_PIXEL_ID;
const TOKEN = process.env.META_CAPI_TOKEN || process.env.META_ACCESS_TOKEN;

const sample = {
  email: 'capi-test@dentiflow.ai',
  phone: '+15555550123',
  first_name: 'Test',
  last_name: 'Booking',
  event_id: `capi_test_${Date.now()}`,
  event_source_url: process.env.META_LANDING_URL,
  test_event_code: testCode,
};

async function main() {
  if (viaWebhook) {
    const base = process.env.BACKEND_URL;
    const secret = process.env.META_CAPI_SECRET;
    if (!base || !secret) {
      console.error('Need BACKEND_URL and META_CAPI_SECRET in .env for --via-webhook');
      process.exit(1);
    }
    const url = `${base.replace(/\/$/, '')}/webhooks/meta-capi?secret=${encodeURIComponent(secret)}`;
    console.log(`POST ${base.replace(/\/$/, '')}/webhooks/meta-capi`);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    });
    console.log(r.status, JSON.stringify(await r.json(), null, 2));
    return;
  }

  if (!PIXEL_ID || !TOKEN) {
    console.error('Need META_PIXEL_ID and META_ACCESS_TOKEN (or META_CAPI_TOKEN) in .env');
    process.exit(1);
  }

  const { createHash } = await import('crypto');
  const sha = (v: string) => createHash('sha256').update(v).digest('hex');

  const body = {
    data: [
      {
        event_name: 'Schedule',
        event_time: Math.floor(Date.now() / 1000),
        event_id: sample.event_id,
        action_source: 'website',
        event_source_url: sample.event_source_url,
        user_data: {
          em: [sha(sample.email.toLowerCase())],
          ph: [sha(sample.phone.replace(/\D/g, ''))],
          fn: [sha(sample.first_name.toLowerCase())],
          ln: [sha(sample.last_name.toLowerCase())],
        },
      },
    ],
    test_event_code: testCode,
    access_token: TOKEN,
  };

  console.log(`POST graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events  (test mode)`);
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  console.log(r.status, JSON.stringify(j, null, 2));

  if (r.ok && j.events_received === 1) {
    console.log('\nAccepted. Open Events Manager → Test Events — a Schedule row should appear within seconds.');
  }
}

main();

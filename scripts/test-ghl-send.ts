// Smoke test for the GHL SMS transport — the go/no-go on Path A.
//
//   npx tsx scripts/test-ghl-send.ts --to +15551234567
//   npx tsx scripts/test-ghl-send.ts --to +15551234567 --dry
//
// One real text to YOUR OWN phone. If it lands, it proves in a single shot:
// token valid, scopes correct, locationId correct, number provisioned, A2P live,
// and that we're hitting the SEND endpoint (not the log-only one).
//
// Requires in .env:  GHL_ACCESS_TOKEN, GHL_LOCATION_ID, SMS_LIVE_MODE=true
// Refuses to run without an explicit --to. Never point this at a patient.

import 'dotenv/config';
import { getGhlConfig, upsertContact, sendViaGHL } from '../src/services/execution/ghlTransport';

const args = process.argv.slice(2);
const to = args[args.indexOf('--to') + 1];
const dry = args.includes('--dry');

if (!args.includes('--to') || !to || !to.startsWith('+')) {
  console.error('ERROR: --to is required and must be E.164 (e.g. +15551234567).');
  process.exit(1);
}

async function main() {
  const config = getGhlConfig();
  const allowed = process.env.TEST_MODE_ALLOWED_PHONE;

  console.log('--- GHL transport smoke test ---');
  console.log(`  locationId            : ${config.locationId}`);
  console.log(`  apiVersion            : ${config.apiVersion}`);
  console.log(`  token                 : ${config.accessToken.slice(0, 8)}…`);
  console.log(`  SMS_LIVE_MODE         : ${process.env.SMS_LIVE_MODE}`);
  console.log(`  TEST_MODE_ALLOWED_PHONE: ${allowed || '(unset — no fence)'}`);
  console.log(`  target                : ${to}`);
  console.log('');

  if (!allowed) {
    console.warn('WARNING: TEST_MODE_ALLOWED_PHONE is unset, so the hard fence is OFF.');
    console.warn(`Set it to ${to} before running live tests.\n`);
  }

  // Step 1 — contact upsert. Failure here = token/scope/locationId problem.
  console.log('[1/2] Upserting contact…');
  const contactId = await upsertContact(to, config, { firstName: 'Dentiflow', lastName: 'Test' });
  console.log(`      contactId = ${contactId}`);

  if (dry) {
    console.log('\n--dry set: contact resolved, no message sent. Auth + scopes are good.');
    return;
  }

  // Step 2 — real send. Failure here = number/A2P/DND problem, not auth.
  console.log('[2/2] Sending SMS…');
  const result = await sendViaGHL(to, 'Dentiflow GHL transport test — reply OK if you got this.', {
    config,
    contactId,
  });

  console.log('');
  console.log(JSON.stringify(result, null, 2));

  if (result.simulated) {
    console.log('\nSIMULATED only (SMS_LIVE_MODE is not "true"). Nothing was sent.');
  } else if (result.success) {
    console.log('\nSENT. Check the phone, then check the GHL conversation thread.');
    console.log('If the thread shows the message but the phone never got it, the number/A2P is the problem.');
  } else {
    console.log(`\nFAILED: ${result.error}`);
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});

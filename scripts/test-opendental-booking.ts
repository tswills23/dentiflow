// Smoke test for the Open Dental booking adapter.
//
//   npx tsx scripts/test-opendental-booking.ts            # READ-ONLY: list slots
//   npx tsx scripts/test-opendental-booking.ts --book     # also create ONE test appt (writes to OD test DB)
//
// Uses Open Dental's PUBLIC test server + published test keys, so it runs today
// without our own developer key. Read (slots) is always safe. --book writes to
// Open Dental's shared test database only — never a real practice.

import { OpenDentalAdapter } from '../src/services/pms/adapters/openDental';
import type { PmsIntegration } from '../src/types/pms';

// Open Dental published TEST credentials (their hosted test server)
const TEST_INTEGRATION: PmsIntegration = {
  id: 'test',
  practice_id: 'test',
  pms_type: 'open_dental',
  client_id: 'NFF6i0KrXrxDkZHt',       // developer key (test)
  client_secret: 'VzkmZEaUWOjnQX2z',   // customer key (test)
  access_token: null,
  refresh_token: null,
  token_expires_at: null,
  api_base_url: null,                  // → defaults to https://api.opendental.com/api/v1
  webhook_secret: null,
  webhook_api_key: null,
  polling_enabled: false,
  polling_interval_minutes: 10,
  last_synced_at: null,
  sync_noshow: true,
  sync_complete: true,
  sync_cancelled: false,
  sync_rescheduled: false,
  active: true,
  last_error: null,
  error_count: 0,
  created_at: '',
  updated_at: '',
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const doBook = process.argv.includes('--book');
  const adapter = new OpenDentalAdapter();

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);

  console.log('=== Open Dental adapter smoke test ===');
  console.log(`Auth: ODFHIR ${TEST_INTEGRATION.client_id}/${TEST_INTEGRATION.client_secret}`);
  console.log(`Querying SlotsWebSched ${ymd(start)} → ${ymd(end)}\n`);

  const slots = await adapter.getAvailableSlots(TEST_INTEGRATION, {
    dateStart: ymd(start),
    dateEnd: ymd(end),
  });

  console.log(`✅ Auth + endpoint OK. ${slots.length} slot(s) returned.`);
  slots.slice(0, 5).forEach((s, i) => {
    console.log(`  [${i}] ${s.startTime} → ${s.endTime}  prov=${s.providerId} op=${s.operatoryId}`);
  });

  if (!doBook) {
    console.log('\n(Read-only. Pass --book to create one test appointment on the OD test DB.)');
    return;
  }

  if (slots.length === 0) {
    console.log('\nNo slots available to book — skipping create.');
    return;
  }

  console.log('\n--book set → creating ONE appointment on the Open Dental TEST database...');
  const result = await adapter.createAppointment(TEST_INTEGRATION, {
    pmsPatientId: '1', // PatNum 1 on the test DB
    slot: slots[0],
    note: 'Dentiflow adapter smoke test',
  });
  console.log(result.success ? '✅ Booked:' : '❌ Failed:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('❌ Smoke test error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env npx tsx
// Send the remaining Village round-2 Day-0 sequences (the household-duplicate
// patients that hit the 60s cooldown on the first run). runDay0Outreach picks
// up all active/Day-0/last_sent_at=null sequences for the location at 1/sec.
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { runDay0Outreach } from '../src/services/recall/outreachEngine';

const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  const r = await runDay0Outreach(PID, { location: 'Village Dental' });
  console.log('\n========== REMAINING SEND COMPLETE ==========');
  console.log(`Sent:    ${r.sent}`);
  console.log(`Skipped: ${r.skipped}`);
  console.log(`Failed:  ${r.failed}`);
  if (r.errors.length) { console.log('Errors:'); r.errors.slice(0, 15).forEach(e => console.log('  ' + e)); }
})();

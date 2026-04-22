import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { runDay0Outreach } from '../src/services/recall/outreachEngine';

runDay0Outreach('a3f04cf9-54aa-4bd6-939a-d0417c42d941', { location: 'Village Dental' })
  .then(r => {
    console.log(`Sent: ${r.sent} | Skipped: ${r.skipped} | Failed: ${r.failed}`);
    r.errors.forEach(e => console.log('ERROR:', e));
  })
  .catch(console.error);

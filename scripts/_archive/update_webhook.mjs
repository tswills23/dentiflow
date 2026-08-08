import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const SERVICE_SID = 'MGbaf27c37d80f0b60e749699f45e8908d';
const tunnelUrl = process.argv[2];
if (!tunnelUrl) {
  console.error('Usage: node scripts/update_webhook.mjs <tunnel-url>');
  console.error('  e.g. node scripts/update_webhook.mjs https://abc-def.trycloudflare.com');
  process.exit(1);
}
const WEBHOOK_URL = tunnelUrl.replace(/\/$/, '') + '/webhooks/sms';

console.log(`Setting inbound URL on messaging service to: ${WEBHOOK_URL}`);

const updated = await client.messaging.v1.services(SERVICE_SID).update({
  inboundRequestUrl: WEBHOOK_URL,
  inboundMethod: 'POST',
});

console.log(`Done! Inbound URL: ${updated.inboundRequestUrl}`);

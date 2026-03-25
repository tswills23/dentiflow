import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const SERVICE_SID = 'MGbaf27c37d80f0b60e749699f45e8908d';
const WEBHOOK_URL = 'https://identifier-emacs-matter-brochure.trycloudflare.com/webhooks/sms';

console.log(`Setting inbound URL on messaging service to: ${WEBHOOK_URL}`);

const updated = await client.messaging.v1.services(SERVICE_SID).update({
  inboundRequestUrl: WEBHOOK_URL,
  inboundMethod: 'POST',
});

console.log(`Done! Inbound URL: ${updated.inboundRequestUrl}`);
console.log(`Inbound Method: ${updated.inboundMethod}`);

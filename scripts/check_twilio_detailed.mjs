import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Check if there's a messaging service assigned
console.log('=== Incoming Phone Numbers ===');
const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: '+18333486593' });
for (const n of numbers) {
  console.log(`Phone: ${n.phoneNumber}`);
  console.log(`SID: ${n.sid}`);
  console.log(`SMS URL: ${n.smsUrl}`);
  console.log(`SMS Method: ${n.smsMethod}`);
  console.log(`SMS Fallback URL: ${n.smsFallbackUrl}`);
  console.log(`Status Callback: ${n.statusCallback}`);
  console.log('');
}

// Check messaging services
console.log('=== Messaging Services ===');
try {
  const services = await client.messaging.v1.services.list({ limit: 10 });
  if (services.length === 0) {
    console.log('No messaging services found.');
  } else {
    for (const s of services) {
      console.log(`Service: ${s.friendlyName} (${s.sid})`);
      console.log(`  Inbound URL: ${s.inboundRequestUrl}`);
      console.log(`  Inbound Method: ${s.inboundMethod}`);
      console.log(`  Fallback URL: ${s.fallbackUrl}`);

      // Check phone numbers in this service
      const phoneNumbers = await client.messaging.v1.services(s.sid).phoneNumbers.list();
      for (const pn of phoneNumbers) {
        console.log(`  Phone in service: ${pn.phoneNumber} (${pn.sid})`);
      }
    }
  }
} catch (e) {
  console.log('Error checking messaging services:', e.message);
}

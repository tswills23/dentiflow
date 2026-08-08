import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Check recent inbound messages
console.log('=== Recent Inbound Messages ===');
const messages = await client.messages.list({
  to: '+18333486593',
  limit: 5,
});

if (messages.length === 0) {
  console.log('No inbound messages found to this number.');
} else {
  for (const m of messages) {
    console.log(`From: ${m.from} | Status: ${m.status} | Date: ${m.dateSent}`);
    console.log(`  Body: ${m.body?.substring(0, 80)}`);
    console.log(`  Error: ${m.errorCode || 'none'} ${m.errorMessage || ''}`);
    console.log('');
  }
}

// Check the phone number's config
console.log('=== Phone Number Config ===');
const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: '+18333486593' });
if (numbers.length === 0) {
  console.log('Phone number +18333486593 NOT found in this account!');
} else {
  const num = numbers[0];
  console.log(`Number: ${num.phoneNumber}`);
  console.log(`SMS URL: ${num.smsUrl}`);
  console.log(`SMS Method: ${num.smsMethod}`);
  console.log(`Friendly Name: ${num.friendlyName}`);
}

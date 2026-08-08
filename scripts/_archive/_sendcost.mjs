import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Pull all outbound messages since R1 launch
const msgs = await client.messages.list({
  dateSentAfter: new Date('2026-05-11T00:00:00Z'),
  limit: 5000,
});

let r1 = 0, r2 = 0, total = 0, counted = 0, nullprice = 0;
const byDay = {};
for (const m of msgs) {
  if (m.direction && m.direction.startsWith('inbound')) continue; // outbound only
  const price = m.price ? Math.abs(parseFloat(m.price)) : null;
  const d = m.dateSent ? new Date(m.dateSent) : null;
  if (price === null) { nullprice++; continue; }
  counted++;
  total += price;
  const day = d ? d.toISOString().slice(0,10) : 'unknown';
  byDay[day] = (byDay[day] || 0) + price;
  // R1 window: 5/12-5/20, R2 window: 6/3-6/12
  if (d >= new Date('2026-05-11') && d < new Date('2026-05-28')) r1 += price;
  else if (d >= new Date('2026-05-28')) r2 += price;
}

console.log('Outbound messages counted:', counted, '| null-price (not yet billed):', nullprice);
console.log('--- by day ---');
for (const day of Object.keys(byDay).sort()) console.log(day, '$' + byDay[day].toFixed(2));
console.log('--- totals ---');
console.log('R1 window (≤5/27):  $' + r1.toFixed(2));
console.log('R2 window (≥5/28):  $' + r2.toFixed(2));
console.log('COMBINED outbound:  $' + total.toFixed(2));

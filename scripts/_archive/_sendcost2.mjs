import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const msgs = await client.messages.list({ dateSentAfter: new Date('2026-05-11T00:00:00Z'), limit: 5000 });

let r1c=0,r2c=0, r1$=0,r2$=0, inb=0;
const dirCount = {};
for (const m of msgs) {
  dirCount[m.direction] = (dirCount[m.direction]||0)+1;
  if (m.direction && m.direction.startsWith('inbound')) { inb++; continue; }
  const price = m.price ? Math.abs(parseFloat(m.price)) : 0;
  const d = new Date(m.dateSent);
  if (d < new Date('2026-05-28')) { r1c++; r1$+=price; }
  else { r2c++; r2$+=price; }
}
console.log('direction breakdown:', dirCount);
console.log(`R1 window outbound msgs: ${r1c}  ($${r1$.toFixed(2)})`);
console.log(`R2 window outbound msgs: ${r2c}  ($${r2$.toFixed(2)})`);
console.log(`TOTAL outbound: ${r1c+r2c}  ($${(r1$+r2$).toFixed(2)})`);
console.log(`inbound (not counted): ${inb}`);

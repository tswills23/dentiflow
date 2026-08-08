import https from 'https';
import fs from 'fs';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = '+18333486593';

function twilioGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const options = { hostname: 'api.twilio.com', path, method: 'GET', headers: { 'Authorization': auth } };
    let data = '';
    const req = https.request(options, res => { res.on('data', (c: any) => data += c); res.on('end', () => resolve(JSON.parse(data))); });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get first page of outbound only
  const result = await twilioGet(`/2010-04-01/Accounts/${accountSid}/Messages.json?From=${encodeURIComponent(fromNumber)}&PageSize=20`);
  const lines: string[] = [];
  for (const m of result.messages || []) {
    lines.push(`${m.date_sent} | ${m.status} | ${(m.body||'').slice(0,120)}`);
  }
  const out = lines.join('\n');
  fs.writeFileSync('C:/Users/tswil/Downloads/outbound-sample.txt', out);
  process.stdout.write(out + '\n');
}
main().catch(e => process.stdout.write(String(e)+'\n'));

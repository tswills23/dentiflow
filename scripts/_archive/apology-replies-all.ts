import https from 'https';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = '+18333486593';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
  let outbound: any[] = [];
  let page: string | null = `/2010-04-01/Accounts/${accountSid}/Messages.json?From=${encodeURIComponent(fromNumber)}&PageSize=100`;
  while (page) {
    const result = await twilioGet(page);
    if (result.messages) outbound.push(...result.messages);
    page = result.next_page_uri || null;
    if (page) await new Promise(r => setTimeout(r, 300));
  }

  const apologyMsgs = outbound.filter(m => {
    const body = (m.body || '').toLowerCase();
    return body.includes('apolog') || body.includes('sorry') || body.includes('mistake') || body.includes('unintended') || body.includes('accident');
  });

  const apologyTimes = apologyMsgs.map(m => new Date(m.date_sent).getTime());
  const firstApology = new Date(Math.min(...apologyTimes));
  const apologizedPhones = new Set(apologyMsgs.map(m => m.to));

  let inbound: any[] = [];
  page = `/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(fromNumber)}&PageSize=100`;
  while (page) {
    const result = await twilioGet(page);
    if (result.messages) inbound.push(...result.messages);
    page = result.next_page_uri || null;
    if (page) await new Promise(r => setTimeout(r, 300));
  }

  const replies = inbound
    .filter(m => apologizedPhones.has(m.from) && new Date(m.date_sent).getTime() >= firstApology.getTime())
    .sort((a, b) => new Date(a.date_sent).getTime() - new Date(b.date_sent).getTime());

  const phones = [...new Set(replies.map(m => m.from))];
  const { data: patients } = await supabase
    .from('patients')
    .select('phone, first_name, last_name, location')
    .in('phone', phones);
  const patientMap = new Map((patients || []).map((p: any) => [p.phone, p]));

  const lines: string[] = [`Total replies: ${replies.length}\n`];
  for (const m of replies) {
    const p: any = patientMap.get(m.from) || {};
    const name = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : '(unknown)';
    const loc = p.location || '(unknown)';
    const time = new Date(m.date_sent).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
    lines.push(`${time} | ${name} | ${loc} | ${m.body.replace(/\n/g,' ')}`);
  }

  const out = lines.join('\n');
  fs.writeFileSync('C:/Users/tswil/Downloads/apology-all-replies.txt', out);
  process.stdout.write(out + '\n');
}

main().catch(e => { fs.writeFileSync('C:/Users/tswil/Downloads/apology-replies-error.txt', String(e)); });

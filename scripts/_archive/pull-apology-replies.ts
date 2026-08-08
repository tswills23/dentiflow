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
    const options = {
      hostname: 'api.twilio.com',
      path,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    };
    let data = '';
    const req = https.request(options, res => {
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  let messages: any[] = [];
  let page: string | null = `/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(fromNumber)}&PageSize=100`;
  while (page) {
    const result = await twilioGet(page);
    if (result.messages) messages.push(...result.messages);
    page = result.next_page_uri || null;
    if (page) await new Promise(r => setTimeout(r, 300));
  }
  console.log(`Total inbound: ${messages.length}`);

  // Dedup by phone (keep latest)
  const byPhone = new Map<string, any>();
  for (const m of messages) {
    if (!byPhone.has(m.from) || new Date(m.date_sent) > new Date(byPhone.get(m.from).date_sent)) {
      byPhone.set(m.from, m);
    }
  }
  const deduped = [...byPhone.values()];

  const STOP = ['stop','unsubscribe','cancel','quit','end','opt out','opt-out','remove me','do not text','dont text',"don't text",'no more','please stop'];
  const WRONG = ['wrong number','wrong person','not my','who is this','who are you','what is this',"don't know",'no idea',"don't have",'no patient'];
  const SWITCHED = ['switched','different dentist','new dentist','not returning',"won't be returning",'not coming back'];
  const POSITIVE = ['yes','yeah','yep','sure','ok','okay','interested','book','appoint','schedule','available','when','how','call back','still need','still want','cleaning','come in','time','date','slot','monday','tuesday','wednesday','thursday','friday','morning','afternoon','thanks','thank you','appreciate','sounds good','great','perfect','works for me','can i','would like','need to make','i need','can you'];

  const positive: any[] = [];
  for (const m of deduped) {
    const body = (m.body || '').toLowerCase().trim();
    if (STOP.some(k => body.includes(k))) continue;
    if (WRONG.some(k => body.includes(k))) continue;
    if (SWITCHED.some(k => body.includes(k))) continue;
    if (POSITIVE.some(k => body.includes(k))) positive.push(m);
  }

  // Lookup names
  const phones = positive.map((m: any) => m.from);
  const { data: patients } = await supabase
    .from('patients')
    .select('phone, first_name, last_name, location')
    .in('phone', phones);
  const patientMap = new Map((patients || []).map((p: any) => [p.phone, p]));

  console.log(`\n=== POSITIVE REPLIES (${positive.length}) ===\n`);
  const rows = ['phone,first_name,last_name,location,message,date'];
  for (const m of positive.sort((a: any, b: any) => new Date(b.date_sent).getTime() - new Date(a.date_sent).getTime())) {
    const p: any = patientMap.get(m.from) || {};
    const name = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : '(unknown)';
    const loc = p.location || '(unknown)';
    console.log(`${m.from} | ${name} | ${loc}`);
    console.log(`  "${m.body.replace(/\n/g,' ')}"\n`);
    const body = m.body.replace(/"/g,'""').replace(/\n/g,' ');
    rows.push(`"${m.from}","${p.first_name||''}","${p.last_name||''}","${loc}","${body}","${m.date_sent}"`);
  }

  const outPath = 'C:/Users/tswil/Downloads/apology-positive-replies.csv';
  fs.writeFileSync(outPath, rows.join('\n'));
  console.log(`\nSaved ${positive.length} rows → ${outPath}`);
}

main().catch(console.error);

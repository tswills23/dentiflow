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
    const options = { hostname: 'api.twilio.com', path, method: 'GET', headers: { 'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` } };
    let data = '';
    const req = https.request(options, res => { res.on('data', (c: any) => data += c); res.on('end', () => resolve(JSON.parse(data))); });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // First: find the time window of the apology send by looking at outbound messages with apology content
  // Pull outbound messages from today
  let outbound: any[] = [];
  let page: string | null = `/2010-04-01/Accounts/${accountSid}/Messages.json?From=${encodeURIComponent(fromNumber)}&PageSize=100`;
  while (page) {
    const result = await twilioGet(page);
    if (result.messages) outbound.push(...result.messages);
    page = result.next_page_uri || null;
    if (page) await new Promise(r => setTimeout(r, 300));
  }

  // Find apology messages (contain apology text)
  const apologyMsgs = outbound.filter(m => {
    const body = (m.body || '').toLowerCase();
    return body.includes('apolog') || body.includes('sorry') || body.includes('mistake') || body.includes('unintended') || body.includes('accident');
  });

  if (apologyMsgs.length === 0) {
    console.log('No apology messages found in outbound. Showing all outbound sample:');
    outbound.slice(0, 3).forEach(m => console.log(m.date_sent, m.body?.slice(0,80)));
    return;
  }

  const apologyTimes = apologyMsgs.map(m => new Date(m.date_sent).getTime());
  const firstApology = new Date(Math.min(...apologyTimes));
  const lastApology = new Date(Math.max(...apologyTimes));
  console.log(`Apology send window: ${firstApology.toISOString()} → ${lastApology.toISOString()}`);
  console.log(`Total apology messages sent: ${apologyMsgs.length}`);

  // Get phones apology was sent to
  const apologizedPhones = new Set(apologyMsgs.map(m => m.to));
  console.log(`Unique phones apologized: ${apologizedPhones.size}`);

  // Pull inbound messages AFTER the first apology was sent, FROM those phones only
  let inbound: any[] = [];
  page = `/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(fromNumber)}&PageSize=100`;
  while (page) {
    const result = await twilioGet(page);
    if (result.messages) inbound.push(...result.messages);
    page = result.next_page_uri || null;
    if (page) await new Promise(r => setTimeout(r, 300));
  }

  // Filter: from an apologized phone, sent after first apology
  const replies = inbound.filter(m => {
    const sentTime = new Date(m.date_sent).getTime();
    return apologizedPhones.has(m.from) && sentTime >= firstApology.getTime();
  });

  console.log(`\nReplies to apology texts: ${replies.length}`);

  // Lookup names
  const phones = [...new Set(replies.map(m => m.from))];
  const { data: patients } = await supabase
    .from('patients')
    .select('phone, first_name, last_name, location')
    .in('phone', phones);
  const patientMap = new Map((patients || []).map((p: any) => [p.phone, p]));

  // Classify
  const POSITIVE = ['yes','yeah','yep','sure','ok','okay','interested','book','appoint','schedule','available','when','how','call back','still need','still want','cleaning','come in','time','date','slot','monday','tuesday','wednesday','thursday','friday','morning','afternoon','thanks','thank you','appreciate','sounds good','great','perfect','works for me','can i','would like','need to make','i need','can you','sorry','received','got it'];
  const STOP = ['stop','unsubscribe','cancel','quit','end','opt out','opt-out','remove me','do not text','dont text',"don't text",'no more','please stop'];
  const WRONG = ['wrong number','wrong person','not my','who is this','who are you','what is this'];
  const SWITCHED = ['switched','different dentist','new dentist','not returning',"won't be returning",'not coming back'];

  const buckets: Record<string, any[]> = { positive: [], stop: [], wrong: [], switched: [], other: [] };
  for (const m of replies) {
    const body = (m.body || '').toLowerCase().trim();
    if (STOP.some(k => body.includes(k))) { buckets.stop.push(m); continue; }
    if (WRONG.some(k => body.includes(k))) { buckets.wrong.push(m); continue; }
    if (SWITCHED.some(k => body.includes(k))) { buckets.switched.push(m); continue; }
    if (POSITIVE.some(k => body.includes(k))) { buckets.positive.push(m); continue; }
    buckets.other.push(m);
  }

  console.log(`\nPositive: ${buckets.positive.length} | STOP: ${buckets.stop.length} | Wrong#: ${buckets.wrong.length} | Switched: ${buckets.switched.length} | Other: ${buckets.other.length}`);

  console.log(`\n=== POSITIVE REPLIES (${buckets.positive.length}) ===\n`);
  const rows = ['phone,first_name,last_name,location,message,date'];
  for (const m of buckets.positive.sort((a: any, b: any) => new Date(b.date_sent).getTime() - new Date(a.date_sent).getTime())) {
    const p: any = patientMap.get(m.from) || {};
    const name = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : '(unknown)';
    const loc = p.location || '(unknown)';
    console.log(`${m.from} | ${name} | ${loc}`);
    console.log(`  "${m.body.replace(/\n/g,' ')}"\n`);
    const body = m.body.replace(/"/g,'""').replace(/\n/g,' ');
    rows.push(`"${m.from}","${p.first_name||''}","${p.last_name||''}","${loc}","${body}","${m.date_sent}"`);
  }

  fs.writeFileSync('C:/Users/tswil/Downloads/apology-replies-positive.csv', rows.join('\n'));
  console.log(`Saved → C:/Users/tswil/Downloads/apology-replies-positive.csv`);
}

main().catch(console.error);

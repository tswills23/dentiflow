import { createClient } from '@supabase/supabase-js';
import { selectTemplate, getTemplateId, renderTemplate } from '../src/services/recall/templates';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PRACTICE = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  // Railway deploy status
  console.log('--- Railway deploy check ---');
  // (skip — already verified earlier)

  // Active Arm A sequences
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('id, patient_id, assigned_voice, sequence_day, next_send_at, experiment_arm')
    .eq('experiment_arm', 'control_voice')
    .eq('sequence_status', 'active')
    .limit(500);
  if (!seqs) return;
  console.log(`\nActive Arm A sequences: ${seqs.length}`);

  // Voice distribution
  const byVoice: Record<string, number> = {};
  seqs.forEach(s => { byVoice[s.assigned_voice] = (byVoice[s.assigned_voice] || 0) + 1; });
  console.log('Voice distribution:', byVoice);

  // Verify template routing for one of each voice
  const samples: Record<string, string> = {};
  for (const voice of ['office','hygienist','doctor']) {
    const sample = seqs.find(s => s.assigned_voice === voice);
    if (!sample) continue;
    const { data: pat } = await sb.from('patients').select('first_name, phone, location').eq('id', sample.patient_id).single();
    if (!pat) continue;
    const tpl = selectTemplate(voice as any, 3, pat.phone, 'control_voice');
    const tplId = getTemplateId(voice as any, 3, pat.phone, 'control_voice');
    const rendered = renderTemplate(tpl, pat.first_name || 'there', pat.location || 'Village Dental', 'Philip', 'hygiene team', 'https://dentiflow-production.up.railway.app/r/<token>');
    console.log(`\n[${voice} → Day 3, templateId=${tplId}]`);
    console.log(rendered);
  }

  // Twilio balance via env or quick API check
  console.log('\n--- Twilio balance ---');
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  if (sid && tok) {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64') }
    });
    const j = await r.json();
    console.log(`Balance: $${j.balance} ${j.currency}`);
  }

  // next_send_at distribution (when will cron pick them up)
  const nextWindows: Record<string, number> = {};
  seqs.forEach(s => {
    const k = s.next_send_at ? s.next_send_at.slice(11,16) : 'null';
    nextWindows[k] = (nextWindows[k] || 0) + 1;
  });
  console.log('\nnext_send_at (UTC hour:min):', nextWindows);
}
main().catch(e => { console.error(e); process.exit(1); });

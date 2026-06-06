import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';
const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

(async () => {
  // Pull all 48 Arm A clickers + their last send before click
  const { data: seqs } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, link_clicked_at, last_sent_at, booking_stage, reply_count')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'control_voice')
    .not('link_clicked_at','is',null);
  if (!seqs) return;

  console.log(`Total Arm A clickers: ${seqs.length}\n`);

  // For each, find the outbound message immediately before the click
  const rows: any[] = [];
  for (const s of seqs) {
    const clickT = new Date(s.link_clicked_at!).getTime();
    const { data: msgs } = await supabase
      .from('conversations')
      .select('created_at, message_body, direction')
      .eq('patient_id', s.patient_id)
      .eq('direction','outbound')
      .lte('created_at', s.link_clicked_at!)
      .order('created_at', { ascending: false })
      .limit(1);
    const sentT = msgs?.[0]?.created_at ? new Date(msgs[0].created_at).getTime() : null;
    const delaySec = sentT ? Math.round((clickT - sentT)/1000) : null;
    rows.push({
      seq: s.id.slice(0,8),
      click_at: s.link_clicked_at,
      sent_at: msgs?.[0]?.created_at,
      delay_sec: delaySec,
      reply_count: s.reply_count,
      stage: s.booking_stage,
    });
  }

  // Sort by delay
  rows.sort((a,b) => (a.delay_sec ?? 999999) - (b.delay_sec ?? 999999));

  console.log('Click delay from last send (sorted):');
  console.log('seq      delay     click_time              replies stage');
  for (const r of rows) {
    const d = r.delay_sec;
    const dStr = d === null ? 'no-send' : d < 60 ? `${d}s ⚠️BOT?` : d < 300 ? `${d}s` : d < 3600 ? `${Math.round(d/60)}m` : `${(d/3600).toFixed(1)}h`;
    console.log(`${r.seq}  ${dStr.padEnd(10)} ${r.click_at}  ${r.reply_count}      ${r.stage}`);
  }

  // Summary buckets
  const buckets = { '0-10s (bot)': 0, '10-60s (bot-likely)': 0, '1-5min (fast human)': 0, '5min-1h (human)': 0, '1h+ (delayed human)': 0, 'no-send': 0 };
  for (const r of rows) {
    const d = r.delay_sec;
    if (d === null) buckets['no-send']++;
    else if (d < 10) buckets['0-10s (bot)']++;
    else if (d < 60) buckets['10-60s (bot-likely)']++;
    else if (d < 300) buckets['1-5min (fast human)']++;
    else if (d < 3600) buckets['5min-1h (human)']++;
    else buckets['1h+ (delayed human)']++;
  }
  console.log('\nBuckets:');
  for (const [k,v] of Object.entries(buckets)) console.log(`  ${k}: ${v}`);
})();

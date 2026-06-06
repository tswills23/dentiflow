// Pull representative SMS threads from the A/B test for use in the case study.
// Selects 1 thread per category from Arm A (control_voice / 3-voice):
//   - BOOKED (booking_stage = S6_COMPLETED)
//   - DECLINED (exit_reason or end stage = EXIT_DECLINED)
//   - OPTED OUT (exit_reason or end stage = EXIT_OPT_OUT)
//
// Anonymizes patient first name + phone before writing to disk.
// Output: docs/case-study-1-sms-threads.md

import dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

type Direction = 'inbound' | 'outbound';
type Msg = {
  direction: Direction;
  message_body: string;
  created_at: string;
};

function anonPhone(_p: string): string { return '(***) ***-XXXX'; }
function anonName(_n: string): string { return 'Patient'; }

function fmtTime(iso: string): string {
  const d = new Date(iso);
  // Local-ish format for the case study: "Tue 10:42 AM"
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function maskBody(body: string, firstName: string): string {
  if (!firstName) return body;
  // Replace patient first name occurrences with "Patient"
  const re = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return body.replace(re, anonName(firstName));
}

async function main(): Promise<void> {
  // 1) Pull all Arm A sequences with their categorization
  const { data: seqs, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, booking_stage, exit_reason, created_at')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'control_voice');
  if (seqErr) { console.error('seq err:', seqErr.message); process.exit(1); }
  if (!seqs?.length) { console.error('no sequences found'); process.exit(1); }

  // 2) Bucket by category
  const booked = seqs.filter(s => s.booking_stage === 'S6_COMPLETED');
  const declined = seqs.filter(s => s.booking_stage === 'EXIT_DECLINED' || s.exit_reason === 'declined');
  const optedOut = seqs.filter(s => s.booking_stage === 'EXIT_OPT_OUT' || s.exit_reason === 'opted_out');

  console.log(`Found ${booked.length} booked, ${declined.length} declined, ${optedOut.length} opted out`);

  // 3) For each bucket, find a sequence with the richest conversation (most messages)
  type Candidate = { seqId: string; patientId: string; createdAt: string; msgs: Msg[]; patientFirst: string; patientLast: string; patientPhone: string };

  async function getMessages(patientId: string): Promise<Msg[]> {
    const { data } = await supabase
      .from('conversations')
      .select('direction, message_body, created_at')
      .eq('patient_id', patientId)
      .eq('practice_id', PRACTICE_ID)
      .order('created_at', { ascending: true });
    return (data || []) as Msg[];
  }

  async function getPatient(patientId: string) {
    const { data } = await supabase
      .from('patients')
      .select('first_name, last_name, phone')
      .eq('id', patientId)
      .single();
    return data || { first_name: '', last_name: '', phone: '' };
  }

  async function bestCandidate(bucket: typeof seqs): Promise<Candidate | null> {
    let best: Candidate | null = null;
    for (const s of bucket) {
      const msgs = await getMessages(s.patient_id);
      if (!msgs.length) continue;
      if (!best || msgs.length > best.msgs.length) {
        const pat = await getPatient(s.patient_id);
        best = {
          seqId: s.id,
          patientId: s.patient_id,
          createdAt: s.created_at,
          msgs,
          patientFirst: pat.first_name || '',
          patientLast: pat.last_name || '',
          patientPhone: pat.phone || '',
        };
      }
    }
    return best;
  }

  const bookedCandidate = await bestCandidate(booked);
  const declinedCandidate = await bestCandidate(declined);
  const optedOutCandidate = await bestCandidate(optedOut);

  // 4) Render to markdown
  function renderThread(label: string, c: Candidate | null): string {
    if (!c) return `## ${label}\n\n*No matching thread with conversation data found.*\n\n`;
    let out = `## ${label}\n\n`;
    out += `**Patient:** ${anonName(c.patientFirst)} (${anonPhone(c.patientPhone)})  \n`;
    out += `**Sequence ID:** \`${c.seqId.slice(0, 8)}...\`  \n`;
    out += `**Sequence started:** ${fmtTime(c.createdAt)}  \n`;
    out += `**Messages exchanged:** ${c.msgs.length}\n\n`;
    out += '```\n';
    for (const m of c.msgs) {
      const ts = fmtTime(m.created_at);
      const who = m.direction === 'outbound' ? '32 Dental →' : '← Patient';
      const body = maskBody(m.message_body || '', c.patientFirst).trim();
      out += `[${ts}]  ${who}\n${body}\n\n`;
    }
    out += '```\n\n';
    return out;
  }

  const today = new Date().toISOString().slice(0, 10);
  let md = `# Case Study #1 — Real SMS Conversation Threads\n\n`;
  md += `**Source:** Village Dental A/B test, Arm A (3-voice sequence). Launched 2026-05-12.\n`;
  md += `**Pulled:** ${today}\n`;
  md += `**Anonymization:** Patient first names → "Patient". Phone numbers → "(***) ***-XXXX".\n`;
  md += `**Use:** Embed in case study screen recording (sections 1:30–7:00). Show real conversation flow.\n\n`;
  md += `---\n\n`;
  md += renderThread('Thread 1 — Booked (S6_COMPLETED)', bookedCandidate);
  md += renderThread('Thread 2 — Declined (EXIT_DECLINED)', declinedCandidate);
  md += renderThread('Thread 3 — Opted Out (EXIT_OPT_OUT)', optedOutCandidate);

  const outPath = resolve(__dirname, '..', 'docs', 'case-study-1-sms-threads.md');
  writeFileSync(outPath, md, 'utf8');
  console.log(`\nWrote ${outPath}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

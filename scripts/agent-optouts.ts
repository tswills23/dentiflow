#!/usr/bin/env npx tsx
// Opt-out / decline post-mortem for the 2026-05-12 A/B recall test.
// Read-only. Pulls recall_sequences with exit_reason in ('opted_out','declined')
// or sequence_status='opted_out', joins the actual sms_messages thread, and
// reports timing, last outbound template, quoted opt-out text, voice mix,
// overdue-bucket mix.

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LAUNCH = new Date('2026-05-12T00:00:00Z');

type Seq = {
  id: string;
  patient_id: string;
  experiment_arm: string | null;
  assigned_voice: string | null;
  months_overdue: number | null;
  sequence_status: string;
  exit_reason: string | null;
  updated_at: string | null;
  created_at: string;
  booking_stage: string | null;
};

type Msg = {
  id: string;
  patient_id: string;
  direction: string;
  message_body: string | null;
  metadata: any;
  automation_type: string | null;
  created_at: string;
};
function tplOf(m: Msg | null): string {
  if (!m) return '';
  const md = m.metadata || {};
  return md.template_id || md.templateId || md.recall_template_id || md.template || (m.automation_type || '');
}

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  last_visit_date: string | null;
};

function dayOfSequence(seq: Seq, msgCreatedAt: string): string {
  const created = new Date(seq.created_at).getTime();
  const at = new Date(msgCreatedAt).getTime();
  const days = (at - created) / 86400000;
  if (days < 0.9) return 'Day0';
  if (days < 2.5) return 'Day1';
  if (days < 5.5) return 'Day3';
  return `Day${days.toFixed(1)}`;
}

function overdueBucket(m: number | null): string {
  if (m == null) return 'unknown';
  if (m < 6) return '<6mo';
  if (m < 9) return '6-9mo';
  if (m < 12) return '9-12mo';
  if (m < 18) return '12-18mo';
  if (m < 24) return '18-24mo';
  return '24mo+';
}

async function main() {
  const { data: seqsRaw, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, assigned_voice, months_overdue, sequence_status, exit_reason, updated_at, created_at, booking_stage')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  if (seqErr) throw seqErr;
  const seqs = (seqsRaw || []) as Seq[];

  // Pull opt_out flag too
  const { data: optRaw } = await supabase
    .from('recall_sequences')
    .select('id, opt_out')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only'])
    .eq('opt_out', true);
  const optOutIds = new Set((optRaw || []).map((r: any) => r.id));

  const flagged = seqs.filter(s =>
    s.exit_reason === 'opted_out' ||
    s.exit_reason === 'declined' ||
    s.sequence_status === 'opted_out' ||
    s.sequence_status === 'declined' ||
    optOutIds.has(s.id)
  );
  console.log(`opt_out=true rows: ${optOutIds.size}`);
  console.log(`exit_reason breakdown:`, seqs.reduce((acc: any, s) => { const k = s.exit_reason || 'null'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}));
  console.log(`sequence_status breakdown:`, seqs.reduce((acc: any, s) => { const k = s.sequence_status || 'null'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}));

  console.log(`\nTotal A/B sequences: ${seqs.length}`);
  console.log(`Flagged (opted_out OR declined): ${flagged.length}\n`);

  const patientIds = flagged.map(s => s.patient_id);
  const patientsById = new Map<string, Patient>();
  for (let i = 0; i < patientIds.length; i += 50) {
    const chunk = patientIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, last_visit_date')
      .in('id', chunk);
    if (error) throw error;
    for (const p of (data || []) as Patient[]) patientsById.set(p.id, p);
  }

  const msgsByPatient = new Map<string, Msg[]>();
  for (let i = 0; i < patientIds.length; i += 50) {
    const chunk = patientIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('conversations')
      .select('id, patient_id, direction, message_body, metadata, automation_type, created_at')
      .in('patient_id', chunk)
      .gte('created_at', LAUNCH.toISOString())
      .order('created_at', { ascending: true });
    if (error) throw error;
    for (const m of (data || []) as Msg[]) {
      const arr = msgsByPatient.get(m.patient_id) || [];
      arr.push(m);
      msgsByPatient.set(m.patient_id, arr);
    }
  }

  type Row = {
    seq: Seq;
    patient: Patient | undefined;
    flag: 'opted_out' | 'declined';
    triggeringInbound: Msg | null;
    lastOutboundBefore: Msg | null;
    nextOutboundAfter: Msg | null;
    dayLabel: string;
    outboundCountBefore: number;
  };
  const rows: Row[] = [];

  for (const s of flagged) {
    const flag: 'opted_out' | 'declined' =
      (s.exit_reason === 'declined') ? 'declined' : 'opted_out';
    const msgs = msgsByPatient.get(s.patient_id) || [];
    const inbound = msgs.filter(m => m.direction === 'inbound');
    const outbound = msgs.filter(m => m.direction === 'outbound');

    let triggeringInbound: Msg | null = null;
    if (s.updated_at) {
      const exitedT = new Date(s.updated_at as string).getTime();
      // closest inbound before exited_at (within 30 min)
      const candidates = inbound.filter(m =>
        new Date(m.created_at).getTime() <= exitedT &&
        exitedT - new Date(m.created_at).getTime() < 30 * 60 * 1000
      );
      triggeringInbound = candidates[candidates.length - 1] || inbound[inbound.length - 1] || null;
    } else {
      triggeringInbound = inbound[inbound.length - 1] || null;
    }

    let lastOutboundBefore: Msg | null = null;
    let outboundCountBefore = 0;
    if (triggeringInbound) {
      const tT = new Date(triggeringInbound.created_at).getTime();
      const priors = outbound.filter(m => new Date(m.created_at).getTime() < tT);
      outboundCountBefore = priors.length;
      lastOutboundBefore = priors[priors.length - 1] || null;
    } else {
      outboundCountBefore = outbound.length;
      lastOutboundBefore = outbound[outbound.length - 1] || null;
    }

    let nextOutboundAfter: Msg | null = null;
    if (triggeringInbound) {
      const tT = new Date(triggeringInbound.created_at).getTime();
      const after = outbound.filter(m => new Date(m.created_at).getTime() > tT);
      nextOutboundAfter = after[0] || null;
    }

    const dayLabel = lastOutboundBefore
      ? dayOfSequence(s, lastOutboundBefore.created_at)
      : 'no_outbound';

    rows.push({
      seq: s,
      patient: patientsById.get(s.patient_id),
      flag,
      triggeringInbound,
      lastOutboundBefore,
      nextOutboundAfter,
      dayLabel,
      outboundCountBefore,
    });
  }

  // Per-arm totals (denominators for opt-out rate)
  const sentByArm: Record<string, number> = { control_voice: 0, offer_only: 0 };
  for (const s of seqs) {
    if (s.experiment_arm) sentByArm[s.experiment_arm] = (sentByArm[s.experiment_arm] || 0) + 1;
  }

  // Per-template send counts (denominator for "opt-outs per send")
  const sendCountsByTemplate = new Map<string, number>();
  const allOutboundIds = seqs.map(s => s.patient_id);
  for (let i = 0; i < allOutboundIds.length; i += 50) {
    const chunk = allOutboundIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('conversations')
      .select('metadata, automation_type, direction')
      .in('patient_id', chunk)
      .eq('direction', 'outbound')
      .gte('created_at', LAUNCH.toISOString());
    if (error) throw error;
    for (const m of (data || []) as any[]) {
      const md = m.metadata || {};
      const tpl = md.template_id || md.templateId || md.recall_template_id || md.template || m.automation_type;
      if (!tpl) continue;
      sendCountsByTemplate.set(tpl, (sendCountsByTemplate.get(tpl) || 0) + 1);
    }
  }

  // Per-row dump
  const armOrder = ['control_voice', 'offer_only'];
  for (const arm of armOrder) {
    const armRows = rows.filter(r => r.seq.experiment_arm === arm);
    console.log(`\n===== ARM ${arm === 'control_voice' ? 'A — control_voice (3-touch)' : 'B — offer_only (single-send)'} — ${armRows.length} flagged of ${sentByArm[arm]} sent =====`);
    armRows.sort((a, b) => (a.seq.exited_at || '').localeCompare(b.seq.exited_at || ''));
    for (const r of armRows) {
      const name = `${r.patient?.first_name || '?'} ${r.patient?.last_name || ''}`.trim();
      console.log(`\n  [${r.flag.toUpperCase()}] ${name} (${r.seq.assigned_voice || '?'}, ${r.seq.months_overdue ?? '?'}mo overdue)`);
      console.log(`    seq_id=${r.seq.id} stage=${r.seq.booking_stage}`);
      console.log(`    outbounds_before_flag=${r.outboundCountBefore}  exit_day=${r.dayLabel}  exit_reason=${r.seq.exit_reason}`);
      if (r.lastOutboundBefore) {
        console.log(`    last_outbound[${tplOf(r.lastOutboundBefore) || 'no_template'}] @ ${r.lastOutboundBefore.created_at}`);
        console.log(`      "${(r.lastOutboundBefore.message_body || '').slice(0, 200)}"`);
      }
      if (r.triggeringInbound) {
        console.log(`    INBOUND @ ${r.triggeringInbound.created_at}`);
        console.log(`      "${(r.triggeringInbound.message_body || '').slice(0, 240)}"`);
      } else {
        console.log(`    INBOUND: (none)`);
      }
      if (r.nextOutboundAfter) {
        console.log(`    our_reply[${tplOf(r.nextOutboundAfter) || 'no_template'}]: "${(r.nextOutboundAfter.message_body || '').slice(0, 200)}"`);
      }
    }
  }

  // ========== Aggregates ==========
  console.log('\n\n===================== AGGREGATES =====================');

  // 1. Timing distribution by flag x arm
  const timing: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const key = `${r.seq.experiment_arm}/${r.flag}`;
    if (!timing[key]) timing[key] = {};
    timing[key][r.dayLabel] = (timing[key][r.dayLabel] || 0) + 1;
  }
  console.log('\nTiming distribution (which day fired the flag):');
  for (const k of Object.keys(timing).sort()) {
    const dist = Object.entries(timing[k]).map(([d, n]) => `${d}=${n}`).join(', ');
    console.log(`  ${k}: ${dist}`);
  }

  // 2. Voice concentration (Arm A only — Arm B has no voice variant)
  console.log('\nVoice concentration (Arm A):');
  const armA = rows.filter(r => r.seq.experiment_arm === 'control_voice');
  const armASentByVoice: Record<string, number> = {};
  for (const s of seqs.filter(s => s.experiment_arm === 'control_voice')) {
    const v = s.assigned_voice || '?';
    armASentByVoice[v] = (armASentByVoice[v] || 0) + 1;
  }
  for (const flag of ['opted_out', 'declined'] as const) {
    const byVoice: Record<string, number> = {};
    for (const r of armA.filter(r => r.flag === flag)) {
      const v = r.seq.assigned_voice || '?';
      byVoice[v] = (byVoice[v] || 0) + 1;
    }
    const parts = Object.keys(armASentByVoice).map(v => {
      const n = byVoice[v] || 0;
      const denom = armASentByVoice[v];
      const rate = denom ? ((n / denom) * 100).toFixed(1) : '0.0';
      return `${v}=${n}/${denom} (${rate}%)`;
    });
    console.log(`  ${flag}: ${parts.join(', ')}`);
  }

  // 3. Overdue bucket concentration
  console.log('\nOverdue bucket concentration:');
  const sentByBucket: Record<string, number> = {};
  for (const s of seqs) {
    const b = overdueBucket(s.months_overdue);
    sentByBucket[b] = (sentByBucket[b] || 0) + 1;
  }
  const flagByBucket: Record<string, number> = {};
  for (const r of rows) {
    const b = overdueBucket(r.seq.months_overdue);
    flagByBucket[b] = (flagByBucket[b] || 0) + 1;
  }
  for (const b of Object.keys(sentByBucket).sort()) {
    const n = flagByBucket[b] || 0;
    const d = sentByBucket[b];
    console.log(`  ${b}: ${n}/${d} (${d ? ((n / d) * 100).toFixed(1) : '0'}%)`);
  }

  // 4. Last-outbound template ranking (worst template by flags/sends)
  console.log('\nFlags per template (opt-outs+declines / total sends of that template):');
  const flagByTemplate = new Map<string, number>();
  for (const r of rows) {
    const t = tplOf(r.lastOutboundBefore) || 'no_template';
    flagByTemplate.set(t, (flagByTemplate.get(t) || 0) + 1);
  }
  const tplRows: { tpl: string; flags: number; sends: number; rate: number }[] = [];
  for (const [tpl, flags] of flagByTemplate.entries()) {
    const sends = sendCountsByTemplate.get(tpl) || 0;
    const rate = sends ? flags / sends : 0;
    tplRows.push({ tpl, flags, sends, rate });
  }
  tplRows.sort((a, b) => b.rate - a.rate);
  for (const t of tplRows) {
    console.log(`  ${t.tpl}: ${t.flags}/${t.sends} = ${(t.rate * 100).toFixed(1)}%`);
  }

  // 5. Reply recovery on declines (Arm A only)
  const declines = armA.filter(r => r.flag === 'declined');
  let recovered = 0, attempted = 0, none = 0;
  for (const r of declines) {
    if (!r.nextOutboundAfter) { none++; continue; }
    const body = (r.nextOutboundAfter.message_body || '').toLowerCase();
    // crude: "no worries", "timing" => clean accept; "30%" / "booking" => recover attempt
    if (body.includes('30%') || body.includes('booking.dentiflow') || body.includes('grab a time') || body.includes('appointment')) attempted++;
    else recovered++;
  }
  console.log(`\nDecline reply behavior (Arm A, ${declines.length} declines):`);
  console.log(`  no reply sent:        ${none}`);
  console.log(`  clean-accept reply:   ${recovered}`);
  console.log(`  recovery-attempt reply: ${attempted}`);

  // 6. Sequence-step marginal booking vs marginal opt-out (Arm A only)
  console.log('\nArm A — marginal cost/value per touch:');
  const armASeqs = seqs.filter(s => s.experiment_arm === 'control_voice');
  const armASentTotal = armASeqs.length;
  const flagsByDay: Record<string, { opt: number; dec: number }> = {
    Day0: { opt: 0, dec: 0 }, Day1: { opt: 0, dec: 0 }, Day3: { opt: 0, dec: 0 }, other: { opt: 0, dec: 0 },
  };
  for (const r of armA) {
    const k = (r.dayLabel === 'Day0' || r.dayLabel === 'Day1' || r.dayLabel === 'Day3') ? r.dayLabel : 'other';
    if (r.flag === 'opted_out') flagsByDay[k].opt++;
    else flagsByDay[k].dec++;
  }
  console.log(`  Arm A sent: ${armASentTotal}`);
  for (const k of ['Day0', 'Day1', 'Day3', 'other']) {
    console.log(`    ${k}: opt-outs=${flagsByDay[k].opt}, declines=${flagsByDay[k].dec}`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

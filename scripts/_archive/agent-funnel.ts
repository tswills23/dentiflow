#!/usr/bin/env npx tsx
// A/B funnel leakage analysis — cross-references state-machine stages,
// inbound replies, and Dentrix bookings to find drop-off points.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LAUNCH_DATE = new Date('2026-05-12T14:00:00Z');
const CSV_PATH = resolve(__dirname, '..', 'Interactive+Schedule+Report+Builder.csv');

function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '').slice(-10);
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const d2 = new Date(year, parseInt(m[1]) - 1, parseInt(m[2]));
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('phone') || lower.includes('appt date') || lower.includes('first name')) {
      headerIdx = i;
      break;
    }
  }
  const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells: string[] = [];
    let cur = '', inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim().replace(/^"|"$/g, ''); });
    rows.push(row);
  }
  return rows;
}

function findCol(row: Record<string, string>, cs: string[]): string | null {
  for (const c of cs) { const v = row[c.toLowerCase()]; if (v) return v; }
  return null;
}

type Seq = {
  id: string;
  patient_id: string;
  experiment_arm: string;
  link_clicked_at: string | null;
  link_followup_sent: boolean | null;
  booking_stage: string;
  sequence_status: string;
  exit_reason: string | null;
  reply_count: number | null;
  created_at: string;
  patients: { first_name: string | null; last_name: string | null; phone: string | null };
};

async function main() {
  console.log('\n========== A/B FUNNEL LEAKAGE ANALYSIS ==========\n');

  // 1. Pull A/B sequences
  const { data: seqsRaw, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, link_clicked_at, link_followup_sent, booking_stage, sequence_status, exit_reason, reply_count, created_at, patients!inner(first_name, last_name, phone)')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  if (seqErr) { console.error('seq err:', seqErr.message); process.exit(1); }
  const seqs = (seqsRaw || []) as unknown as Seq[];
  console.log(`Loaded ${seqs.length} A/B sequences.\n`);

  const phoneToSeq = new Map<string, Seq>();
  const patientToSeq = new Map<string, Seq>();
  for (const s of seqs) {
    const p = normalizePhone(s.patients?.phone || '');
    if (p) phoneToSeq.set(p, s);
    patientToSeq.set(s.patient_id, s);
  }

  // 2. Pull inbound conversations for those patients since launch (BATCHED — .in() with 400 IDs silently fails)
  const patientIds = seqs.map(s => s.patient_id);
  const convs: any[] = [];
  for (let i = 0; i < patientIds.length; i += 50) {
    const batch = patientIds.slice(i, i + 50);
    const { data: convsRaw } = await supabase
      .from('conversations')
      .select('patient_id, direction, message_body, automation_type, created_at')
      .in('patient_id', batch)
      .gte('created_at', LAUNCH_DATE.toISOString())
      .order('created_at', { ascending: true });
    if (convsRaw) convs.push(...convsRaw);
  }
  const inboundByPatient = new Map<string, any[]>();
  for (const c of convs) {
    if (c.direction !== 'inbound') continue;
    const arr = inboundByPatient.get(c.patient_id) || [];
    arr.push(c);
    inboundByPatient.set(c.patient_id, arr);
  }

  // 3. Parse Dentrix CSV
  const csvText = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  const PHONE_COLS = ['phone', 'mobile phone', 'patient phone', 'cell phone', 'phone number', 'mobile', 'cell'];
  const DATE_COLS = ['appointment date', 'appt date', 'scheduled date', 'date', 'created', 'created date', 'appt'];
  const STATUS_COLS = ['status', 'appointment status', 'appt status'];

  const bookingsByPatient = new Map<string, { apptDate: Date | null; status: string; createdDate: Date | null }>();
  for (const row of rows) {
    const phoneRaw = findCol(row, PHONE_COLS);
    if (!phoneRaw) continue;
    const phone = normalizePhone(phoneRaw);
    const seq = phoneToSeq.get(phone);
    if (!seq) continue;
    const dateRaw = findCol(row, DATE_COLS);
    const apptDate = dateRaw ? parseDate(dateRaw) : null;
    if (apptDate && apptDate < LAUNCH_DATE) continue;
    const createdRaw = row['created'] || row['created date'] || row['date entered'] || '';
    const createdDate = createdRaw ? parseDate(createdRaw) : null;
    const status = findCol(row, STATUS_COLS) || '';
    const existing = bookingsByPatient.get(seq.patient_id);
    if (!existing || (apptDate && (!existing.apptDate || apptDate < existing.apptDate))) {
      bookingsByPatient.set(seq.patient_id, { apptDate, status, createdDate });
    }
  }

  // 4. Per-arm funnel
  type Bucket = {
    sent: number;
    clicked: number;
    replied: number;
    clickedAndReplied: number;
    clickedNoReply: number;
    repliedNoClick: number;
    noEngagement: number;
    s6Completed: number;
    stageDist: Record<string, number>;
    exitReasonDist: Record<string, number>;
    booked: number;
    bookedClicked: number;
    bookedReplied: number;
    bookedSilent: number; // no click, no reply
    bookedAtS6: number;
    bookedNotAtS6: number;
    clickerStages: Record<string, number>;
    clickerBooked: number;
    timeToBookHours: number[];
  };
  const newBucket = (): Bucket => ({
    sent: 0, clicked: 0, replied: 0, clickedAndReplied: 0, clickedNoReply: 0,
    repliedNoClick: 0, noEngagement: 0, s6Completed: 0,
    stageDist: {}, exitReasonDist: {}, booked: 0, bookedClicked: 0, bookedReplied: 0,
    bookedSilent: 0, bookedAtS6: 0, bookedNotAtS6: 0,
    clickerStages: {}, clickerBooked: 0, timeToBookHours: [],
  });
  const arms: Record<string, Bucket> = { control_voice: newBucket(), offer_only: newBucket() };

  for (const s of seqs) {
    const b = arms[s.experiment_arm];
    if (!b) continue;
    b.sent++;
    const clicked = !!s.link_clicked_at;
    const inbounds = inboundByPatient.get(s.patient_id) || [];
    const replied = inbounds.length > 0;
    if (clicked) b.clicked++;
    if (replied) b.replied++;
    if (clicked && replied) b.clickedAndReplied++;
    if (clicked && !replied) b.clickedNoReply++;
    if (!clicked && replied) b.repliedNoClick++;
    if (!clicked && !replied) b.noEngagement++;
    if (s.booking_stage === 'S6_COMPLETED') b.s6Completed++;
    b.stageDist[s.booking_stage] = (b.stageDist[s.booking_stage] || 0) + 1;
    if (s.exit_reason) b.exitReasonDist[s.exit_reason] = (b.exitReasonDist[s.exit_reason] || 0) + 1;
    if (clicked) b.clickerStages[s.booking_stage] = (b.clickerStages[s.booking_stage] || 0) + 1;

    const booking = bookingsByPatient.get(s.patient_id);
    if (booking) {
      b.booked++;
      if (clicked) { b.bookedClicked++; if (clicked) b.clickerBooked++; }
      if (replied) b.bookedReplied++;
      if (!clicked && !replied) b.bookedSilent++;
      if (s.booking_stage === 'S6_COMPLETED') b.bookedAtS6++; else b.bookedNotAtS6++;
      // time from sequence created to booking created
      const seqStart = new Date(s.created_at);
      const bookCreated = booking.createdDate || booking.apptDate;
      if (bookCreated) {
        const hrs = (bookCreated.getTime() - seqStart.getTime()) / 36e5;
        if (hrs >= 0 && hrs < 24 * 30) b.timeToBookHours.push(hrs);
      }
    }
  }

  const pct = (n: number, d: number) => d ? `${((n / d) * 100).toFixed(1)}%` : '0%';

  for (const arm of ['control_voice', 'offer_only']) {
    const b = arms[arm];
    const label = arm === 'control_voice' ? 'ARM A (control_voice)' : 'ARM B (offer_only)';
    console.log(`\n===== ${label} =====`);
    console.log(`FUNNEL: ${b.sent} sent → ${b.clicked} clicked (${pct(b.clicked, b.sent)}) → ${b.replied} replied (${pct(b.replied, b.sent)}) → ${b.s6Completed} S6_COMPLETED → ${b.booked} BOOKED in Dentrix (${pct(b.booked, b.sent)})`);
    console.log(`\nEngagement breakdown:`);
    console.log(`  clicked + replied:  ${b.clickedAndReplied}`);
    console.log(`  clicked, NO reply:  ${b.clickedNoReply}  ← link click leakage`);
    console.log(`  replied, NO click:  ${b.repliedNoClick}`);
    console.log(`  no engagement:      ${b.noEngagement}`);
    console.log(`\nBooking attribution (Dentrix bookings):`);
    console.log(`  Total booked:           ${b.booked}`);
    console.log(`  Bookers who clicked:    ${b.bookedClicked} (${pct(b.bookedClicked, b.booked)})`);
    console.log(`  Bookers who replied:    ${b.bookedReplied} (${pct(b.bookedReplied, b.booked)})`);
    console.log(`  Silent bookers (no click, no reply): ${b.bookedSilent} (${pct(b.bookedSilent, b.booked)}) ← phone-call attribution`);
    console.log(`  Booked & at S6:         ${b.bookedAtS6}`);
    console.log(`  Booked but NOT at S6:   ${b.bookedNotAtS6} ← state machine missed these`);
    console.log(`\nWhere did CLICKERS end up (by booking_stage)?`);
    Object.entries(b.clickerStages).sort((a, c) => c[1] - a[1]).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(20)} ${v}`);
    });
    console.log(`  → Of ${b.clicked} clickers, ${b.clickerBooked} actually booked (${pct(b.clickerBooked, b.clicked)})`);
    console.log(`\nAll-sequence stage distribution:`);
    Object.entries(b.stageDist).sort((a, c) => c[1] - a[1]).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(20)} ${v}`);
    });
    if (Object.keys(b.exitReasonDist).length) {
      console.log(`\nExit reasons:`);
      Object.entries(b.exitReasonDist).sort((a, c) => c[1] - a[1]).forEach(([k, v]) => {
        console.log(`  ${k.padEnd(20)} ${v}`);
      });
    }
    if (b.timeToBookHours.length) {
      const sorted = [...b.timeToBookHours].sort((a, c) => a - c);
      const median = sorted[Math.floor(sorted.length / 2)];
      const avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;
      console.log(`\nTime from sequence start → booking created (hours):`);
      console.log(`  n=${sorted.length}, median=${median.toFixed(1)}h, avg=${avg.toFixed(1)}h, min=${sorted[0].toFixed(1)}h, max=${sorted[sorted.length-1].toFixed(1)}h`);
      const buckets = [1, 6, 24, 72, 168, 720];
      for (const h of buckets) {
        const n = sorted.filter(x => x <= h).length;
        console.log(`  ≤${h}h: ${n} (${pct(n, sorted.length)})`);
      }
    }
  }

  // 5. Cross-arm summary
  console.log('\n\n===== SUMMARY =====');
  for (const arm of ['control_voice', 'offer_only']) {
    const b = arms[arm];
    console.log(`${arm}: ${b.sent} sent | clicks=${b.clicked} | replies=${b.replied} | S6=${b.s6Completed} | Dentrix=${b.booked} | click→book conv=${pct(b.clickerBooked, b.clicked)}`);
  }

  // 6. Reply intents — what are clickers who replied actually saying?
  console.log('\n===== CLICKER REPLIES (Arm A sample) =====');
  let shown = 0;
  for (const s of seqs) {
    if (s.experiment_arm !== 'control_voice') continue;
    if (!s.link_clicked_at) continue;
    const inb = inboundByPatient.get(s.patient_id) || [];
    if (!inb.length) continue;
    if (shown >= 15) break;
    shown++;
    const name = `${s.patients?.first_name || ''} ${s.patients?.last_name || ''}`.trim();
    const booked = bookingsByPatient.has(s.patient_id) ? '[BOOKED]' : '[no book]';
    console.log(`  ${name.padEnd(25)} stage=${s.booking_stage.padEnd(15)} ${booked} "${(inb[0].message_body || '').slice(0, 80)}"`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

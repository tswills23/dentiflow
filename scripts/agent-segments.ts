#!/usr/bin/env npx tsx
// Segment analysis of A/B booking results — slices booking conversion by every
// available dimension on recall_sequences + patients, cross-referenced against
// the Dentrix Ascend CSV for ground-truth bookings.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LAUNCH_DATE = new Date('2026-05-12T00:00:00Z');
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

function findColumn(row: Record<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    const v = row[c.toLowerCase()];
    if (v !== undefined && v !== '') return v;
  }
  return null;
}

function pct(n: number, d: number): string {
  if (d === 0) return '0.0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

function bucketOverdue(m: number | null): string {
  if (m === null || m === undefined) return 'unknown';
  if (m < 6) return '<6';
  if (m < 9) return '6-9';
  if (m < 12) return '9-12';
  if (m < 18) return '12-18';
  if (m < 24) return '18-24';
  return '24+';
}

function dow(d: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

type SeqRow = {
  id: string;
  patient_id: string;
  experiment_arm: string;
  assigned_voice: string | null;
  segment_overdue: string | null;
  months_overdue: number | null;
  link_clicked_at: string | null;
  sequence_day: number | null;
  created_at: string;
  last_sent_at: string | null;
  booking_stage: string | null;
  sequence_status: string | null;
  patients: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    last_visit_date: string | null;
    location: string | null;
  };
};

type Booking = { seq: SeqRow; apptDate: Date | null; status: string };

function tally<T>(items: T[], keyFn: (t: T) => string, boolFn: (t: T) => boolean): Map<string, { n: number; booked: number }> {
  const map = new Map<string, { n: number; booked: number }>();
  for (const item of items) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, { n: 0, booked: 0 });
    const c = map.get(k)!;
    c.n++;
    if (boolFn(item)) c.booked++;
  }
  return map;
}

function printTable(title: string, data: Map<string, { n: number; booked: number }>, sortKeys?: string[]): void {
  console.log(`\n--- ${title} ---`);
  console.log(`  ${'segment'.padEnd(22)} ${'n'.padStart(5)} ${'booked'.padStart(7)} ${'rate'.padStart(8)}  flag`);
  const entries = Array.from(data.entries());
  if (sortKeys) {
    entries.sort((a, b) => sortKeys.indexOf(a[0]) - sortKeys.indexOf(b[0]));
  } else {
    entries.sort((a, b) => (b[1].booked / Math.max(b[1].n, 1)) - (a[1].booked / Math.max(a[1].n, 1)));
  }
  for (const [k, v] of entries) {
    const rate = v.booked / Math.max(v.n, 1);
    const flag = v.n < 20 ? '(small n)' : rate >= 0.20 ? 'HIGH' : rate <= 0.05 ? 'LOW' : '';
    console.log(`  ${k.padEnd(22)} ${String(v.n).padStart(5)} ${String(v.booked).padStart(7)} ${pct(v.booked, v.n).padStart(8)}  ${flag}`);
  }
}

async function main(): Promise<void> {
  console.log('\n========== A/B SEGMENT ANALYSIS — Village Dental 2026-05-12 launch ==========\n');

  const { data: seqs, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, assigned_voice, segment_overdue, months_overdue, link_clicked_at, sequence_day, created_at, last_sent_at, booking_stage, sequence_status, patients!inner(first_name, last_name, phone, last_visit_date, location)')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);

  if (seqErr) { console.error('seq err:', seqErr.message); process.exit(1); }
  const allSeqs = (seqs || []) as unknown as SeqRow[];
  console.log(`Loaded ${allSeqs.length} sequences.`);

  const phoneToSeq = new Map<string, SeqRow>();
  for (const s of allSeqs) {
    const p = normalizePhone(s.patients?.phone || '');
    if (p) phoneToSeq.set(p, s);
  }

  const csvText = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} CSV rows.`);

  const PHONE_COLS = ['phone', 'mobile phone', 'patient phone', 'cell phone', 'phone number', 'mobile', 'cell'];
  const DATE_COLS = ['appointment date', 'appt date', 'scheduled date', 'date', 'created', 'created date', 'appt'];
  const STATUS_COLS = ['status', 'appointment status', 'appt status'];

  const bookings = new Map<string, Booking>(); // patient_id -> earliest match
  for (const row of rows) {
    const phoneRaw = findColumn(row, PHONE_COLS);
    if (!phoneRaw) continue;
    const phone = normalizePhone(phoneRaw);
    const seq = phoneToSeq.get(phone);
    if (!seq) continue;
    const dateRaw = findColumn(row, DATE_COLS);
    const apptDate = dateRaw ? parseDate(dateRaw) : null;
    if (apptDate && apptDate < LAUNCH_DATE) continue;
    const status = findColumn(row, STATUS_COLS) || '';
    const existing = bookings.get(seq.patient_id);
    if (!existing || (apptDate && (!existing.apptDate || apptDate < existing.apptDate))) {
      bookings.set(seq.patient_id, { seq, apptDate, status });
    }
  }
  console.log(`Matched ${bookings.size} unique booked patients.\n`);

  const isBooked = (s: SeqRow) => bookings.has(s.patient_id);

  // Overall by arm
  const armA = allSeqs.filter(s => s.experiment_arm === 'control_voice');
  const armB = allSeqs.filter(s => s.experiment_arm === 'offer_only');
  console.log(`Arm A (control_voice): ${armA.length} sent, ${armA.filter(isBooked).length} booked (${pct(armA.filter(isBooked).length, armA.length)})`);
  console.log(`Arm B (offer_only):    ${armB.length} sent, ${armB.filter(isBooked).length} booked (${pct(armB.filter(isBooked).length, armB.length)})`);

  // 1. months_overdue buckets — overall + per arm
  const bucketOrder = ['<6', '6-9', '9-12', '12-18', '18-24', '24+', 'unknown'];
  printTable('Booking rate by months_overdue (ALL)',
    tally(allSeqs, s => bucketOverdue(s.months_overdue ?? null), isBooked),
    bucketOrder);
  printTable('Booking rate by months_overdue — ARM A (control_voice)',
    tally(armA, s => bucketOverdue(s.months_overdue ?? null), isBooked),
    bucketOrder);
  printTable('Booking rate by months_overdue — ARM B (offer_only)',
    tally(armB, s => bucketOverdue(s.months_overdue ?? null), isBooked),
    bucketOrder);

  // 2. assigned_voice within Arm A
  printTable('Booking rate by assigned_voice — ARM A only',
    tally(armA, s => s.assigned_voice || 'none', isBooked));

  // Voice × bucket within Arm A
  printTable('ARM A: voice × overdue bucket',
    tally(armA, s => `${s.assigned_voice || 'none'} / ${bucketOverdue(s.months_overdue ?? null)}`, isBooked));

  // 3. segment_overdue values
  printTable('Booking rate by segment_overdue (ALL)',
    tally(allSeqs, s => s.segment_overdue || 'null', isBooked));

  // 4. Day-of-week of initial send (created_at)
  printTable('Booking rate by DOW of initial send',
    tally(allSeqs, s => dow(new Date(s.created_at)), isBooked),
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  // 5. Time-since-send-to-booking (Dentrix appt date — last_sent_at)
  console.log('\n--- Time from last_sent_at → booking (days) ---');
  const lagBuckets = new Map<string, number>();
  let lagN = 0, lagSum = 0;
  for (const b of bookings.values()) {
    if (!b.apptDate || !b.seq.last_sent_at) continue;
    const sentMs = new Date(b.seq.last_sent_at).getTime();
    const apptMs = b.apptDate.getTime();
    const days = Math.round((apptMs - sentMs) / 86400000);
    lagN++; lagSum += days;
    const bk = days <= 1 ? 'same/next-day' : days <= 3 ? '2-3d' : days <= 7 ? '4-7d' : days <= 14 ? '8-14d' : '15+';
    lagBuckets.set(bk, (lagBuckets.get(bk) || 0) + 1);
  }
  if (lagN > 0) {
    console.log(`  mean lag: ${(lagSum / lagN).toFixed(1)}d  (n=${lagN})`);
    for (const [k, v] of Array.from(lagBuckets.entries()).sort()) console.log(`  ${k.padEnd(15)} ${v}`);
  }

  // Arm-split lag
  console.log('\n--- Lag by arm (mean days from last_sent_at to appt) ---');
  for (const arm of ['control_voice', 'offer_only']) {
    let n = 0, sum = 0;
    for (const b of bookings.values()) {
      if (b.seq.experiment_arm !== arm) continue;
      if (!b.apptDate || !b.seq.last_sent_at) continue;
      const days = (b.apptDate.getTime() - new Date(b.seq.last_sent_at).getTime()) / 86400000;
      n++; sum += days;
    }
    console.log(`  ${arm.padEnd(15)} mean=${n ? (sum / n).toFixed(1) : 'n/a'}d  n=${n}`);
  }

  // 6. Location
  printTable('Booking rate by location',
    tally(allSeqs, s => s.patients?.location || 'unknown', isBooked));

  // 7. Other dims
  // sequence_day at booking (which touch closed them — only meaningful in arm A)
  printTable('ARM A: booking rate by final sequence_day reached',
    tally(armA, s => `day_${s.sequence_day ?? 'null'}`, isBooked));

  // Link click → booking conversion
  console.log('\n--- Link click → booking conversion ---');
  for (const arm of ['control_voice', 'offer_only']) {
    const armSeqs = allSeqs.filter(s => s.experiment_arm === arm);
    const clicked = armSeqs.filter(s => s.link_clicked_at);
    const clickedBooked = clicked.filter(isBooked);
    const noClick = armSeqs.filter(s => !s.link_clicked_at);
    const noClickBooked = noClick.filter(isBooked);
    console.log(`  ${arm}:`);
    console.log(`    clicked link:    ${clicked.length} → booked ${clickedBooked.length} (${pct(clickedBooked.length, clicked.length)})`);
    console.log(`    no link click:   ${noClick.length} → booked ${noClickBooked.length} (${pct(noClickBooked.length, noClick.length)})`);
  }

  // Months since last visit (from patients.last_visit_date) bucketed differently
  console.log('\n--- Booking rate by months-since-last-visit (computed from last_visit_date) ---');
  function monthsSince(d: string | null): number | null {
    if (!d) return null;
    const t = new Date(d).getTime();
    if (isNaN(t)) return null;
    return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.4375);
  }
  printTable('months-since-last-visit',
    tally(allSeqs, s => bucketOverdue(monthsSince(s.patients?.last_visit_date)), isBooked),
    bucketOrder);

  // Voice × arm interaction sanity check (Arm B has no assigned_voice but let's see)
  printTable('voice × arm',
    tally(allSeqs, s => `${s.experiment_arm} / ${s.assigned_voice || 'none'}`, isBooked));

  console.log('\n========== DONE ==========\n');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

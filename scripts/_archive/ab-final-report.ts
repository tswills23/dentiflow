#!/usr/bin/env npx tsx
// Final A/B test report — cross-references Dentrix Ascend appointment CSV
// against the 397 recall sequences to determine actual booking conversion per arm.
//
// USAGE (on May 26 / end of test):
//   npx tsx scripts/ab-final-report.ts --file <dentrix-appointments.csv>
//
// REQUIRED CSV COLUMNS (case-insensitive, any order — common Dentrix export names supported):
//   - Phone (or "Mobile Phone", "Patient Phone", "Cell Phone", "Phone Number")
//   - Appointment Date (or "Appt Date", "Scheduled Date", "Date", "Created", "Created Date")
//   - Optional: First Name, Last Name, Status (Scheduled/Completed/Cancelled/No-Show)
//
// MATCHING LOGIC:
//   1. Normalizes phone numbers (strips +1, dashes, parens, spaces)
//   2. Matches against the 397 A/B test patient phones
//   3. Filters to appointments created/scheduled between launch and run date
//   4. Reports per arm: sent / link clicks / intent-booked / actual booked / completed visits

import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LAUNCH_DATE = new Date('2026-05-12T14:00:00Z');

function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Take last 10 digits (drop country code if present)
  return digits.slice(-10);
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  // Try MM/DD/YYYY
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
  // Auto-detect header row — Dentrix exports prepend report-title rows.
  // Scan for the first row containing 'phone' or 'appt date'.
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
    // Simple CSV parse — handles quoted fields with commas
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const csvPath = fileIdx >= 0 ? args[fileIdx + 1] : null;

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/ab-final-report.ts --file <dentrix-appointments.csv>');
    process.exit(1);
  }

  console.log('\n========== A/B FINAL REPORT — Village Dental 2026-05-12 launch ==========\n');

  // 1. Pull all A/B sequences + patient phones
  console.log('Fetching A/B sequences from database...');
  const { data: seqs, error: seqErr } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, experiment_arm, link_clicked_at, booking_stage, created_at, sequence_status, exit_reason, patients!inner(first_name, last_name, phone)')
    .eq('practice_id', PRACTICE_ID)
    .in('experiment_arm', ['control_voice', 'offer_only']);
  if (seqErr) { console.error('Sequence query err:', seqErr.message); process.exit(1); }

  type SeqRow = {
    id: string; patient_id: string; experiment_arm: string;
    link_clicked_at: string | null; booking_stage: string; created_at: string;
    sequence_status: string; exit_reason: string | null;
    patients: { first_name: string | null; last_name: string | null; phone: string | null };
  };
  const phoneToSeq = new Map<string, SeqRow>();
  for (const s of (seqs || []) as unknown as SeqRow[]) {
    const phone = normalizePhone(s.patients?.phone || '');
    if (phone) phoneToSeq.set(phone, s);
  }
  console.log(`Loaded ${phoneToSeq.size} A/B patients with phone numbers.`);

  // 2. Parse Dentrix CSV
  console.log(`\nParsing Dentrix CSV: ${csvPath}`);
  const csvText = readFileSync(resolve(csvPath), 'utf8');
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} appointment rows.`);

  // 3. Match
  const PHONE_COLS = ['phone', 'mobile phone', 'patient phone', 'cell phone', 'phone number', 'mobile', 'cell'];
  const DATE_COLS = ['appointment date', 'appt date', 'scheduled date', 'date', 'created', 'created date', 'appt'];
  const STATUS_COLS = ['status', 'appointment status', 'appt status'];
  const FNAME_COLS = ['first name', 'firstname', 'first'];
  const LNAME_COLS = ['last name', 'lastname', 'last'];

  type Match = { arm: string; seq: SeqRow; apptDate: Date | null; status: string; rowFirstName: string; rowLastName: string };
  const matches: Match[] = [];
  let csvWithoutPhone = 0;
  let csvOutsideWindow = 0;
  let csvNotInTest = 0;

  for (const row of rows) {
    const phoneRaw = findColumn(row, PHONE_COLS);
    if (!phoneRaw) { csvWithoutPhone++; continue; }
    const phone = normalizePhone(phoneRaw);
    const seq = phoneToSeq.get(phone);
    if (!seq) { csvNotInTest++; continue; }

    const dateRaw = findColumn(row, DATE_COLS);
    const apptDate = dateRaw ? parseDate(dateRaw) : null;
    if (apptDate && apptDate < LAUNCH_DATE) { csvOutsideWindow++; continue; }

    const status = findColumn(row, STATUS_COLS) || '';
    const rowFirstName = findColumn(row, FNAME_COLS) || '';
    const rowLastName = findColumn(row, LNAME_COLS) || '';
    matches.push({ arm: seq.experiment_arm, seq, apptDate, status, rowFirstName, rowLastName });
  }

  // 4. Dedupe by patient_id (one patient can have multiple appts; count as 1 booking)
  const bookedByPatient = new Map<string, Match>();
  for (const m of matches) {
    const existing = bookedByPatient.get(m.seq.patient_id);
    if (!existing || (m.apptDate && (!existing.apptDate || m.apptDate < existing.apptDate))) {
      bookedByPatient.set(m.seq.patient_id, m);
    }
  }

  // 5. Aggregate by arm
  type ArmStats = {
    sent: number;
    linkClicks: number;
    intentBooked: number;     // S6_COMPLETED in our state machine
    actualBooked: number;     // Has appt in Dentrix CSV
    completedVisits: number;  // Status == "Completed"
    cancelled: number;        // Status == "Cancelled" / "No-Show"
    bookedPatients: string[]; // Names
  };
  const stats: Record<string, ArmStats> = {
    control_voice: { sent: 0, linkClicks: 0, intentBooked: 0, actualBooked: 0, completedVisits: 0, cancelled: 0, bookedPatients: [] },
    offer_only:    { sent: 0, linkClicks: 0, intentBooked: 0, actualBooked: 0, completedVisits: 0, cancelled: 0, bookedPatients: [] },
  };
  for (const s of (seqs || []) as unknown as SeqRow[]) {
    const a = stats[s.experiment_arm];
    if (!a) continue;
    a.sent++;
    if (s.link_clicked_at) a.linkClicks++;
    if (s.booking_stage === 'S6_COMPLETED') a.intentBooked++;
  }
  for (const m of bookedByPatient.values()) {
    const a = stats[m.arm];
    if (!a) continue;
    a.actualBooked++;
    const name = `${m.seq.patients?.first_name || m.rowFirstName} ${m.seq.patients?.last_name || m.rowLastName}`.trim();
    a.bookedPatients.push(name);
    const sLower = m.status.toLowerCase();
    if (sLower.includes('complete')) a.completedVisits++;
    if (sLower.includes('cancel') || sLower.includes('no show') || sLower.includes('no-show')) a.cancelled++;
  }

  // 6. Print report
  console.log('\n=========================== RESULTS ===========================\n');
  console.log('CSV parsing:');
  console.log(`  Total rows in CSV: ${rows.length}`);
  console.log(`  Missing phone: ${csvWithoutPhone}`);
  console.log(`  Outside test window (before ${LAUNCH_DATE.toISOString().slice(0,10)}): ${csvOutsideWindow}`);
  console.log(`  Phones not in A/B test (other patients): ${csvNotInTest}`);
  console.log(`  Matched to A/B test patients: ${matches.length} (${bookedByPatient.size} unique patients)\n`);

  for (const arm of ['control_voice', 'offer_only']) {
    const a = stats[arm];
    const armLabel = arm === 'control_voice' ? 'ARM A — control_voice (3-voice sequence)' : 'ARM B — offer_only (single-send offer)';
    console.log(`\n${armLabel}`);
    console.log(`  Sent:              ${a.sent}`);
    console.log(`  Link clicks:       ${a.linkClicks} (${pct(a.linkClicks, a.sent)})`);
    console.log(`  Intent-to-book:    ${a.intentBooked} (${pct(a.intentBooked, a.sent)})`);
    console.log(`  ACTUAL booked:     ${a.actualBooked} (${pct(a.actualBooked, a.sent)}) ← from Dentrix`);
    console.log(`  Visits completed:  ${a.completedVisits} (${pct(a.completedVisits, a.sent)})`);
    console.log(`  Cancelled/no-show: ${a.cancelled}`);
    if (a.bookedPatients.length > 0 && a.bookedPatients.length <= 30) {
      console.log(`  Booked patients:`);
      a.bookedPatients.forEach(n => console.log(`    - ${n}`));
    }
  }

  // 7. Winner declaration
  const A = stats.control_voice;
  const B = stats.offer_only;
  console.log('\n=========================== WINNER ===========================');
  console.log(`Arm A booking rate: ${pct(A.actualBooked, A.sent)} (${A.actualBooked} / ${A.sent})`);
  console.log(`Arm B booking rate: ${pct(B.actualBooked, B.sent)} (${B.actualBooked} / ${B.sent})`);
  const winner = A.actualBooked > B.actualBooked ? 'A (control_voice)'
              : B.actualBooked > A.actualBooked ? 'B (offer_only)'
              : 'TIE';
  console.log(`\nWinner by actual bookings: Arm ${winner}`);
  if (A.actualBooked !== B.actualBooked) {
    const diff = Math.abs(A.actualBooked - B.actualBooked);
    const denom = Math.max(A.sent, B.sent);
    console.log(`Margin: ${diff} bookings (${pct(diff, denom)} of sample)`);
  }
}

function pct(n: number, d: number): string {
  if (d === 0) return '0.0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

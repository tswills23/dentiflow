#!/usr/bin/env npx tsx
// Arm B attribution forensics — investigates how 199 patients produced 23 Dentrix
// bookings with 0 link clicks and 5 replies. Read-only.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LAUNCH_DATE = new Date('2026-05-12T14:00:00Z');
const RUN_DATE = new Date('2026-05-19T23:59:59Z');

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
    let y = parseInt(m[3]); if (y < 100) y += 2000;
    const d2 = new Date(y, parseInt(m[1]) - 1, parseInt(m[2]));
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lo = lines[i].toLowerCase();
    if (lo.includes('phone') || lo.includes('appt date')) { headerIdx = i; break; }
  }
  const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells: string[] = []; let cur = '', inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim().replace(/^"|"$/g, ''); });
    rows.push(row);
  }
  return rows;
}
function pct(n: number, d: number): string { return d === 0 ? '0.0%' : `${((n/d)*100).toFixed(1)}%`; }

async function main() {
  console.log('\n========== ARM B FORENSICS — Hypothesis test ==========\n');

  // 1. Load A/B sequences + patients (paginate — supabase default cap is 1000 rows)
  const seqs: any[] = [];
  let from = 0; const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('recall_sequences')
      .select('id, patient_id, experiment_arm, link_clicked_at, booking_stage, created_at, sequence_status, exit_reason, months_overdue, patients!inner(first_name, last_name, phone, last_visit_date)')
      .eq('practice_id', PRACTICE_ID)
      .in('experiment_arm', ['control_voice', 'offer_only'])
      .range(from, from + PAGE - 1);
    if (error) { console.error('seq err', error); break; }
    if (!data || data.length === 0) break;
    seqs.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  type Seq = any;
  const armB: Seq[] = [], armA: Seq[] = [];
  const phoneToSeq = new Map<string, Seq>();
  const abPatientIds = new Set<string>();
  for (const s of seqs as Seq[]) {
    if (s.experiment_arm === 'offer_only') armB.push(s);
    else if (s.experiment_arm === 'control_voice') armA.push(s);
    const p = normalizePhone(s.patients?.phone || '');
    if (p) phoneToSeq.set(p, s);
    abPatientIds.add(s.patient_id);
  }
  console.log(`Arm A (control_voice): ${armA.length}   Arm B (offer_only): ${armB.length}`);

  // 2. Count engagement signals per arm
  function engagementStats(arr: Seq[], label: string) {
    const clicks = arr.filter(s => s.link_clicked_at).length;
    const intent = arr.filter(s => s.booking_stage === 'S6_COMPLETED').length;
    const repliedSeq = arr.filter(s => (s.reply_count || 0) > 0).length;
    console.log(`  ${label}: clicks=${clicks}  intent_booked=${intent}  reply_count>0=${repliedSeq}`);
    return { clicks, intent, repliedSeq };
  }
  console.log('\nEngagement signals (from sequences):');
  const aEng = engagementStats(armA, 'Arm A');
  const bEng = engagementStats(armB, 'Arm B');

  // 3. Pull conversations (replies) for all A/B patients to cross-check
  // Pull all inbound conversations practice-wide since launch, then filter to A/B patients
  const convs: any[] = [];
  {
    let cFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from('conversations')
        .select('patient_id, direction, created_at')
        .eq('practice_id', PRACTICE_ID)
        .eq('direction', 'inbound')
        .gte('created_at', LAUNCH_DATE.toISOString())
        .range(cFrom, cFrom + 999);
      if (error) { console.error('conv err', error); break; }
      if (!data || data.length === 0) break;
      convs.push(...data);
      if (data.length < 1000) break;
      cFrom += 1000;
    }
  }
  console.log(`  Total inbound conversations practice-wide since launch: ${convs.length}`);
  const repliesByPatient = new Map<string, any[]>();
  for (const c of convs) {
    if (!abPatientIds.has(c.patient_id)) continue;
    const arr = repliesByPatient.get(c.patient_id) || [];
    arr.push(c); repliesByPatient.set(c.patient_id, arr);
  }
  const armB_repliedIds = new Set(armB.filter(s => repliesByPatient.has(s.patient_id)).map(s => s.patient_id));
  const armA_repliedIds = new Set(armA.filter(s => repliesByPatient.has(s.patient_id)).map(s => s.patient_id));
  console.log(`\nConversations cross-check (inbound since launch):`);
  console.log(`  Arm A replied: ${armA_repliedIds.size}   Arm B replied: ${armB_repliedIds.size}`);

  // 4. Parse Dentrix CSV
  const csvText = readFileSync(resolve('Interactive+Schedule+Report+Builder.csv'), 'utf8');
  const rows = parseCSV(csvText);
  console.log(`\nDentrix CSV: ${rows.length} appointment rows`);

  const PHONE_COLS = ['phone','mobile phone','patient phone','cell phone','phone number','mobile','cell'];
  const DATE_COLS = ['appt date','appointment date','scheduled date','date','created','created date','appt'];
  function pick(row: Record<string,string>, cols: string[]) {
    for (const c of cols) { const v = row[c]; if (v) return v; } return '';
  }

  // 5. Match Dentrix → A/B; also collect non-A/B bookings for baseline
  type Match = { seq: Seq; apptDate: Date | null; daysFromSend: number | null; status: string; first: string; last: string; phone: string };
  const matchesB: Match[] = [], matchesA: Match[] = [];
  const nonABBookings = new Map<string, Date>(); // phone -> earliest appt date
  for (const row of rows) {
    const phoneRaw = pick(row, PHONE_COLS);
    if (!phoneRaw) continue;
    const phone = normalizePhone(phoneRaw);
    const dateRaw = pick(row, DATE_COLS);
    const apptDate = dateRaw ? parseDate(dateRaw) : null;
    // Appt Date in Dentrix is the SCHEDULED visit date, not creation date.
    // Most bookings made via SMS are scheduled for future dates, so we keep
    // any appt date on/after launch with no upper bound.
    if (apptDate && apptDate < LAUNCH_DATE) continue;
    const seq = phoneToSeq.get(phone);
    const status = row['appt status'] || row['status'] || '';
    const first = row['first name'] || ''; const last = row['last name'] || '';
    if (seq) {
      const days = apptDate ? Math.floor((apptDate.getTime() - LAUNCH_DATE.getTime()) / 86400000) : null;
      const m: Match = { seq, apptDate, daysFromSend: days, status, first, last, phone };
      if (seq.experiment_arm === 'offer_only') matchesB.push(m);
      else if (seq.experiment_arm === 'control_voice') matchesA.push(m);
    } else if (phone) {
      const existing = nonABBookings.get(phone);
      if (!existing || (apptDate && apptDate < existing)) nonABBookings.set(phone, apptDate || new Date());
    }
  }

  // Dedupe to one earliest appt per patient
  function dedupe(matches: Match[]): Match[] {
    const m = new Map<string, Match>();
    for (const x of matches) {
      const ex = m.get(x.seq.patient_id);
      if (!ex || (x.apptDate && (!ex.apptDate || x.apptDate < ex.apptDate))) m.set(x.seq.patient_id, x);
    }
    return Array.from(m.values());
  }
  const bookedB = dedupe(matchesB);
  const bookedA = dedupe(matchesA);
  console.log(`\nUnique bookers: Arm A=${bookedA.length}  Arm B=${bookedB.length}`);

  // 6. H1: Time-delta clustering
  function cluster(bookings: Match[], label: string) {
    const buckets = { sameDay: 0, day1: 0, day2_3: 0, day4plus: 0, unknown: 0 };
    for (const b of bookings) {
      if (b.daysFromSend == null) { buckets.unknown++; continue; }
      if (b.daysFromSend <= 0) buckets.sameDay++;
      else if (b.daysFromSend === 1) buckets.day1++;
      else if (b.daysFromSend <= 3) buckets.day2_3++;
      else buckets.day4plus++;
    }
    console.log(`\n  ${label} time-from-send distribution:`);
    console.log(`    same day (0): ${buckets.sameDay}`);
    console.log(`    +1 day:       ${buckets.day1}`);
    console.log(`    +2-3 days:    ${buckets.day2_3}`);
    console.log(`    +4-7 days:    ${buckets.day4plus}`);
    console.log(`    unknown date: ${buckets.unknown}`);
    return buckets;
  }
  console.log('\n========== H1: Booking timing vs send date ==========');
  const bClust = cluster(bookedB, 'Arm B');
  const aClust = cluster(bookedA, 'Arm A');

  // 7. H3: did any Arm B bookers click or reply?
  console.log('\n========== H3: Arm B booker engagement ==========');
  let bClicked = 0, bReplied = 0, bSilent = 0;
  for (const b of bookedB) {
    if (b.seq.link_clicked_at) bClicked++;
    else if (repliesByPatient.has(b.seq.patient_id) || (b.seq.reply_count || 0) > 0) bReplied++;
    else bSilent++;
  }
  console.log(`  Arm B bookers who clicked link: ${bClicked} / ${bookedB.length}`);
  console.log(`  Arm B bookers who replied SMS:  ${bReplied} / ${bookedB.length}`);
  console.log(`  Arm B bookers with NO engagement: ${bSilent} / ${bookedB.length}  ← phone-call or organic`);

  let aClicked = 0, aReplied = 0, aSilent = 0;
  for (const b of bookedA) {
    if (b.seq.link_clicked_at) aClicked++;
    else if (repliesByPatient.has(b.seq.patient_id) || (b.seq.reply_count || 0) > 0) aReplied++;
    else aSilent++;
  }
  console.log(`  Arm A bookers who clicked link: ${aClicked} / ${bookedA.length}`);
  console.log(`  Arm A bookers who replied SMS:  ${aReplied} / ${bookedA.length}`);
  console.log(`  Arm A bookers with NO engagement: ${aSilent} / ${bookedA.length}`);

  // 8. H2/Baseline: overdue patients NOT in A/B test, were they booking at similar rate?
  console.log('\n========== H2/Baseline: Non-A/B overdue patients ==========');
  // Build candidate pool: overdue patients in DB, not in A/B
  const overdueAll: any[] = [];
  let oFrom = 0;
  let overdueCount: number | null = null;
  while (true) {
    // Use last_visit_date < 6 months ago as proxy for "overdue"
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 86400000).toISOString().slice(0, 10);
    const { data, count } = await supabase
      .from('patients')
      .select('id, phone, last_visit_date, recall_opt_out', { count: 'exact' })
      .eq('practice_id', PRACTICE_ID)
      .lt('last_visit_date', sixMonthsAgo)
      .eq('recall_opt_out', false)
      .range(oFrom, oFrom + 999);
    if (count != null && overdueCount == null) overdueCount = count;
    if (!data || data.length === 0) break;
    overdueAll.push(...data);
    if (data.length < 1000) break;
    oFrom += 1000;
  }
  const overduePool = overdueAll.filter(p => !abPatientIds.has(p.id) && p.phone);
  console.log(`  Overdue (>=6mo) patients in DB total: ${overdueCount}`);
  console.log(`  Excl. A/B participants: ${overduePool.length}`);

  // Of those, how many appear in the Dentrix CSV with appt in window?
  const overduePhones = new Set(overduePool.map(p => normalizePhone(p.phone || '')).filter(Boolean));
  let baselineBooked = 0;
  for (const phone of overduePhones) {
    if (nonABBookings.has(phone)) baselineBooked++;
  }
  console.log(`  Of those, booked in window: ${baselineBooked}`);
  console.log(`  Baseline organic-booking rate: ${pct(baselineBooked, overduePhones.size)}`);

  // 9. H4: loose phone matching false positives?
  console.log('\n========== H4: Phone match precision ==========');
  let nameMismatch = 0, nameMatch = 0, nameUnknown = 0;
  for (const m of bookedB) {
    const seqFirst = (m.seq.patients?.first_name || '').toLowerCase().trim();
    const seqLast = (m.seq.patients?.last_name || '').toLowerCase().trim();
    const csvFirst = m.first.toLowerCase().trim();
    const csvLast = m.last.toLowerCase().trim();
    if (!seqFirst || !csvFirst) { nameUnknown++; continue; }
    if (seqLast && csvLast && seqLast === csvLast) nameMatch++;
    else if (seqFirst === csvFirst) nameMatch++;
    else nameMismatch++;
  }
  console.log(`  Arm B booker name match (CSV vs DB):`);
  console.log(`    match:    ${nameMatch}`);
  console.log(`    mismatch: ${nameMismatch}  ← potential false positives`);
  console.log(`    unknown:  ${nameUnknown}`);

  // 10. Summary numbers
  console.log('\n========== SUMMARY ==========');
  console.log(`Arm B sent: ${armB.length}`);
  console.log(`  link clicks:       ${bEng.clicks}`);
  console.log(`  inbound replies:   ${armB_repliedIds.size}`);
  console.log(`  Dentrix bookings:  ${bookedB.length} (${pct(bookedB.length, armB.length)})`);
  console.log(`  → silent (no engagement) bookers: ${bSilent}`);
  console.log(`Arm A sent: ${armA.length}`);
  console.log(`  link clicks:       ${aEng.clicks}`);
  console.log(`  inbound replies:   ${armA_repliedIds.size}`);
  console.log(`  Dentrix bookings:  ${bookedA.length} (${pct(bookedA.length, armA.length)})`);
  console.log(`  → silent (no engagement) bookers: ${aSilent}`);
  console.log(`Baseline (non-A/B overdue): ${pct(baselineBooked, overduePhones.size)} booked in window`);
  console.log(`  raw: ${baselineBooked} / ${overduePhones.size}`);

  // Project baseline expected bookings if A/B group had received nothing
  const baselineRate = overduePhones.size > 0 ? baselineBooked / overduePhones.size : 0;
  const expectedB = baselineRate * armB.length;
  const expectedA = baselineRate * armA.length;
  console.log(`\nIf A/B had been a no-send holdout at baseline rate:`);
  console.log(`  Expected Arm A bookings: ${expectedA.toFixed(1)}  (actual ${bookedA.length}, lift ${(bookedA.length - expectedA).toFixed(1)})`);
  console.log(`  Expected Arm B bookings: ${expectedB.toFixed(1)}  (actual ${bookedB.length}, lift ${(bookedB.length - expectedB).toFixed(1)})`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });

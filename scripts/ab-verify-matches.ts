import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CSV = "c:/Users/tswil/Dentiflow speed to lead/Interactive+Schedule+Report+Builder.csv";
const LAUNCH = new Date('2026-05-12T00:00:00Z');

function normPhone(s: string): string {
  return (s || '').replace(/\D/g, '').slice(-10);
}
function normName(s: string): string {
  return (s || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

async function main() {
  // 1. Load A/B patients
  const { data: seqs, error: seqErr } = await sb
    .from('recall_sequences')
    .select('experiment_arm, patient_id, link_clicked_at')
    .in('experiment_arm', ['control_voice', 'offer_only'])
    .limit(2000);
  if (seqErr) console.error('seq err', seqErr);
  if (!seqs) return;
  console.log('DEBUG seqs loaded:', seqs.length);
  const patIds = seqs.map(s => s.patient_id);
  const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i=0;i<a.length;i+=n) o.push(a.slice(i,i+n)); return o; };
  const pats: any[] = [];
  for (const c of chunk(patIds, 100)) {
    const { data, error } = await sb.from('patients').select('id, first_name, last_name, phone').in('id', c);
    if (error) console.error('pat err', error);
    if (data) pats.push(...data);
  }
  console.log('DEBUG pats loaded:', pats.length);
  const patById = new Map(pats.map(p => [p.id, p]));

  // build phone → A/B seq lookup
  type AB = { arm: string; first: string; last: string; phone: string; clicked: boolean };
  const phoneToAB = new Map<string, AB>();
  seqs.forEach(s => {
    const p = patById.get(s.patient_id);
    if (!p?.phone) return;
    phoneToAB.set(normPhone(p.phone), {
      arm: s.experiment_arm,
      first: normName(p.first_name || ''),
      last: normName(p.last_name || ''),
      phone: p.phone,
      clicked: !!s.link_clicked_at,
    });
  });

  // 2. Parse CSV (autodetect header row)
  const text = readFileSync(CSV, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let hdrIdx = 0;
  for (let i = 0; i < 20; i++) {
    if (lines[i].toLowerCase().includes('phone') || lines[i].toLowerCase().includes('first name')) {
      hdrIdx = i; break;
    }
  }
  const headers = lines[hdrIdx].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
  const fnIdx = headers.indexOf('first name');
  const lnIdx = headers.indexOf('last name');
  const phIdx = headers.indexOf('phone');
  const dtIdx = headers.indexOf('appt date');
  const stIdx = headers.indexOf('appt status');

  console.log('DEBUG phoneToAB size=', phoneToAB.size, 'idx fn/ln/ph/dt/st=', fnIdx, lnIdx, phIdx, dtIdx, stIdx);
  let csvRows = 0, phMatches = 0, dateOk = 0, dateFail = 0;
  // 3. Match each CSV row, verify name
  type Match = { arm: string; csvFirst: string; csvLast: string; dbFirst: string; dbLast: string; phone: string; apptDate: string; status: string; nameOk: boolean; clicked: boolean };
  const matchesByPatient = new Map<string, Match[]>();
  for (let i = hdrIdx + 1; i < lines.length; i++) {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    csvRows++;
    const phone = normPhone(cells[phIdx] || '');
    if (!phone) continue;
    const ab = phoneToAB.get(phone);
    if (!ab) continue;
    phMatches++;
    const apptDate = cells[dtIdx] || '';
    const d = new Date(apptDate);
    if (isNaN(d.getTime()) || d < LAUNCH) { dateFail++; continue; }
    dateOk++;

    const csvFirst = normName(cells[fnIdx] || '');
    const csvLast = normName(cells[lnIdx] || '');
    // Name OK: last name must match exactly; first name must match OR be prefix (nickname tolerance)
    const lastOk = ab.last && csvLast && (ab.last === csvLast || ab.last.startsWith(csvLast) || csvLast.startsWith(ab.last));
    const firstOk = ab.first && csvFirst && (ab.first === csvFirst || ab.first.startsWith(csvFirst) || csvFirst.startsWith(ab.first));
    const nameOk = !!(lastOk && firstOk);

    const m: Match = {
      arm: ab.arm,
      csvFirst: cells[fnIdx] || '', csvLast: cells[lnIdx] || '',
      dbFirst: ab.first, dbLast: ab.last,
      phone: ab.phone, apptDate, status: cells[stIdx] || '',
      nameOk, clicked: ab.clicked,
    };
    const arr = matchesByPatient.get(phone) || [];
    arr.push(m);
    matchesByPatient.set(phone, arr);
  }

  // Dedupe: one patient = one booking (earliest appt)
  const bookedByPatient = new Map<string, Match>();
  for (const [phone, arr] of matchesByPatient.entries()) {
    arr.sort((a,b) => new Date(a.apptDate).getTime() - new Date(b.apptDate).getTime());
    bookedByPatient.set(phone, arr[0]);
  }

  // 4. Aggregate
  const stats: Record<string, { total: number; nameMatch: number; nameMismatch: number; clickedAndBooked: number; clickedAndBookedNameOk: number }> = {
    control_voice: { total: 0, nameMatch: 0, nameMismatch: 0, clickedAndBooked: 0, clickedAndBookedNameOk: 0 },
    offer_only: { total: 0, nameMatch: 0, nameMismatch: 0, clickedAndBooked: 0, clickedAndBookedNameOk: 0 },
  };
  const mismatches: Match[] = [];
  for (const m of bookedByPatient.values()) {
    const s = stats[m.arm];
    s.total++;
    if (m.nameOk) s.nameMatch++;
    else { s.nameMismatch++; mismatches.push(m); }
    if (m.clicked) {
      s.clickedAndBooked++;
      if (m.nameOk) s.clickedAndBookedNameOk++;
    }
  }

  console.log(`DEBUG csvRows=${csvRows} phMatches=${phMatches} dateOk=${dateOk} dateFail=${dateFail}`);
  console.log('\n========== VERIFICATION BY PHONE + NAME ==========\n');
  for (const arm of ['control_voice', 'offer_only']) {
    const s = stats[arm];
    console.log(`${arm}:`);
    console.log(`  Phone matches:                 ${s.total}`);
    console.log(`  ✅ Phone + name match:         ${s.nameMatch}`);
    console.log(`  ⚠️  Phone match, name MISMATCH: ${s.nameMismatch}`);
    console.log(`  Link-clickers who booked:      ${s.clickedAndBooked} (${s.clickedAndBookedNameOk} verified by name)`);
    console.log('');
  }

  console.log('========== NAME MISMATCH DETAILS (review manually) ==========\n');
  mismatches.forEach(m => {
    console.log(`[${m.arm}] phone=${m.phone} | DB: ${m.dbFirst} ${m.dbLast} → CSV: ${m.csvFirst} ${m.csvLast} | appt=${m.apptDate} status=${m.status}`);
  });
}
main().catch(e => { console.error(e); process.exit(1); });

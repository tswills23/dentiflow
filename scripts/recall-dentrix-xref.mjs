// Cross-reference round-2 texted cohort vs a Dentrix Ascend schedule export.
// Usage: node scripts/recall-dentrix-xref.mjs "C:\path\to\export.xlsx"
// Defaults to the latest "Interactive Schedule Report Builder - recall May.xlsx" in Downloads.
// Writes a timestamped snapshot to scripts/_dentrix-xref/ so pulls can be compared over time.
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });
const { createClient } = await import('@supabase/supabase-js');
const xlsx = (await import('xlsx')).default;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const ROUND_START = '2026-06-03T00:00:00';

const file = process.argv[2] || (process.env.USERPROFILE + '/Downloads/Interactive Schedule Report Builder - recall May.xlsx');
const norm = (p) => (p ? String(p).replace(/\D/g, '').slice(-10) : '');
const fmt = (d) => d instanceof Date ? d.toISOString().slice(0,10) : String(d);

// --- 1. Load Dentrix appointment export ---
const wb = xlsx.readFile(file, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });
const hdrIdx = raw.findIndex(r => Array.isArray(r) && r.includes('Appt Date'));
const appts = [];
for (let i = hdrIdx + 1; i < raw.length; i++) {
  const r = raw[i];
  if (!r || !r.length) continue;
  const phone = norm(r[4]);
  if (!phone) continue;
  appts.push({ date: r[0], first: r[1], last: r[2], phone, status: r[5] });
}
const apptByPhone = new Map();
for (const a of appts) {
  const ex = apptByPhone.get(a.phone);
  if (!ex || (a.date < ex.date)) apptByPhone.set(a.phone, a);
}
console.log(`Dentrix export: ${appts.length} appt rows, ${apptByPhone.size} unique phones (appt date >= 6/3)\n`);

// --- 2. Round-2 texted cohort ---
const { data: seqs, error } = await supabase
  .from('recall_sequences')
  .select('patient_id, link_clicked_at, booking_stage, sequence_status, patients!inner(first_name, last_name, phone, location)')
  .eq('practice_id', PID)
  .gte('last_sent_at', ROUND_START);
if (error) { console.error(error.message); process.exit(1); }

const cohort = new Map();
const rank = (r) => (r.booking_stage === 'S6_COMPLETED' ? 2 : r.link_clicked_at ? 1 : 0);
for (const s of seqs) {
  const ph = norm(s.patients?.phone);
  if (!ph) continue;
  const prev = cohort.get(ph);
  if (!prev || rank(s) > rank(prev)) cohort.set(ph, s);
}
console.log(`Round-2 cohort: ${seqs.length} sequences, ${cohort.size} unique phones\n`);

// --- 3. Cross-reference ---
const matched = [];
for (const [ph, s] of cohort) {
  const appt = apptByPhone.get(ph);
  if (!appt) continue;
  matched.push({
    name: `${s.patients.first_name} ${s.patients.last_name}`,
    phone: ph,
    apptDate: fmt(appt.date),
    apptStatus: appt.status,
    stage: s.booking_stage || '-',
    clicked: s.link_clicked_at ? s.link_clicked_at.slice(0,10) : '-',
    isS6: s.booking_stage === 'S6_COMPLETED',
  });
}
matched.sort((a,b) => a.apptDate.localeCompare(b.apptDate));
const s6 = matched.filter(m => m.isS6);
const clickedNotS6 = matched.filter(m => !m.isS6 && m.clicked !== '-');
const noClickNotS6 = matched.filter(m => !m.isS6 && m.clicked === '-');

const print = (label, arr) => { console.log(`\n--- ${label}: ${arr.length} ---`); arr.forEach((m,i)=>console.log(`${i+1}. ${m.name} | ${m.phone} | appt ${m.apptDate} ${m.apptStatus} | clicked ${m.clicked} | stage ${m.stage}`)); };
console.log(`Texted patients with an appointment on the books (>= 6/3): ${matched.length}`);
print('A. System-confirmed (S6_COMPLETED)', s6);
print('B. Incremental — clicked, booked outside loop', clickedNotS6);
print('C. Incremental — booked, never clicked', noClickNotS6);
console.log(`\n========== TOTALS ==========`);
console.log(`System-confirmed (S6):        ${s6.length}`);
console.log(`Incremental (clicked, no S6): ${clickedNotS6.length}`);
console.log(`Incremental (no click):       ${noClickNotS6.length}`);
console.log(`TOTAL with appointment:       ${matched.length}`);

// --- 4. Snapshot for cross-pull comparison ---
const stamp = new Date().toISOString().slice(0,10);
const outDir = resolve(__dirname, '_dentrix-xref');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `snapshot-${stamp}.json`);
writeFileSync(out, JSON.stringify({ pulledAt: new Date().toISOString(), sourceFile: file, totals: { s6: s6.length, clickedNotS6: clickedNotS6.length, noClickNotS6: noClickNotS6.length, total: matched.length }, matched }, null, 2));
console.log(`\nSnapshot written: ${out}`);
console.log(`Next pull: run this script with the new export, then diff snapshot JSONs to see who trickled in.`);
process.exit(0);

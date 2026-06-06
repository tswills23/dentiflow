// Generate partner-ready stats from the unscheduled treatment segmentation.
// Reads the procedures CSV (already deduped + filtered) and produces breakdowns.
import { readFileSync } from 'fs';

const path = 'c:/Users/tswil/Dentiflow v2/imports/unscheduled-tx-hot-leads-procedures-2026-06-01.csv';
const raw = readFileSync(path, 'utf-8');

function parseCsvLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function money(s) {
  return parseFloat(String(s).replace(/[$,"]/g, '')) || 0;
}

const lines = raw.split('\n').filter(l => l.trim());
const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(parseCsvLine);

// Cols: Last Name, First Name, Phone, Email, Location, Last Visit, Next Appt, Tx Date, Code, Description, Amount, Provider, Carrier, Remaining Benefits, Renewal Month
const idx = (name) => header.indexOf(name);
const COL = {
  phone: idx('Phone'),
  location: idx('Location'),
  code: idx('Code'),
  desc: idx('Description'),
  amount: idx('Amount'),
  nextAppt: idx('Next Appt'),
};

// Patient set
const patients = new Map();
for (const r of rows) {
  const phone = r[COL.phone];
  if (!patients.has(phone)) {
    patients.set(phone, { location: r[COL.location], nextAppt: r[COL.nextAppt], procs: [], total: 0 });
  }
  const p = patients.get(phone);
  const amt = money(r[COL.amount]);
  p.procs.push({ code: r[COL.code], desc: r[COL.desc], amount: amt });
  p.total += amt;
}

const total = rows.length;
const totalDollars = rows.reduce((s, r) => s + money(r[COL.amount]), 0);
const uniquePatients = patients.size;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  UNSCHEDULED TREATMENT — HOT LEADS REPORT (6/1/2026)');
console.log('  Filter: patients last seen within 6 months');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('TOP-LINE NUMBERS');
console.log(`  Unique hot-lead patients:    ${uniquePatients}`);
console.log(`  Unscheduled procedures:      ${total}`);
console.log(`  Total case value:            $${totalDollars.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`  Avg case value / patient:    $${(totalDollars / uniquePatients).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`  Avg procedure value:         $${(totalDollars / total).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log();

// By location
console.log('BY LOCATION');
const locStats = {};
for (const [phone, p] of patients) {
  const loc = p.location || '(No Location)';
  if (!locStats[loc]) locStats[loc] = { patients: 0, dollars: 0, ghosting: 0 };
  locStats[loc].patients++;
  locStats[loc].dollars += p.total;
  if (!p.nextAppt) locStats[loc].ghosting++;
}
const locs = Object.keys(locStats).sort((a, b) => locStats[b].dollars - locStats[a].dollars);
for (const loc of locs) {
  const s = locStats[loc];
  console.log(`  ${loc.padEnd(32)}  ${String(s.patients).padStart(4)} patients  $${s.dollars.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(13)}  (${s.ghosting} ghosting)`);
}
console.log();

// By procedure code
console.log('BY PROCEDURE TYPE');
const codeStats = {};
for (const r of rows) {
  const code = r[COL.code];
  if (!codeStats[code]) codeStats[code] = { count: 0, dollars: 0, desc: r[COL.desc] };
  codeStats[code].count++;
  codeStats[code].dollars += money(r[COL.amount]);
}
const codes = Object.keys(codeStats).sort((a, b) => codeStats[b].dollars - codeStats[a].dollars);
for (const code of codes) {
  const s = codeStats[code];
  console.log(`  ${code}  ${s.desc.padEnd(38)}  ${String(s.count).padStart(4)} procs  $${s.dollars.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(13)}`);
}
console.log();

// Big treatment grouping
const BIG_CODES = new Set(['D2740','D2750','D2751','D2752','D3310','D3320','D3330','D6010','D6058','D6240','D6750']);
let bigCount = 0, bigDollars = 0;
let supportCount = 0, supportDollars = 0;
for (const r of rows) {
  const amt = money(r[COL.amount]);
  if (BIG_CODES.has(r[COL.code])) { bigCount++; bigDollars += amt; }
  else { supportCount++; supportDollars += amt; }
}
console.log('BIG vs SUPPORTING PROCEDURES');
console.log(`  Big (crowns/RCT/implants/bridges):  ${String(bigCount).padStart(4)} procs  $${bigDollars.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(13)}`);
console.log(`  Supporting (buildups/perio):        ${String(supportCount).padStart(4)} procs  $${supportDollars.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(13)}`);
console.log();

// Case-size distribution
console.log('PATIENT CASE-SIZE DISTRIBUTION');
const buckets = [
  { name: '$300 – $999',    min: 300,  max: 1000 },
  { name: '$1,000 – $1,999', min: 1000, max: 2000 },
  { name: '$2,000 – $4,999', min: 2000, max: 5000 },
  { name: '$5,000 – $9,999', min: 5000, max: 10000 },
  { name: '$10,000+',         min: 10000, max: Infinity },
];
const bucketStats = buckets.map(b => ({ ...b, count: 0, dollars: 0 }));
for (const [phone, p] of patients) {
  for (const b of bucketStats) {
    if (p.total >= b.min && p.total < b.max) { b.count++; b.dollars += p.total; break; }
  }
}
for (const b of bucketStats) {
  console.log(`  ${b.name.padEnd(20)}  ${String(b.count).padStart(4)} patients  $${b.dollars.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(13)}`);
}
console.log();

// Conversion math
console.log('REVENUE PROJECTIONS (at various conversion rates)');
console.log('  These patients were diagnosed treatment-planned and didn\'t book.');
console.log('  Industry rule of thumb: warm reactivation converts 10–25%.');
console.log();
const rates = [0.05, 0.10, 0.15, 0.20, 0.25];
for (const r of rates) {
  const rev = totalDollars * r;
  console.log(`  ${(r * 100).toString().padStart(3)}% conversion → $${rev.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).padStart(10)}  (${Math.round(uniquePatients * r)} cases closed)`);
}
console.log();
console.log('═══════════════════════════════════════════════════════════════');

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

let csv = readFileSync('c:/Users/tswil/Downloads/Active Patient List- 2026.csv', 'utf-8').replace(/^\uFEFF/, '');
const lines = csv.split('\n');

let hdr = 0;
for (let i = 0; i < 20; i++) {
  if (lines[i].toLowerCase().includes('phone') && lines[i].toLowerCase().includes('patient')) {
    hdr = i;
    break;
  }
}
csv = lines.slice(hdr).join('\n');

const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });

let withAppt = 0;
let noPhone = 0;
let good = 0;
const locs = {};
const segs = {};

rows.forEach(r => {
  const appt = r['Next Appointment Date'];
  if (appt && appt.trim()) { withAppt++; return; }

  const phone = r['Phone'];
  if (!phone || !phone.trim()) { noPhone++; return; }

  good++;
  const loc = (r['Preferred Location'] || '').trim() || '(none)';
  locs[loc] = (locs[loc] || 0) + 1;

  const lv = r['Last Visit'];
  if (lv) {
    const d = new Date(lv);
    const mo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    let s;
    if (mo < 6) s = 'recent (<6mo)';
    else if (mo < 12) s = 'office (6-12mo)';
    else if (mo < 24) s = 'hygienist (12-24mo)';
    else s = 'doctor (24+mo)';
    segs[s] = (segs[s] || 0) + 1;
  }
});

console.log('Total rows:', rows.length);
console.log('With upcoming appt (skipped):', withAppt);
console.log('No phone (skipped):', noPhone);
console.log('Eligible for recall:', good);
console.log('');
console.log('LOCATIONS:');
Object.entries(locs).sort((a, b) => b[1] - a[1]).forEach(([loc, count]) => console.log(`  ${loc}: ${count}`));
console.log('');
console.log('OVERDUE SEGMENTS:');
Object.entries(segs).sort((a, b) => b[1] - a[1]).forEach(([seg, count]) => console.log(`  ${seg}: ${count}`));

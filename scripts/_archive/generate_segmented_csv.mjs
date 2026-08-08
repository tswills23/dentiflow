import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read CSV
let csv = readFileSync('c:/Users/tswil/Downloads/Active Patient List- 2026.csv', 'utf-8').replace(/^\uFEFF/, '');

// Skip title rows
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

// Process each row
const output = [];
let skippedAppt = 0;
let skippedNoPhone = 0;

for (const r of rows) {
  const appt = (r['Next Appointment Date'] || '').trim();
  const phone = (r['Phone'] || '').trim();
  const patient = (r['Patient'] || '').trim();
  const email = (r['Email'] || '').trim();
  const lastVisit = (r['Last Visit'] || '').trim();
  const location = (r['Preferred Location'] || '').trim();

  // Parse "Last, First" name
  let firstName = '', lastName = '';
  if (patient) {
    const clean = patient.replace(/\s*~\s*/g, ' ').trim();
    const commaIdx = clean.indexOf(',');
    if (commaIdx !== -1) {
      lastName = clean.slice(0, commaIdx).trim();
      const firstPart = clean.slice(commaIdx + 1).trim();
      firstName = firstPart.split(/\s+/)[0] || firstPart;
    } else {
      firstName = clean;
    }
  }

  // Skip reasons
  if (appt) { skippedAppt++; continue; }
  if (!phone) { skippedNoPhone++; continue; }

  // Normalize phone
  const digits = phone.replace(/\D/g, '');
  let normalizedPhone = '';
  if (digits.length === 10) normalizedPhone = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) normalizedPhone = `+${digits}`;
  else normalizedPhone = phone;

  // Calculate months overdue
  let monthsOverdue = 0;
  let segment = 'unknown';
  let voiceTier = 'office';
  if (lastVisit) {
    const d = new Date(lastVisit);
    if (!isNaN(d.getTime())) {
      monthsOverdue = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44) * 10) / 10;
      if (monthsOverdue < 6) { segment = 'recent'; voiceTier = 'office'; }
      else if (monthsOverdue < 12) { segment = 'mild'; voiceTier = 'office'; }
      else if (monthsOverdue < 24) { segment = 'moderate'; voiceTier = 'hygienist'; }
      else { segment = 'severe'; voiceTier = 'doctor'; }
    }
  }

  // Normalize date
  let isoDate = '';
  if (lastVisit) {
    const d = new Date(lastVisit);
    if (!isNaN(d.getTime())) isoDate = d.toISOString().split('T')[0];
  }

  output.push({
    firstName,
    lastName,
    phone: normalizedPhone,
    email,
    lastVisitDate: isoDate,
    monthsOverdue,
    segment,
    voiceTier,
    location,
  });
}

// Sort by months overdue descending (most overdue first)
output.sort((a, b) => b.monthsOverdue - a.monthsOverdue);

// Generate CSV
const csvHeader = 'First Name,Last Name,Phone,Email,Last Visit,Months Overdue,Segment,Voice Tier,Location';
const csvRows = output.map(r =>
  `"${r.firstName}","${r.lastName}","${r.phone}","${r.email}","${r.lastVisitDate}",${r.monthsOverdue},"${r.segment}","${r.voiceTier}","${r.location}"`
);

const csvOutput = [csvHeader, ...csvRows].join('\n');
const outPath = resolve(__dirname, '..', 'recall_segmented_output.csv');
writeFileSync(outPath, csvOutput, 'utf-8');

console.log(`Segmented CSV written to: ${outPath}`);
console.log(`Total eligible: ${output.length}`);
console.log(`Skipped (has appointment): ${skippedAppt}`);
console.log(`Skipped (no phone): ${skippedNoPhone}`);
console.log('');

// Summary table
const summary = {};
for (const r of output) {
  const key = `${r.location} | ${r.segment} | ${r.voiceTier}`;
  summary[key] = (summary[key] || 0) + 1;
}
console.log('SEGMENT BREAKDOWN BY LOCATION:');
console.log('Location | Segment | Voice | Count');
console.log('-'.repeat(55));
Object.entries(summary).sort((a, b) => {
  const [aLoc] = a[0].split(' | ');
  const [bLoc] = b[0].split(' | ');
  if (aLoc !== bLoc) return aLoc.localeCompare(bLoc);
  return b[1] - a[1];
}).forEach(([key, count]) => {
  console.log(`${key} | ${count}`);
});

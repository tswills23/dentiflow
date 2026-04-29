import fs from 'fs';

function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const rows = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === '\n' && !inQuotes) {
      rows.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) rows.push(current);

  const header = parseRow(rows[0]);
  return rows.slice(1).map(row => {
    const fields = parseRow(row);
    const obj = {};
    header.forEach((h, idx) => obj[h.trim()] = (fields[idx] || '').trim());
    return obj;
  });
}

function parseRow(row) {
  const fields = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (inQ && row[i + 1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

const classified = parseCSV('./recordings/classified_calls.csv');
const metadata = parseCSV('./recordings/call_metadata.csv');
const transcripts = parseCSV('./recordings/transcripts_master_full.csv');

// Build lookups
const metaByFile = new Map();
for (const row of metadata) {
  const fname = row.mp3_file?.replace(/"/g, '');
  if (fname) metaByFile.set(fname, row);
}

const transcriptByFile = new Map();
for (const row of transcripts) {
  if (row.filename) transcriptByFile.set(row.filename, row.transcript);
}

// All VOICEMAIL_ONLY with duration
const voicemails = classified
  .filter(r => r.primary_intent === 'VOICEMAIL_ONLY')
  .map(r => {
    const meta = metaByFile.get(r.filename);
    const transcript = transcriptByFile.get(r.filename) || '';
    const duration = meta ? parseInt(meta.duration_seconds) : 0;
    return { ...r, duration, transcript, startTime: meta?.start_time || '' };
  });

console.log(`Total VOICEMAIL_ONLY: ${voicemails.length}\n`);

// Duration distribution
const buckets = [
  { label: '0-30s', min: 0, max: 30, count: 0 },
  { label: '31-60s', min: 31, max: 60, count: 0 },
  { label: '61-90s', min: 61, max: 90, count: 0 },
  { label: '91-120s', min: 91, max: 120, count: 0 },
  { label: '121-180s (2-3 min)', min: 121, max: 180, count: 0 },
  { label: '181-300s (3-5 min)', min: 181, max: 300, count: 0 },
  { label: '301-600s (5-10 min)', min: 301, max: 600, count: 0 },
  { label: '600s+ (10+ min)', min: 601, max: 99999, count: 0 },
];

for (const v of voicemails) {
  for (const b of buckets) {
    if (v.duration >= b.min && v.duration <= b.max) { b.count++; break; }
  }
}

console.log('DURATION DISTRIBUTION OF "VOICEMAIL_ONLY" CALLS:');
console.log('─'.repeat(55));
for (const b of buckets) {
  const pct = ((b.count / voicemails.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(b.count / 30));
  console.log(`  ${b.label.padEnd(22)} ${String(b.count).padStart(5)}  (${pct.padStart(5)}%)  ${bar}`);
}

// Likely mislabeled: >120s duration
const suspicious = voicemails.filter(v => v.duration > 120);
console.log(`\n${'═'.repeat(55)}`);
console.log(`LIKELY MISLABELED (duration > 120s): ${suspicious.length}`);
console.log(`  = ${((suspicious.length / voicemails.length) * 100).toFixed(1)}% of all VOICEMAIL_ONLY`);

// Transcript length analysis for suspicious ones
const susTranscriptLengths = suspicious.map(v => v.transcript.length);
const shortTranscript = suspicious.filter(v => v.transcript.length < 100);
const medTranscript = suspicious.filter(v => v.transcript.length >= 100 && v.transcript.length < 500);
const longTranscript = suspicious.filter(v => v.transcript.length >= 500);

console.log(`\nTranscript length breakdown for ${suspicious.length} suspicious calls:`);
console.log(`  < 100 chars (Whisper failed):  ${shortTranscript.length}`);
console.log(`  100-500 chars (partial):        ${medTranscript.length}`);
console.log(`  500+ chars (has real content):   ${longTranscript.length}`);

// Show the ones with actual long transcripts - these are definitely mislabeled
console.log(`\n${'═'.repeat(55)}`);
console.log(`DEFINITELY MISLABELED: 500+ char transcript + 120s+ duration`);
console.log(`Count: ${longTranscript.length}`);

// Also check: what about the ones with medium transcripts?
console.log(`\n${'═'.repeat(55)}`);
console.log(`SAMPLE: 5 longest-duration "VOICEMAIL_ONLY" calls with their transcripts:\n`);

const top5 = [...suspicious].sort((a, b) => b.duration - a.duration).slice(0, 5);
for (const v of top5) {
  console.log(`--- ${v.duration}s | ${v.filename} ---`);
  console.log(`Transcript (${v.transcript.length} chars): ${v.transcript.substring(0, 300)}${v.transcript.length > 300 ? '...' : ''}`);
  console.log('');
}

// Impact on the overall analysis numbers
console.log(`${'═'.repeat(55)}`);
console.log('IMPACT ON ANALYSIS:');
console.log(`  Original "real conversations": 456`);
console.log(`  Mislabeled VM (>120s): ${suspicious.length}`);
console.log(`  Corrected "real conversations": ${456 + suspicious.length}`);
console.log(`  Original VM rate: ${((4165 / 4664) * 100).toFixed(1)}%`);
console.log(`  Corrected VM rate: ${(((4165 - suspicious.length) / 4664) * 100).toFixed(1)}%`);
console.log(`  Original real conversation rate: ${((456 / 4664) * 100).toFixed(1)}%`);
console.log(`  Corrected real conversation rate: ${(((456 + suspicious.length) / 4664) * 100).toFixed(1)}%`);

// Business hours breakdown of suspicious
const bizHoursSus = suspicious.filter(v => {
  const match = v.startTime.match(/T(\d{2}):/);
  if (!match) return false;
  const h = parseInt(match[1]);
  return h >= 8 && h < 17;
});
console.log(`\n  Suspicious calls during biz hours (8am-5pm): ${bizHoursSus.length} of ${suspicious.length}`);

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

// Load all 3 files
const classified = parseCSV('./recordings/classified_calls.csv');
const metadata = parseCSV('./recordings/call_metadata.csv');
const transcripts = parseCSV('./recordings/transcripts_master_full.csv');

// Build lookup maps
const metaByFile = new Map();
for (const row of metadata) {
  const fname = row.mp3_file?.replace(/"/g, '');
  if (fname) metaByFile.set(fname, row);
}

const transcriptByFile = new Map();
for (const row of transcripts) {
  if (row.filename) transcriptByFile.set(row.filename, row.transcript);
}

// Filter VOICEMAIL_ONLY with time data
const voicemails = classified
  .filter(r => r.primary_intent === 'VOICEMAIL_ONLY')
  .map(r => {
    const meta = metaByFile.get(r.filename);
    const transcript = transcriptByFile.get(r.filename);
    if (!meta || !transcript) return null;

    // Parse hour from start_time (ISO format with timezone)
    const startTime = meta.start_time?.replace(/"/g, '');
    if (!startTime) return null;

    // Extract the local hour from the ISO string
    const match = startTime.match(/T(\d{2}):/);
    if (!match) return null;
    const hour = parseInt(match[1]);

    return {
      filename: r.filename,
      company: r.company,
      startTime,
      hour,
      duration: meta.duration_seconds,
      transcript
    };
  })
  .filter(Boolean);

console.log(`Total VOICEMAIL_ONLY with time data: ${voicemails.length}`);

// Split by time window
const morning = voicemails.filter(v => v.hour >= 8 && v.hour < 12);
const afternoon = voicemails.filter(v => v.hour >= 12 && v.hour < 17);

console.log(`8am-12pm: ${morning.length}`);
console.log(`12pm-5pm: ${afternoon.length}\n`);

// Shuffle and pick 10 from each
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const morningSample = shuffle(morning).slice(0, 10);
const afternoonSample = shuffle(afternoon).slice(0, 10);

console.log('=' .repeat(80));
console.log('  8AM - 12PM WINDOW: 10 RANDOM "VOICEMAIL_ONLY" TRANSCRIPTS');
console.log('=' .repeat(80));

morningSample.forEach((v, i) => {
  console.log(`\n--- [MORNING ${i+1}/10] ---`);
  console.log(`File: ${v.filename}`);
  console.log(`Company: ${v.company}`);
  console.log(`Time: ${v.startTime}`);
  console.log(`Duration: ${v.duration}s`);
  console.log(`\nTRANSCRIPT:\n${v.transcript}`);
  console.log('-'.repeat(80));
});

console.log('\n\n' + '=' .repeat(80));
console.log('  12PM - 5PM WINDOW: 10 RANDOM "VOICEMAIL_ONLY" TRANSCRIPTS');
console.log('=' .repeat(80));

afternoonSample.forEach((v, i) => {
  console.log(`\n--- [AFTERNOON ${i+1}/10] ---`);
  console.log(`File: ${v.filename}`);
  console.log(`Company: ${v.company}`);
  console.log(`Time: ${v.startTime}`);
  console.log(`Duration: ${v.duration}s`);
  console.log(`\nTRANSCRIPT:\n${v.transcript}`);
  console.log('-'.repeat(80));
});

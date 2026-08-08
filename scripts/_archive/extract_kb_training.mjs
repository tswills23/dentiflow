import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recordingsDir = join(__dirname, '..', 'callrail-puller', 'recordings');

// --- CSV parser that handles quoted fields with commas/newlines ---
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len || text[i] === '\n' || text[i] === '\r') return '';
    if (text[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      return field;
    } else {
      let field = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i++;
      }
      return field;
    }
  }

  while (i < len) {
    const row = [];
    while (true) {
      row.push(parseField());
      if (i < len && text[i] === ',') {
        i++; // skip comma
      } else {
        break;
      }
    }
    // skip line endings
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (row[idx] || '').trim();
    });
    return obj;
  });
}

function escapeCSVField(val) {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// --- Load files ---
console.log('Loading classified_calls.csv...');
const classifiedRaw = readFileSync(join(recordingsDir, 'classified_calls.csv'), 'utf-8');
const classifiedRows = parseCSV(classifiedRaw);
const classified = rowsToObjects(classifiedRows);
console.log(`  ${classified.length} classified rows`);

console.log('Loading transcripts_master_full.csv...');
const transcriptsRaw = readFileSync(join(recordingsDir, 'transcripts_master_full.csv'), 'utf-8');
const transcriptRows = parseCSV(transcriptsRaw);
const transcripts = rowsToObjects(transcriptRows);
console.log(`  ${transcripts.length} transcript rows`);

// --- Build transcript lookup ---
const txMap = new Map();
for (const t of transcripts) {
  const key = `${t.company}|||${t.filename}`;
  txMap.set(key, t.transcript || '');
}

// --- Join and add transcript column ---
const joined = classified.map(row => {
  const key = `${row.company}|||${row.filename}`;
  return { ...row, transcript: txMap.get(key) || '' };
});

// --- Filter for kb_training_extract ---
const excludeIntents = new Set(['VOICEMAIL_ONLY', 'CLASSIFICATION_FAILED', 'OTHER']);
const filtered = joined.filter(row => {
  if (excludeIntents.has(row.primary_intent)) return false;
  if (row.transcript.length <= 200) return false;
  return true;
});

console.log(`\nFiltered: ${filtered.length} rows (from ${joined.length} total)`);
console.log(`  Excluded intents removed: ${joined.filter(r => excludeIntents.has(r.primary_intent)).length}`);
console.log(`  Short transcripts removed: ${joined.filter(r => !excludeIntents.has(r.primary_intent) && r.transcript.length <= 200).length}`);

// --- Write kb_training_extract.csv ---
const allHeaders = [...classifiedRows[0].map(h => h.trim()), 'transcript'];
const csvLines = [allHeaders.map(escapeCSVField).join(',')];
for (const row of filtered) {
  csvLines.push(allHeaders.map(h => escapeCSVField(row[h] || '')).join(','));
}
const extractPath = join(recordingsDir, 'kb_training_extract.csv');
writeFileSync(extractPath, csvLines.join('\n'), 'utf-8');
console.log(`\nWrote ${extractPath}`);
console.log(`  ${filtered.length} data rows + 1 header`);

// --- Build kb_intent_samples.md ---
const targetIntents = [
  'EXISTING_PATIENT_SCHEDULING',
  'NEW_PATIENT_SCHEDULING',
  'EMERGENCY_URGENT',
  'CANCELLATION_RESCHEDULE',
  'BILLING_PAYMENT',
  'INSURANCE_VERIFICATION',
  'RECORDS_REQUEST',
  'TREATMENT_QUESTION',
];

// Group by intent, sort by transcript length descending, pick top 5
const intentGroups = {};
for (const intent of targetIntents) {
  intentGroups[intent] = joined
    .filter(r => r.primary_intent === intent && r.transcript.length > 100)
    .sort((a, b) => b.transcript.length - a.transcript.length)
    .slice(0, 5);
}

let md = `# KB Intent Samples\n\n`;
md += `> 5 longest, most complete transcript examples per intent category.\n`;
md += `> Generated ${new Date().toISOString().split('T')[0]}\n\n`;

for (const intent of targetIntents) {
  const samples = intentGroups[intent];
  md += `---\n\n## ${intent}\n\n`;
  md += `*${samples.length} samples available*\n\n`;

  if (samples.length === 0) {
    md += `> No qualifying transcripts found for this intent.\n\n`;
    continue;
  }

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    // Extract duration from filename (e.g., "2026-03-10_242s_CAL...")
    const durMatch = s.filename.match(/_(\d+)s_/);
    const duration = durMatch ? `${durMatch[1]}s` : 'unknown';

    md += `### Sample ${i + 1}\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| **Intent** | ${s.primary_intent} |\n`;
    md += `| **Secondary** | ${s.secondary_intent || 'NONE'} |\n`;
    md += `| **Filename** | ${s.filename} |\n`;
    md += `| **Company** | ${s.company} |\n`;
    md += `| **Duration** | ${duration} |\n`;
    md += `| **Caller Type** | ${s.caller_type} |\n`;
    md += `| **Tone** | ${s.emotional_tone} |\n`;
    md += `| **Resolution** | ${s.resolution} |\n`;
    md += `| **Transcript Length** | ${s.transcript.length.toLocaleString()} chars |\n\n`;
    md += `**Transcript:**\n\n`;
    md += `${s.transcript}\n\n`;
  }
}

// Summary table
md += `---\n\n## Summary\n\n`;
md += `| Intent | Samples | Avg Transcript Length |\n`;
md += `|--------|---------|----------------------|\n`;
for (const intent of targetIntents) {
  const samples = intentGroups[intent];
  const avgLen = samples.length > 0
    ? Math.round(samples.reduce((sum, s) => sum + s.transcript.length, 0) / samples.length)
    : 0;
  md += `| ${intent} | ${samples.length} | ${avgLen.toLocaleString()} chars |\n`;
}

const mdPath = join(recordingsDir, 'kb_intent_samples.md');
writeFileSync(mdPath, md, 'utf-8');
console.log(`Wrote ${mdPath}`);

// --- Intent distribution in extract ---
console.log('\n--- Intent Distribution in kb_training_extract.csv ---');
const intentCounts = {};
for (const row of filtered) {
  intentCounts[row.primary_intent] = (intentCounts[row.primary_intent] || 0) + 1;
}
Object.entries(intentCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([intent, count]) => console.log(`  ${intent}: ${count}`));

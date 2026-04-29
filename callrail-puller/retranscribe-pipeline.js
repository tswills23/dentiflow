const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY env var required');

const CLASSIFIED_CSV = './recordings/classified_calls.csv';
const TRANSCRIPTS_CSV = './recordings/transcripts_master_full.csv';
const RECORDINGS_DIR = './recordings';
const ANALYSIS_FILE = './recordings/full_dataset_analysis.md';
const GAP_FILE = './recordings/flow_gap_analysis.md';

const CLASSIFY_CONCURRENCY = 10;
const BATCH_PAUSE_MS = 4000;
const MAX_RETRIES = 5;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── CSV Parser ──────────────────────────────────────────────────────────────
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
    } else if ((char === '\n' || (char === '\r' && content[i + 1] === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      rows.push(current);
      current = '';
    } else if (char !== '\r') {
      current += char;
    }
  }
  if (current.trim()) rows.push(current);
  const header = parseRow(rows[0]);
  return rows.slice(1).map(row => {
    const fields = parseRow(row);
    const obj = {};
    header.forEach((h, idx) => obj[h.replace(/"/g, '').trim()] = (fields[idx] || '').trim());
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

// ── Step 1: Identify mislabeled calls and read .txt files ───────────────────
function findMislabeledCalls() {
  const classified = parseCSV(CLASSIFIED_CSV);
  const voicemailOnly = classified.filter(r => r.primary_intent === 'VOICEMAIL_ONLY');

  const candidates = voicemailOnly.map(r => {
    const match = r.filename.match(/_(\d+)s_/);
    const duration = match ? parseInt(match[1]) : 0;
    return { ...r, duration };
  }).filter(r => r.duration > 120);

  console.log(`VOICEMAIL_ONLY total: ${voicemailOnly.length}`);
  console.log(`Duration > 120s: ${candidates.length}`);

  const toReclassify = [];
  let noMp3 = 0;
  let noTxt = 0;
  let shortTxt = 0;

  for (const c of candidates) {
    const companyDir = path.join(RECORDINGS_DIR, c.company);
    const mp3Path = path.join(companyDir, c.filename);
    const txtPath = mp3Path.replace('.mp3', '.txt');

    if (!fs.existsSync(mp3Path)) { noMp3++; continue; }
    if (!fs.existsSync(txtPath)) { noTxt++; continue; }

    const transcript = fs.readFileSync(txtPath, 'utf-8');
    if (transcript.length <= 200) {
      shortTxt++;
      continue;
    }

    toReclassify.push({
      filename: c.filename,
      company: c.company,
      duration: c.duration,
      transcript
    });
  }

  console.log(`No MP3 found: ${noMp3}`);
  console.log(`No .txt found: ${noTxt}`);
  console.log(`Short .txt (<=200 chars): ${shortTxt}`);
  console.log(`Will reclassify (good .txt > 200 chars): ${toReclassify.length}\n`);

  return toReclassify;
}

// ── Step 2: Classify with Haiku ─────────────────────────────────────────────
const CLASSIFY_PROMPT = `Classify this dental office phone call transcript. Respond ONLY in the exact JSON format below. No markdown, no backticks, no explanation.

{
  "primary_intent": "",
  "secondary_intent": "",
  "caller_type": "",
  "emotional_tone": "",
  "resolution": "",
  "caller_opening": "",
  "receptionist_opening": "",
  "key_question_asked": "",
  "receptionist_struggled_with": "",
  "price_discussed": false,
  "insurance_discussed": false,
  "emergency_indicators": false,
  "multi_intent": false,
  "would_ai_handle": "",
  "flow_gap_notes": ""
}

FIELD DEFINITIONS:

primary_intent: Choose exactly one:
- NEW_PATIENT_SCHEDULING (first time caller wanting appointment)
- EXISTING_PATIENT_SCHEDULING (known patient booking/confirming)
- EMERGENCY_URGENT (pain, swelling, broken tooth, bleeding)
- BILLING_PAYMENT (bill questions, making payment, balance inquiry)
- INSURANCE_VERIFICATION (checking coverage, benefits, what's accepted)
- HOURS_DIRECTIONS_INFO (office hours, location, general info)
- CANCELLATION_RESCHEDULE (canceling or moving existing appointment)
- TREATMENT_QUESTION (questions about procedures, what to expect)
- PRESCRIPTION_REFILL (medication related)
- CALLBACK_REQUEST (returning a call or requesting callback)
- COMPLAINT (unhappy about service, billing dispute)
- REFERRAL_SPECIALIST (being referred or asking for referral)
- MEDICAL_CLEARANCE (surgical clearance, medical forms)
- RECORDS_REQUEST (requesting records transfer)
- VOICEMAIL_ONLY (no conversation, just voicemail greeting)
- OTHER (doesn't fit any category)

secondary_intent: Same list as above, or "NONE" if single intent call

caller_type: "new_patient", "existing_patient", "family_member", "other_office", "unknown"

emotional_tone: "calm", "anxious", "frustrated", "confused", "urgent", "friendly", "impatient"

resolution: "appointment_booked", "transferred", "callback_promised", "info_provided", "payment_made", "unresolved", "voicemail_left", "caller_hung_up"

caller_opening: First sentence the caller says (verbatim from transcript, max 20 words)

receptionist_opening: First sentence the receptionist says (verbatim, max 20 words)

key_question_asked: The most important question the caller asked (verbatim or close paraphrase)

receptionist_struggled_with: What the receptionist had difficulty answering or handling. "NONE" if handled smoothly.

price_discussed: true if any specific dollar amounts or pricing was discussed

insurance_discussed: true if insurance coverage, plans, or benefits were discussed

emergency_indicators: true if caller mentioned pain, bleeding, swelling, broken tooth, or urgent need

multi_intent: true if caller had more than one distinct reason for calling

would_ai_handle: "YES_FULLY" if a voice AI could handle this entire call, "YES_PARTIALLY" if AI could handle some but would need to transfer for part of it, "NO" if this call requires a human from the start

flow_gap_notes: If this call reveals something the current voice agent flow would NOT handle well, describe what's missing. Otherwise "NONE".

TRANSCRIPT:
`;

async function classifyOne(item, index, total) {
  // Truncate very long transcripts to avoid token limits (keep first 8000 chars)
  const transcript = item.transcript.length > 8000
    ? item.transcript.substring(0, 8000) + '\n[TRANSCRIPT TRUNCATED]'
    : item.transcript;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: CLASSIFY_PROMPT + transcript }]
      });

      const text = response.content[0].text.trim();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log(`  [${index}/${total}] ${item.filename}: ${parsed.primary_intent} | ${parsed.resolution} | AI: ${parsed.would_ai_handle}`);
      return { filename: item.filename, classification: parsed };
    } catch (err) {
      if ((err.status === 429 || err.status === 529) && attempt < MAX_RETRIES) {
        const wait = Math.pow(2, attempt + 1) * 3000;
        console.log(`  [${index}/${total}] Rate limited, retry ${attempt + 1} in ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (err instanceof SyntaxError && attempt < MAX_RETRIES) {
        console.log(`  [${index}/${total}] JSON parse error, retrying...`);
        continue;
      }
      console.log(`  [${index}/${total}] FAILED: ${item.filename} — ${err.message}`);
      return { filename: item.filename, classification: null };
    }
  }
}

async function classifyAll(items) {
  const results = [];
  let classified = 0;
  let failed = 0;
  let stillVM = 0;

  for (let i = 0; i < items.length; i += CLASSIFY_CONCURRENCY) {
    const batch = items.slice(i, i + CLASSIFY_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((item, j) => classifyOne(item, i + j + 1, items.length))
    );

    for (const r of batchResults) {
      results.push(r);
      if (r.classification) {
        if (r.classification.primary_intent === 'VOICEMAIL_ONLY') stillVM++;
        else classified++;
      } else {
        failed++;
      }
    }

    // Progress
    const done = i + batch.length;
    if (done % 100 === 0 || done === items.length) {
      console.log(`\n  Progress: ${done}/${items.length} | Reclassified: ${classified} | Still VM: ${stillVM} | Failed: ${failed}\n`);
    }

    if (i + CLASSIFY_CONCURRENCY < items.length) {
      await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  console.log(`\nClassification complete:`);
  console.log(`  Reclassified (no longer VM): ${classified}`);
  console.log(`  Still classified as VM: ${stillVM}`);
  console.log(`  Failed: ${failed}\n`);

  return results;
}

// ── Step 3: Update CSVs ─────────────────────────────────────────────────────
function updateCSVs(results, items) {
  // Update classified_calls.csv
  const classified = parseCSV(CLASSIFIED_CSV);
  const updateMap = {};
  for (const r of results) {
    if (r.classification) updateMap[r.filename] = r.classification;
  }

  console.log(`Updating ${Object.keys(updateMap).length} rows in classified_calls.csv...`);

  const updated = classified.map(row => {
    if (updateMap[row.filename]) return { ...row, ...updateMap[row.filename] };
    return row;
  });

  const csvHeader = [
    'company', 'filename', 'primary_intent', 'secondary_intent', 'caller_type',
    'emotional_tone', 'resolution', 'caller_opening', 'receptionist_opening',
    'key_question_asked', 'receptionist_struggled_with', 'price_discussed',
    'insurance_discussed', 'emergency_indicators', 'multi_intent',
    'would_ai_handle', 'flow_gap_notes'
  ].join(',');

  const csvRows = updated.map(r => [
    `"${(r.company || '').replace(/"/g, '""')}"`,
    `"${(r.filename || '').replace(/"/g, '""')}"`,
    `"${(r.primary_intent || '').replace(/"/g, '""')}"`,
    `"${(r.secondary_intent || '').replace(/"/g, '""')}"`,
    `"${(r.caller_type || '').replace(/"/g, '""')}"`,
    `"${(r.emotional_tone || '').replace(/"/g, '""')}"`,
    `"${(r.resolution || '').replace(/"/g, '""')}"`,
    `"${(r.caller_opening || '').replace(/"/g, '""')}"`,
    `"${(r.receptionist_opening || '').replace(/"/g, '""')}"`,
    `"${(r.key_question_asked || '').replace(/"/g, '""')}"`,
    `"${(r.receptionist_struggled_with || '').replace(/"/g, '""')}"`,
    r.price_discussed,
    r.insurance_discussed,
    r.emergency_indicators,
    r.multi_intent,
    `"${(r.would_ai_handle || '').replace(/"/g, '""')}"`,
    `"${(r.flow_gap_notes || '').replace(/"/g, '""')}"`
  ].join(','));

  fs.writeFileSync(CLASSIFIED_CSV, [csvHeader, ...csvRows].join('\n'));
  console.log(`Updated classified_calls.csv (${updated.length} rows)`);

  // Also fix transcripts_master_full.csv for these files
  // Read from .txt files which have the correct full transcripts
  const transcripts = parseCSV(TRANSCRIPTS_CSV);
  const transcriptFixes = {};
  for (const item of items) {
    transcriptFixes[item.filename] = item.transcript;
  }

  const updatedTranscripts = transcripts.map(row => {
    if (transcriptFixes[row.filename]) {
      return { ...row, transcript: transcriptFixes[row.filename] };
    }
    return row;
  });

  const tHeader = 'company,filename,transcript';
  const tRows = updatedTranscripts.map(r => {
    const clean = (r.transcript || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' | ');
    return `"${r.company}","${r.filename}","${clean}"`;
  });
  fs.writeFileSync(TRANSCRIPTS_CSV, [tHeader, ...tRows].join('\n'));
  console.log(`Updated transcripts_master_full.csv (fixed ${Object.keys(transcriptFixes).length} transcripts)\n`);
}

// ── Step 4: Regenerate reports ──────────────────────────────────────────────
function regenerateReports() {
  console.log('Regenerating reports...');

  // Run the existing generate-analysis.js
  // Clear require cache so it reads fresh data
  delete require.cache[require.resolve('./generate-analysis.js')];
  require('./generate-analysis.js');

  // Regenerate flow_gap_analysis.md
  const classified = parseCSV(CLASSIFIED_CSV);
  const intentCounts = {};
  const resCounts = {};
  const aiCounts = { YES_FULLY: 0, YES_PARTIALLY: 0, NO: 0, UNKNOWN: 0 };
  const gapNotes = [];
  let priceCount = 0, insCount = 0, emergCount = 0, multiCount = 0;
  const totalC = classified.length;

  classified.forEach(r => {
    intentCounts[r.primary_intent] = (intentCounts[r.primary_intent] || 0) + 1;
    resCounts[r.resolution] = (resCounts[r.resolution] || 0) + 1;
    aiCounts[r.would_ai_handle] = (aiCounts[r.would_ai_handle] || 0) + 1;
    if (String(r.price_discussed) === 'true') priceCount++;
    if (String(r.insurance_discussed) === 'true') insCount++;
    if (String(r.emergency_indicators) === 'true') emergCount++;
    if (String(r.multi_intent) === 'true') multiCount++;
    if (r.flow_gap_notes && r.flow_gap_notes !== 'NONE') gapNotes.push(r.flow_gap_notes);
  });

  const coveredIntents = [
    'NEW_PATIENT_SCHEDULING', 'EXISTING_PATIENT_SCHEDULING', 'EMERGENCY_URGENT',
    'BILLING_PAYMENT', 'HOURS_DIRECTIONS_INFO', 'VOICEMAIL_ONLY'
  ];
  const sortedI = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);

  let summary = `# Voice Agent Flow Gap Analysis\n`;
  summary += `## Generated from ${totalC} classified calls (updated ${new Date().toISOString().split('T')[0]})\n\n---\n\n`;
  summary += `## Intent Distribution\n\n| Intent | Count | % | Covered by 13-Node Flow? |\n|--------|-------|---|-------------------------|\n`;
  sortedI.forEach(([intent, count]) => {
    const pct = ((count / totalC) * 100).toFixed(1);
    const covered = coveredIntents.includes(intent) ? 'YES' : 'NO \u2014 GAP';
    summary += `| ${intent} | ${count} | ${pct}% | ${covered} |\n`;
  });
  summary += `\n---\n\n## AI Readiness\n\n| Rating | Count | % |\n|--------|-------|---|\n`;
  Object.entries(aiCounts).forEach(([r, c]) => {
    if (c > 0) summary += `| ${r} | ${c} | ${((c / totalC) * 100).toFixed(1)}% |\n`;
  });
  summary += `\n---\n\n## Key Metrics\n\n`;
  summary += `- Calls where price was discussed: ${priceCount} (${((priceCount / totalC) * 100).toFixed(1)}%)\n`;
  summary += `- Calls where insurance was discussed: ${insCount} (${((insCount / totalC) * 100).toFixed(1)}%)\n`;
  summary += `- Calls with emergency indicators: ${emergCount} (${((emergCount / totalC) * 100).toFixed(1)}%)\n`;
  summary += `- Multi-intent calls: ${multiCount} (${((multiCount / totalC) * 100).toFixed(1)}%)\n`;
  summary += `\n---\n\n## Resolution Distribution\n\n`;
  Object.entries(resCounts).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
    summary += `- ${r}: ${c} (${((c / totalC) * 100).toFixed(1)}%)\n`;
  });
  summary += `\n---\n\n## Flow Gaps Identified\n\n`;
  const uniqueGaps = [...new Set(gapNotes)];
  uniqueGaps.forEach(g => { summary += `- ${g}\n`; });

  fs.writeFileSync(GAP_FILE, summary);
  console.log(`\nWrote ${GAP_FILE}`);
}

// ── Final summary ───────────────────────────────────────────────────────────
function printFinalSummary() {
  const classified = parseCSV(CLASSIFIED_CSV);
  const metadata = parseCSV('./recordings/call_metadata.csv');

  const classMap = {};
  classified.forEach(c => { classMap[c.filename] = c; });

  const classifiedWithMeta = [];
  metadata.forEach(m => {
    if (m.mp3_file && classMap[m.mp3_file]) {
      classifiedWithMeta.push({ ...m, ...classMap[m.mp3_file] });
    }
  });

  const total = metadata.length;
  const totalClassified = classifiedWithMeta.length;
  const voicemails = classifiedWithMeta.filter(c => c.primary_intent === 'VOICEMAIL_ONLY');
  const realConvos = classifiedWithMeta.filter(c =>
    c.primary_intent !== 'VOICEMAIL_ONLY' && c.primary_intent !== 'CLASSIFICATION_FAILED'
  );
  const failed = classifiedWithMeta.filter(c => c.primary_intent === 'CLASSIFICATION_FAILED');

  console.log('\n' + '='.repeat(65));
  console.log('  FINAL CORRECTED SUMMARY');
  console.log('='.repeat(65));
  console.log(`\nTotal inbound calls: ${total}`);
  console.log(`With recording + classified: ${totalClassified}`);
  console.log(`\nCorrected voicemail rate: ${voicemails.length} (${(voicemails.length / totalClassified * 100).toFixed(1)}%)`);
  console.log(`Total real conversations: ${realConvos.length} (${(realConvos.length / totalClassified * 100).toFixed(1)}%)`);
  console.log(`Classification failed: ${failed.length} (${(failed.length / totalClassified * 100).toFixed(1)}%)`);

  // Intent distribution (real conversations only, excluding VM and failures)
  const intentCounts = {};
  realConvos.forEach(c => {
    intentCounts[c.primary_intent] = (intentCounts[c.primary_intent] || 0) + 1;
  });
  const sorted = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);

  console.log(`\n--- Intent Distribution (${realConvos.length} real conversations, excluding VM & failures) ---`);
  sorted.forEach(([intent, count]) => {
    console.log(`  ${intent}: ${count} (${(count / realConvos.length * 100).toFixed(1)}%)`);
  });

  // AI readiness (real conversations only)
  const aiCounts = {};
  realConvos.forEach(c => {
    aiCounts[c.would_ai_handle] = (aiCounts[c.would_ai_handle] || 0) + 1;
  });

  console.log(`\n--- AI Readiness (real conversations only) ---`);
  Object.entries(aiCounts).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
    console.log(`  ${r}: ${c} (${(c / realConvos.length * 100).toFixed(1)}%)`);
  });

  // Resolution distribution (real conversations only)
  const resCounts = {};
  realConvos.forEach(c => {
    resCounts[c.resolution] = (resCounts[c.resolution] || 0) + 1;
  });

  console.log(`\n--- Resolution (real conversations only) ---`);
  Object.entries(resCounts).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
    console.log(`  ${r}: ${c} (${(c / realConvos.length * 100).toFixed(1)}%)`);
  });

  console.log('\n' + '='.repeat(65));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Reclassify Mislabeled Voicemails ===');
  console.log('(Whisper transcriptions are fine — CSV was mangled. Reading .txt files directly.)\n');

  // Step 1: Find mislabeled calls and read their actual transcripts
  console.log('-- Step 1: Identify mislabeled calls --');
  const items = findMislabeledCalls();
  if (items.length === 0) {
    console.log('Nothing to reclassify. Exiting.');
    return;
  }

  // Step 2: Classify with Haiku (10 concurrent, same prompt as original)
  console.log('-- Step 2: Reclassify with Haiku --');
  const results = await classifyAll(items);

  // Step 3: Update CSVs
  console.log('-- Step 3: Update CSVs --');
  updateCSVs(results, items);

  // Step 4: Regenerate reports
  console.log('-- Step 4: Regenerate reports --');
  regenerateReports();

  // Final summary
  printFinalSummary();
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});

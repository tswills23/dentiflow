const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY env var required');
const INPUT_CSV = './recordings/transcripts_master_full.csv';
const OUTPUT_CSV = './recordings/classified_calls.csv';
const SUMMARY_FILE = './recordings/flow_gap_analysis.md';
const EXISTING_CSV = './recordings/classified_calls.csv';
const CONCURRENT_LIMIT = 10;
const BATCH_PAUSE_MS = 4000;
const MAX_RETRIES = 5;

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      rows.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) rows.push(current);

  const header = rows[0].split(',');
  return rows.slice(1).map(row => {
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
    const obj = {};
    header.forEach((h, idx) => obj[h.replace(/"/g, '').trim()] = fields[idx] || '');
    return obj;
  });
}

async function classifyTranscript(transcript, filename, company, index, total) {
  const prompt = `Classify this dental office phone call transcript. Respond ONLY in the exact JSON format below. No markdown, no backticks, no explanation.

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
${transcript}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text.trim();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log(`  [${index}/${total}] ${filename}: ${parsed.primary_intent} | ${parsed.resolution} | AI: ${parsed.would_ai_handle}`);
      return parsed;
    } catch (err) {
      if (err.status === 429 && attempt < MAX_RETRIES) {
        const wait = (attempt + 1) * 15000;
        console.log(`  [${index}/${total}] Rate limited, retry ${attempt + 1} in ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      console.log(`  [${index}/${total}] FAILED: ${filename} - ${err.message}`);
      return {
      primary_intent: 'CLASSIFICATION_FAILED',
      secondary_intent: 'NONE',
      caller_type: 'unknown',
      emotional_tone: 'unknown',
      resolution: 'unknown',
      caller_opening: '',
      receptionist_opening: '',
      key_question_asked: '',
      receptionist_struggled_with: '',
      price_discussed: false,
      insurance_discussed: false,
      emergency_indicators: false,
      multi_intent: false,
      would_ai_handle: 'UNKNOWN',
      flow_gap_notes: err.message
    };
    }
  }
}

async function processInBatches(items, batchSize) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => classifyTranscript(
        item.transcript, item.filename, item.company,
        items.indexOf(item) + 1, items.length
      ))
    );
    results.push(...batchResults.map((r, j) => ({ ...batch[j], ...r })));
    if (i + batchSize < items.length) await new Promise(r => setTimeout(r, 2000));
  }
  return results;
}

function loadExistingClassifications() {
  if (!fs.existsSync(EXISTING_CSV)) return { filenames: new Set(), rows: [] };
  const parsed = parseCSV(EXISTING_CSV);
  const filenames = new Set(parsed.map(r => r.filename));
  return { filenames, rows: parsed };
}

async function main() {
  console.log('=== Call Transcript Classifier (Incremental) ===\n');

  if (ANTHROPIC_API_KEY === 'PASTE_YOUR_KEY_HERE') {
    console.error('ERROR: Replace PASTE_YOUR_KEY_HERE with your Anthropic API key.');
    process.exit(1);
  }

  const allTranscripts = parseCSV(INPUT_CSV);
  console.log(`Loaded ${allTranscripts.length} transcripts from ${INPUT_CSV}.`);

  // Load existing classifications to skip
  const existing = loadExistingClassifications();
  console.log(`Found ${existing.filenames.size} already-classified calls in ${EXISTING_CSV}.`);

  const newRows = allTranscripts.filter(r => !existing.filenames.has(r.filename));
  console.log(`Need to classify ${newRows.length} new transcripts.\n`);

  // Classify only new ones
  const newResults = [];
  for (let i = 0; i < newRows.length; i += CONCURRENT_LIMIT) {
    const batch = newRows.slice(i, i + CONCURRENT_LIMIT);
    const batchResults = await Promise.all(
      batch.map((row, j) => classifyTranscript(
        row.transcript, row.filename, row.company,
        i + j + 1, newRows.length
      ).then(classification => ({ ...row, ...classification })))
    );
    newResults.push(...batchResults);
    if (i + CONCURRENT_LIMIT < newRows.length) await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
  }

  console.log(`\nClassified ${newResults.length} new transcripts.`);

  // Combine existing + new results
  const results = [...existing.rows, ...newResults];
  console.log(`Total classified: ${results.length} (${existing.rows.length} existing + ${newResults.length} new)`);

  // Write combined classified CSV
  const csvHeader = [
    'company', 'filename', 'primary_intent', 'secondary_intent', 'caller_type',
    'emotional_tone', 'resolution', 'caller_opening', 'receptionist_opening',
    'key_question_asked', 'receptionist_struggled_with', 'price_discussed',
    'insurance_discussed', 'emergency_indicators', 'multi_intent',
    'would_ai_handle', 'flow_gap_notes'
  ].join(',');

  const csvRows = results.map(r => [
    `"${r.company}"`, `"${r.filename}"`, `"${r.primary_intent}"`, `"${r.secondary_intent}"`,
    `"${r.caller_type}"`, `"${r.emotional_tone}"`, `"${r.resolution}"`,
    `"${(r.caller_opening || '').replace(/"/g, '""')}"`,
    `"${(r.receptionist_opening || '').replace(/"/g, '""')}"`,
    `"${(r.key_question_asked || '').replace(/"/g, '""')}"`,
    `"${(r.receptionist_struggled_with || '').replace(/"/g, '""')}"`,
    r.price_discussed, r.insurance_discussed, r.emergency_indicators, r.multi_intent,
    `"${r.would_ai_handle}"`, `"${(r.flow_gap_notes || '').replace(/"/g, '""')}"`
  ].join(','));

  fs.writeFileSync(OUTPUT_CSV, [csvHeader, ...csvRows].join('\n'));

  // Build gap analysis summary
  const intentCounts = {};
  const resolutionCounts = {};
  const aiHandleCounts = { YES_FULLY: 0, YES_PARTIALLY: 0, NO: 0, UNKNOWN: 0 };
  const gapNotes = [];
  let priceCount = 0;
  let insuranceCount = 0;
  let emergencyCount = 0;
  let multiIntentCount = 0;

  results.forEach(r => {
    intentCounts[r.primary_intent] = (intentCounts[r.primary_intent] || 0) + 1;
    resolutionCounts[r.resolution] = (resolutionCounts[r.resolution] || 0) + 1;
    aiHandleCounts[r.would_ai_handle] = (aiHandleCounts[r.would_ai_handle] || 0) + 1;
    if (r.price_discussed) priceCount++;
    if (r.insurance_discussed) insuranceCount++;
    if (r.emergency_indicators) emergencyCount++;
    if (r.multi_intent) multiIntentCount++;
    if (r.flow_gap_notes && r.flow_gap_notes !== 'NONE') gapNotes.push(r.flow_gap_notes);
  });

  const sorted = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);
  const total = results.length;

  let summary = `# Voice Agent Flow Gap Analysis\n`;
  summary += `## Generated from ${total} classified calls\n\n`;
  summary += `---\n\n`;
  summary += `## Intent Distribution\n\n`;
  summary += `| Intent | Count | % | Covered by 13-Node Flow? |\n`;
  summary += `|--------|-------|---|-------------------------|\n`;

  const coveredIntents = [
    'NEW_PATIENT_SCHEDULING', 'EXISTING_PATIENT_SCHEDULING', 'EMERGENCY_URGENT',
    'BILLING_PAYMENT', 'HOURS_DIRECTIONS_INFO', 'VOICEMAIL_ONLY'
  ];

  sorted.forEach(([intent, count]) => {
    const pct = ((count / total) * 100).toFixed(1);
    const covered = coveredIntents.includes(intent) ? 'YES' : 'NO — GAP';
    summary += `| ${intent} | ${count} | ${pct}% | ${covered} |\n`;
  });

  summary += `\n---\n\n`;
  summary += `## AI Readiness\n\n`;
  summary += `| Rating | Count | % |\n`;
  summary += `|--------|-------|---|\n`;
  Object.entries(aiHandleCounts).forEach(([rating, count]) => {
    if (count > 0) summary += `| ${rating} | ${count} | ${((count/total)*100).toFixed(1)}% |\n`;
  });

  summary += `\n---\n\n`;
  summary += `## Key Metrics\n\n`;
  summary += `- Calls where price was discussed: ${priceCount} (${((priceCount/total)*100).toFixed(1)}%)\n`;
  summary += `- Calls where insurance was discussed: ${insuranceCount} (${((insuranceCount/total)*100).toFixed(1)}%)\n`;
  summary += `- Calls with emergency indicators: ${emergencyCount} (${((emergencyCount/total)*100).toFixed(1)}%)\n`;
  summary += `- Multi-intent calls: ${multiIntentCount} (${((multiIntentCount/total)*100).toFixed(1)}%)\n`;

  summary += `\n---\n\n`;
  summary += `## Resolution Distribution\n\n`;
  Object.entries(resolutionCounts).sort((a, b) => b[1] - a[1]).forEach(([res, count]) => {
    summary += `- ${res}: ${count} (${((count/total)*100).toFixed(1)}%)\n`;
  });

  summary += `\n---\n\n`;
  summary += `## Flow Gaps Identified\n\n`;
  const uniqueGaps = [...new Set(gapNotes)];
  uniqueGaps.forEach(gap => {
    summary += `- ${gap}\n`;
  });

  fs.writeFileSync(SUMMARY_FILE, summary);

  console.log(`\n=== COMPLETE ===`);
  console.log(`Classified CSV: ${OUTPUT_CSV}`);
  console.log(`Gap Analysis: ${SUMMARY_FILE}`);
  console.log(`\nINTENT DISTRIBUTION:`);
  sorted.forEach(([intent, count]) => {
    console.log(`  ${intent}: ${count} (${((count/total)*100).toFixed(1)}%)`);
  });
  console.log(`\nAI READINESS:`);
  Object.entries(aiHandleCounts).forEach(([r, c]) => {
    if (c > 0) console.log(`  ${r}: ${c} (${((c/total)*100).toFixed(1)}%)`);
  });
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});

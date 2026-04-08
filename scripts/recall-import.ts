#!/usr/bin/env npx tsx
// Recall CSV Import CLI
// Reuses production csvParser + voiceAssignment. No logic reimplemented.
//
// Usage:
//   npx tsx scripts/recall-import.ts --file "path/to/patients.csv"                  # dry run
//   npx tsx scripts/recall-import.ts --file "path/to/patients.csv" --export out.csv # + export CSV
//   npx tsx scripts/recall-import.ts --file "path/to/patients.csv" --sheet          # + Google Sheet
//   npx tsx scripts/recall-import.ts --file "path/to/patients.csv" --import         # write to Supabase

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { parseRecallCsv } from '../src/services/recall/csvParser';
import { assignVoiceFromLastVisit } from '../src/services/recall/voiceAssignment';
import type { IngestRecord } from '../src/services/recall/ingestAgent';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

// ── Arg parsing ────────────────────────────────────────────────────────
interface Args {
  file: string;
  export?: string;
  import: boolean;
  sheet: boolean;
  practiceId: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    file: '',
    import: false,
    sheet: false,
    practiceId: 'a3f04cf9-54aa-4bd6-939a-d0417c42d941',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file': result.file = args[++i] || ''; break;
      case '--export': result.export = args[++i] || ''; break;
      case '--import': result.import = true; break;
      case '--sheet': result.sheet = true; break;
      case '--practice-id': result.practiceId = args[++i] || ''; break;
    }
  }

  if (!result.file) {
    console.error('Usage: npx tsx scripts/recall-import.ts --file <csv-path> [--export <out.csv>] [--import] [--sheet]');
    process.exit(1);
  }

  return result;
}

// ── Enriched record with voice data ────────────────────────────────────
interface EnrichedRecord extends IngestRecord {
  monthsOverdue: number;
  voice: string;
  segment: string;
}

// ── Phone normalization (matches ingestAgent.ts) ───────────────────────
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  // Read CSV from disk
  const csvPath = resolve(args.file);
  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf-8');
  } catch (err) {
    console.error(`Cannot read file: ${csvPath}`);
    process.exit(1);
  }

  // Parse using production csvParser
  const { records, skipped: csvSkipped, errors: csvErrors } = parseRecallCsv(csvText);

  // Post-parse: dedup by phone, filter test patients
  const seenPhones = new Set<string>();
  let skippedDuplicate = 0;
  let skippedTest = 0;
  let skippedInvalidPhone = 0;
  const eligible: EnrichedRecord[] = [];

  for (const rec of records) {
    // Filter test patients
    if (rec.lastName?.toLowerCase() === 'test' || rec.firstName?.toLowerCase() === 'test') {
      skippedTest++;
      continue;
    }

    // Normalize phone
    const phone = normalizePhone(rec.phone);
    if (!phone) {
      skippedInvalidPhone++;
      continue;
    }

    // Dedup
    if (seenPhones.has(phone)) {
      skippedDuplicate++;
      continue;
    }
    seenPhones.add(phone);

    // Voice assignment using production voiceAssignment
    const lastVisit = rec.lastVisitDate ? new Date(rec.lastVisitDate) : null;
    const { segment, voice, monthsOverdue } = assignVoiceFromLastVisit(lastVisit);

    eligible.push({
      ...rec,
      phone,
      monthsOverdue: Math.round(monthsOverdue * 10) / 10,
      voice,
      segment,
    });
  }

  // ── Summary by location ──────────────────────────────────────────────
  const byLocation: Record<string, number> = {};
  const byVoice: Record<string, number> = {};
  for (const rec of eligible) {
    const loc = rec.location || '(none)';
    byLocation[loc] = (byLocation[loc] || 0) + 1;
    byVoice[rec.voice] = (byVoice[rec.voice] || 0) + 1;
  }

  // ── Print summary ────────────────────────────────────────────────────
  console.log('\n========== RECALL CSV IMPORT SUMMARY ==========');
  console.log(`Total rows parsed:          ${records.length + csvSkipped}`);
  console.log(`Eligible for outreach:      ${eligible.length}`);
  console.log(`Skipped (has next appt):    ${csvSkipped}`);
  console.log(`Skipped (duplicate phone):  ${skippedDuplicate}`);
  console.log(`Skipped (test patient):     ${skippedTest}`);
  console.log(`Skipped (invalid phone):    ${skippedInvalidPhone}`);
  console.log(`Parse errors:               ${csvErrors.length}`);

  console.log('\n--- By Location ---');
  for (const [loc, count] of Object.entries(byLocation).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${loc}: ${count}`);
  }

  console.log('\n--- By Voice Tier ---');
  const voiceLabels: Record<string, string> = {
    office: 'office (< 6 mo)',
    hygienist: 'hygienist (6-12 mo)',
    doctor: 'doctor (12+ mo)',
  };
  for (const [v, count] of Object.entries(byVoice).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / eligible.length) * 100).toFixed(1);
    console.log(`  ${voiceLabels[v] || v}: ${count} (${pct}%)`);
  }

  // ── Export eligible list ─────────────────────────────────────────────
  if (args.export) {
    const header = 'Last Name,First Name,Phone,Email,Last Visit Date,Months Overdue,Voice Assignment,Segment,Location';
    const rows = eligible.map(r => {
      const fields = [
        csvEscape(r.lastName || ''),
        csvEscape(r.firstName),
        r.phone,
        csvEscape(r.email || ''),
        r.lastVisitDate || '',
        String(r.monthsOverdue),
        r.voice,
        r.segment,
        csvEscape(r.location || ''),
      ];
      return fields.join(',');
    });
    const exportPath = resolve(args.export);
    writeFileSync(exportPath, [header, ...rows].join('\n') + '\n', 'utf-8');
    console.log(`\nExported ${eligible.length} eligible records → ${exportPath}`);
  }

  // ── Google Sheet export ──────────────────────────────────────────────
  if (args.sheet) {
    await exportToGoogleSheet(eligible);
  }

  // ── Import to Supabase ───────────────────────────────────────────────
  if (args.import) {
    console.log('\n--- Importing to Supabase ---');
    const { ingestPatients } = await import('../src/services/recall/ingestAgent');
    const BATCH = 100;
    let totalImported = 0;
    let totalSkipped = 0;

    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH);
      const result = await ingestPatients(args.practiceId, batch);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: imported ${result.imported}, skipped ${result.skipped}`);
    }

    console.log(`\nImport complete: ${totalImported} imported, ${totalSkipped} skipped`);
  } else {
    console.log('\nMode: DRY RUN (no database writes). Use --import to write to Supabase.');
  }

  if (csvErrors.length > 0 && csvErrors.length <= 10) {
    console.log('\n--- Parse Errors ---');
    csvErrors.forEach(e => console.log(`  ${e}`));
  } else if (csvErrors.length > 10) {
    console.log(`\n--- Parse Errors (first 10 of ${csvErrors.length}) ---`);
    csvErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── Google Sheets export ──────────────────────────────────────────────
async function exportToGoogleSheet(eligible: EnrichedRecord[]) {
  console.log('\n--- Creating Google Sheet ---');

  // Get gcloud token
  let token: string;
  try {
    token = execSync('gcloud.cmd auth print-access-token', { encoding: 'utf-8' }).trim();
  } catch {
    console.error('Failed to get gcloud token. Run: gcloud auth login --enable-gdrive-access');
    return;
  }

  const header = ['Last Name', 'First Name', 'Phone', 'Email', 'Last Visit Date', 'Months Overdue', 'Voice Assignment', 'Segment', 'Location'];

  // Build eligible rows
  const eligibleRows = eligible.map(r => [
    r.lastName || '', r.firstName, r.phone, r.email || '',
    r.lastVisitDate || '', String(r.monthsOverdue), r.voice, r.segment, r.location || '',
  ]);

  // Group by location for per-location tabs
  const byLocation: Record<string, string[][]> = {};
  for (const row of eligibleRows) {
    const loc = row[8] || '(No Location)';
    if (!byLocation[loc]) byLocation[loc] = [];
    byLocation[loc].push(row);
  }
  const locationNames = Object.keys(byLocation).sort((a, b) => byLocation[b].length - byLocation[a].length);

  // Sheet definitions: Eligible (all), then per-location
  const sheetDefs = [
    { properties: { sheetId: 0, title: 'Eligible', gridProperties: { frozenRowCount: 1, rowCount: eligibleRows.length + 1, columnCount: 9 } } },
    ...locationNames.map((loc, i) => ({
      properties: {
        sheetId: i + 1,
        title: loc.length > 30 ? loc.slice(0, 30) : loc,
        gridProperties: { frozenRowCount: 1, rowCount: byLocation[loc].length + 1, columnCount: 9 },
      },
    })),
  ];

  // Create spreadsheet
  const today = new Date().toISOString().slice(0, 10);
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: `Recall Eligible Patients — ${today}` },
      sheets: sheetDefs,
    }),
  });

  if (!createRes.ok) {
    console.error('Failed to create sheet:', createRes.status, await createRes.text());
    return;
  }

  const sheet = await createRes.json();
  const spreadsheetId = sheet.spreadsheetId;
  const spreadsheetUrl = sheet.spreadsheetUrl;
  console.log(`  Created: ${spreadsheetUrl}`);

  // Upload helper
  async function uploadToTab(tabName: string, rows: string[][]) {
    const allTabRows = [header, ...rows];
    const BATCH = 1000;
    for (let i = 0; i < allTabRows.length; i += BATCH) {
      const batch = allTabRows.slice(i, i + BATCH);
      const startRow = i + 1;
      const range = `'${tabName}'!A${startRow}:I${startRow + batch.length - 1}`;
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range, values: batch }),
        }
      );
      if (!res.ok) {
        console.error(`  Upload failed for ${tabName}:`, res.status, await res.text());
        return;
      }
    }
  }

  // Upload: Eligible tab (all eligible patients)
  console.log(`  Uploading Eligible (${eligibleRows.length} rows)...`);
  await uploadToTab('Eligible', eligibleRows);

  // Upload: per-location tabs
  for (const loc of locationNames) {
    const tabName = loc.length > 30 ? loc.slice(0, 30) : loc;
    console.log(`  Uploading ${tabName} (${byLocation[loc].length} rows)...`);
    await uploadToTab(tabName, byLocation[loc]);
  }

  // Format all tabs: bold header, color, auto-resize, filters
  const formatRequests: object[] = [];
  for (const def of sheetDefs) {
    const sid = def.properties.sheetId;
    const rowCount = def.properties.gridProperties.rowCount;
    formatRequests.push(
      {
        repeatCell: {
          range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.118, green: 0.251, blue: 0.686 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
        },
      },
      {
        autoResizeDimensions: {
          dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: 9 },
        },
      },
      {
        setBasicFilter: {
          filter: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 9 } },
        },
      },
    );
  }

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: formatRequests }),
    }
  );

  console.log(`\n  Google Sheet ready: ${spreadsheetUrl}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

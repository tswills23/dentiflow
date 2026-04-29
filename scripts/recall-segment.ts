#!/usr/bin/env npx tsx
// Recall Segment CLI
// Reads a CSV, segments patients by location and overdue time. No DB writes.
//
// Usage:
//   npx tsx scripts/recall-segment.ts --file "path/to/patients.csv"
//   npx tsx scripts/recall-segment.ts --file "path/to/patients.csv" --location "32 Cottage"
//   npx tsx scripts/recall-segment.ts --file "path/to/patients.csv" --export out.csv
//   npx tsx scripts/recall-segment.ts --file "path/to/patients.csv" --sheet

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { runSegmentAgent } from '../src/services/recall/segmentAgent';
import type { SegmentedRecord } from '../src/types/recall';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

interface Args {
  file: string;
  location?: string;
  export?: string;
  sheet: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = { file: '', sheet: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file': result.file = args[++i] || ''; break;
      case '--location': result.location = args[++i] || ''; break;
      case '--export': result.export = args[++i] || ''; break;
      case '--sheet': result.sheet = true; break;
    }
  }

  if (!result.file) {
    console.error('Usage: npx tsx scripts/recall-segment.ts --file <csv-path> [--location <name>] [--export <out.csv>] [--sheet]');
    process.exit(1);
  }

  return result;
}

async function main() {
  const args = parseArgs();

  const csvPath = resolve(args.file);
  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf-8');
  } catch {
    console.error(`Cannot read file: ${csvPath}`);
    process.exit(1);
  }

  const result = runSegmentAgent(csvText);

  // Filter by location if provided
  const filtered = args.location
    ? result.records.filter(r =>
        (r.location || '').toLowerCase().includes(args.location!.toLowerCase())
      )
    : result.records;

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n========== RECALL SEGMENT SUMMARY ==========');
  console.log(`Total eligible:             ${result.records.length}`);
  if (args.location) {
    console.log(`Filtered to "${args.location}": ${filtered.length}`);
  }
  console.log(`Skipped (has next appt):    ${result.skippedNextAppt}`);
  console.log(`Skipped (duplicate phone):  ${result.skippedDuplicate}`);
  console.log(`Skipped (invalid phone):    ${result.skippedInvalidPhone}`);
  console.log(`Skipped (test patient):     ${result.skippedTest}`);
  console.log(`Parse errors:               ${result.parseErrors.length}`);

  console.log('\n--- By Location ---');
  for (const [loc, count] of Object.entries(result.byLocation).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${loc}: ${count}`);
  }

  console.log('\n--- By Voice Tier ---');
  const voiceLabels: Record<string, string> = {
    office: 'office (< 6 mo)',
    hygienist: 'hygienist (6-12 mo)',
    doctor: 'doctor (12+ mo)',
  };
  for (const [v, count] of Object.entries(result.byVoice).sort((a, b) => b[1] - a[1])) {
    const pct = result.records.length > 0 ? ((count / result.records.length) * 100).toFixed(1) : '0.0';
    console.log(`  ${voiceLabels[v] || v}: ${count} (${pct}%)`);
  }

  if (result.parseErrors.length > 0) {
    console.log('\n--- Parse Errors ---');
    result.parseErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }

  console.log('\nMode: DRY RUN — no database writes.');
  console.log('To load patients and create sequences, use: recall-launch --file ... --location ...');

  // ── Export CSV ───────────────────────────────────────────────────────────
  if (args.export) {
    const header = 'Last Name,First Name,Phone,Email,Last Visit Date,Months Overdue,Voice,Segment,Location';
    const rows = filtered.map(r => {
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
    console.log(`\nExported ${filtered.length} records → ${exportPath}`);
  }

  // ── Google Sheet ─────────────────────────────────────────────────────────
  if (args.sheet) {
    await exportToGoogleSheet(result.records);
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function exportToGoogleSheet(records: SegmentedRecord[]) {
  console.log('\n--- Creating Google Sheet ---');

  let token: string;
  try {
    token = execSync('gcloud.cmd auth print-access-token', { encoding: 'utf-8' }).trim();
  } catch {
    console.error('Failed to get gcloud token. Run: gcloud auth login --enable-gdrive-access');
    return;
  }

  const header = ['Last Name', 'First Name', 'Phone', 'Email', 'Last Visit Date', 'Months Overdue', 'Voice', 'Segment', 'Location'];

  const allRows = records.map(r => [
    r.lastName || '', r.firstName, r.phone, r.email || '',
    r.lastVisitDate || '', String(r.monthsOverdue), r.voice, r.segment, r.location || '',
  ]);

  const byLocation: Record<string, string[][]> = {};
  for (const row of allRows) {
    const loc = row[8] || '(No Location)';
    if (!byLocation[loc]) byLocation[loc] = [];
    byLocation[loc].push(row);
  }
  const locationNames = Object.keys(byLocation).sort((a, b) => byLocation[b].length - byLocation[a].length);

  const sheetDefs = [
    { properties: { sheetId: 0, title: 'Eligible', gridProperties: { frozenRowCount: 1, rowCount: allRows.length + 1, columnCount: 9 } } },
    ...locationNames.map((loc, i) => ({
      properties: {
        sheetId: i + 1,
        title: loc.length > 30 ? loc.slice(0, 30) : loc,
        gridProperties: { frozenRowCount: 1, rowCount: byLocation[loc].length + 1, columnCount: 9 },
      },
    })),
  ];

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
  console.log(`  Created: ${sheet.spreadsheetUrl}`);

  async function uploadToTab(tabName: string, rows: string[][]) {
    const allTabRows = [header, ...rows];
    const range = `'${tabName}'!A1:I${allTabRows.length}`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, values: allTabRows }),
      }
    );
    if (!res.ok) console.error(`  Upload failed for ${tabName}:`, res.status, await res.text());
  }

  console.log(`  Uploading Eligible (${allRows.length} rows)...`);
  await uploadToTab('Eligible', allRows);

  for (const loc of locationNames) {
    const tabName = loc.length > 30 ? loc.slice(0, 30) : loc;
    console.log(`  Uploading ${tabName} (${byLocation[loc].length} rows)...`);
    await uploadToTab(tabName, byLocation[loc]);
  }

  // Format: bold headers, auto-resize, filters
  const formatRequests = sheetDefs.map(def => ([
    {
      repeatCell: {
        range: { sheetId: def.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
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
        dimensions: { sheetId: def.properties.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 9 },
      },
    },
    {
      setBasicFilter: {
        filter: { range: { sheetId: def.properties.sheetId, startRowIndex: 0, endRowIndex: def.properties.gridProperties.rowCount, startColumnIndex: 0, endColumnIndex: 9 } },
      },
    },
  ])).flat();

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: formatRequests }),
  });

  console.log(`\n  Google Sheet ready: ${sheet.spreadsheetUrl}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

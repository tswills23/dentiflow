// Create a Google Sheet with per-location tabs from the segmented CSV
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const token = execSync('gcloud.cmd auth print-access-token', { encoding: 'utf-8' }).trim();

// ── Parse CSV ──
const csv = readFileSync('c:/Users/tswil/Dentiflow speed to lead/recall_segmented_output.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const allRows = lines.map(line => parseCsvLine(line));
const header = allRows[0];
const dataRows = allRows.slice(1);

// Location is column index 8 (last column)
const locationIdx = header.indexOf('Location');
console.log(`Parsed ${dataRows.length} data rows. Location column index: ${locationIdx}`);

// Group by location
const byLocation = {};
for (const row of dataRows) {
  const loc = row[locationIdx] || '(No Location)';
  if (!byLocation[loc]) byLocation[loc] = [];
  byLocation[loc].push(row);
}

const locationNames = Object.keys(byLocation).sort((a, b) => byLocation[b].length - byLocation[a].length);
console.log('Locations:', locationNames.map(l => `${l} (${byLocation[l].length})`).join(', '));

// ── Create spreadsheet with one tab per location + All Patients ──
const sheetDefs = [
  { properties: { sheetId: 0, title: 'All Patients', gridProperties: { frozenRowCount: 1, rowCount: dataRows.length + 1, columnCount: 9 } } },
  ...locationNames.map((loc, i) => ({
    properties: {
      sheetId: i + 1,
      title: loc.length > 30 ? loc.slice(0, 30) : loc,
      gridProperties: { frozenRowCount: 1, rowCount: byLocation[loc].length + 1, columnCount: 9 },
    },
  })),
];

console.log('Creating spreadsheet...');
const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    properties: { title: 'Recall Segmented Patients — Wills Family Dentistry' },
    sheets: sheetDefs,
  }),
});

if (!createRes.ok) {
  console.error('Failed to create:', createRes.status, await createRes.text());
  process.exit(1);
}

const sheet = await createRes.json();
const spreadsheetId = sheet.spreadsheetId;
const spreadsheetUrl = sheet.spreadsheetUrl;
console.log(`Created: ${spreadsheetUrl}`);

// ── Upload data to each tab ──
async function uploadToTab(tabName, rows) {
  const allTabRows = [header, ...rows];
  const BATCH_SIZE = 1000;
  for (let i = 0; i < allTabRows.length; i += BATCH_SIZE) {
    const batch = allTabRows.slice(i, i + BATCH_SIZE);
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
      console.error(`Upload failed for ${tabName}:`, res.status, await res.text());
      return;
    }
  }
}

// All Patients tab
console.log(`Uploading All Patients (${dataRows.length} rows)...`);
await uploadToTab('All Patients', dataRows);

// Per-location tabs
for (const loc of locationNames) {
  const tabName = loc.length > 30 ? loc.slice(0, 30) : loc;
  console.log(`Uploading ${tabName} (${byLocation[loc].length} rows)...`);
  await uploadToTab(tabName, byLocation[loc]);
}

// ── Format all tabs ──
console.log('Formatting...');
const formatRequests = [];
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

const formatRes = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: formatRequests }),
  }
);

if (!formatRes.ok) {
  console.error('Format failed:', await formatRes.text());
} else {
  console.log('Formatting applied to all tabs.');
}

console.log('');
console.log('Done! Google Sheet ready:');
console.log(spreadsheetUrl);

process.exit(0);

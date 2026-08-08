// Adds "Village Dental — Test Batch" tab (first 500 Village Dental rows) to existing sheet
import { execSync } from 'child_process';

const SPREADSHEET_ID = '1VUUQ_6V2Z9TcQzaHi3ek9drMr32BGbaB3bl0ZBkhNGo';
const TAB_NAME = 'Village Dental — Test Batch';

const token = execSync('gcloud.cmd auth print-access-token').toString().trim();

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

// 1. Read Village Dental tab
console.log('Reading Village Dental tab...');
const readData = await apiFetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent('Village Dental')}!A1:I900`
);
const allRows = readData.values || [];
if (allRows.length < 2) throw new Error('No Village Dental data');

const header = allRows[0];
const villageRows = allRows.slice(1);
const testBatch = villageRows.slice(0, 500);
console.log(`Village Dental: ${villageRows.length} rows — test batch: ${testBatch.length}`);

// 2. Get or add new tab
let newSheetId;
console.log('Checking for existing tab...');
const sheetMeta = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`);
const existing = sheetMeta.sheets?.find(s => s.properties.title === TAB_NAME);
if (existing) {
  newSheetId = existing.properties.sheetId;
  console.log(`Tab already exists, sheetId: ${newSheetId}`);
} else {
  console.log(`Adding tab "${TAB_NAME}"...`);
  const addData = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: TAB_NAME,
              gridProperties: { frozenRowCount: 1, rowCount: 502, columnCount: 9 },
            }
          }
        }]
      })
    }
  );
  newSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
  console.log(`Tab created, sheetId: ${newSheetId}`);
}

// 3. Upload rows
console.log('Uploading 500 rows...');
const uploadRows = [header, ...testBatch];
const range = `${TAB_NAME}!A1:I${uploadRows.length}`;
await apiFetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
  {
    method: 'PUT',
    body: JSON.stringify({ range, values: uploadRows })
  }
);
console.log('Uploaded.');

// 4. Format
console.log('Formatting...');
await apiFetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
  {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.118, green: 0.251, blue: 0.686 },
                horizontalAlignment: 'CENTER',
              }
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
          }
        },
        { autoResizeDimensions: { dimensions: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 9 } } },
        { setBasicFilter: { filter: { range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 502, startColumnIndex: 0, endColumnIndex: 9 } } } },
      ]
    })
  }
);

console.log(`\nDone! Tab "${TAB_NAME}" added with ${testBatch.length} rows.`);
console.log(`Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);

// Segment the Ascend "Unscheduled Treatment" CSV export
//
// Hot leads = patients with unscheduled treatment plans whose Last Visit is
// within the past 6 months. They've been in the chair recently → highest
// probability of returning to finish what was diagnosed.
//
// Outputs a Google Sheet with:
//   - "Hot Leads" tab: one row per patient, sorted by total case $ desc
//   - "All Procedures" tab: one row per (deduped) procedure
//   - Per-location tabs for the Hot Leads view

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const CSV_PATH = process.argv[2] || 'c:/Users/tswil/Dentiflow v2/imports/unscheduled-tx-2026-06-01.csv';
const SHEET_TITLE = 'unscheduled treatment 6/1';

const TODAY = new Date('2026-06-01');
const SIX_MONTHS_AGO = new Date(TODAY);
SIX_MONTHS_AGO.setMonth(SIX_MONTHS_AGO.getMonth() - 6);
const SIXTY_DAYS_AGO = new Date(TODAY);
SIXTY_DAYS_AGO.setDate(SIXTY_DAYS_AGO.getDate() - 60);

// "Big" treatment = crowns, root canals, implants, bridges.
// Excludes standalone core buildup (D2950) and perio scaling (D4341/D4342).
const BIG_CODES = new Set([
  'D2740', 'D2750', 'D2751', 'D2752',  // crowns
  'D3310', 'D3320', 'D3330',            // root canals
  'D6010',                              // implant placement
  'D6058',                              // implant crown
  'D6240', 'D6750',                     // bridge components
]);

// ── CSV parsing ──
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
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

function parseDate(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  return isNaN(d.getTime()) ? null : d;
}

function parseMoney(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[$,"]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function fmtDate(d) {
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function fmtMoney(n) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ── Test/dummy patient detection ──
const BAD_PHONES = new Set([
  '(123) 456-7890',
  '(309) 555-5554',
  '(309) 555-5555',
  '(331) 645-5299',
]);

function isTestPatient(first, last, phone) {
  const f = (first || '').toLowerCase().trim();
  const l = (last || '').toLowerCase().trim();
  if (BAD_PHONES.has(phone)) return true;
  if (!f && !l) return true;
  if (l === 'test' || l === 'testy' || f === 'test') return true;
  if (f === 'patient' && l === 'test') return true;
  if (l.startsWith('aaatest')) return true;
  if (l.startsWith('zippity')) return true;
  if (/^\(.+\)$/.test(last)) return true; // (Heritage), (Nanny)
  if (l === '****' || /^-+/.test(l) || /^[-+0`]+$/.test(l)) return true;
  if (l.length <= 1) return true; // single-char placeholder last names
  return false;
}

// ── Read CSV ──
console.log(`Reading: ${CSV_PATH}`);
const raw = readFileSync(CSV_PATH, 'utf-8');
const allLines = raw.split(/\r?\n/);

// Find the header row (starts with "Pat. Prim. Carrier")
let headerIdx = -1;
for (let i = 0; i < allLines.length; i++) {
  if (allLines[i].startsWith('Pat. Prim. Carrier')) { headerIdx = i; break; }
}
if (headerIdx < 0) { console.error('Header row not found'); process.exit(1); }

const header = parseCsvLine(allLines[headerIdx]);
const dataRows = allLines.slice(headerIdx + 1)
  .map(parseCsvLine)
  .filter(r => r.length >= 15 && (r[14] || r[15]));

console.log(`Header cols: ${header.length}, raw data rows: ${dataRows.length}`);

// Column indices
const COL = {
  carrier: 0,
  renewalMonth: 1,
  remainingBenefits: 2,
  location: 3,
  nextAppt: 4,
  lastVisit: 5,
  amount: 6,
  description: 7,
  code: 9,
  provider: 10,
  txDate: 11,
  email: 12,
  phone: 13,
  firstName: 14,
  lastName: 15,
};

// ── Dedup procedures (Patient + Code + TxDate) ──
const seen = new Set();
const procedures = [];
let dupes = 0;
let testFiltered = 0;
let noPhoneFiltered = 0;

for (const r of dataRows) {
  const first = (r[COL.firstName] || '').trim();
  const last = (r[COL.lastName] || '').trim();
  const phone = (r[COL.phone] || '').trim();
  const code = (r[COL.code] || '').trim();
  const txDate = (r[COL.txDate] || '').trim();

  if (isTestPatient(first, last, phone)) { testFiltered++; continue; }
  if (!phone || phone.startsWith('(000)')) { noPhoneFiltered++; continue; }

  const key = `${last.toLowerCase()}|${first.toLowerCase()}|${phone}|${code}|${txDate}`;
  if (seen.has(key)) { dupes++; continue; }
  seen.add(key);

  procedures.push({
    carrier: r[COL.carrier] || '',
    renewalMonth: r[COL.renewalMonth] || '',
    remainingBenefits: parseMoney(r[COL.remainingBenefits]),
    location: r[COL.location] || '',
    nextAppt: parseDate(r[COL.nextAppt]),
    lastVisit: parseDate(r[COL.lastVisit]),
    amount: parseMoney(r[COL.amount]),
    description: r[COL.description] || '',
    code,
    provider: r[COL.provider] || '',
    txDate: parseDate(txDate),
    email: (r[COL.email] || '').trim().toLowerCase() === 'none@none.com' ? '' : (r[COL.email] || '').trim(),
    phone,
    firstName: first,
    lastName: last,
  });
}

console.log(`After dedup: ${procedures.length} procedures (removed ${dupes} duplicates, ${testFiltered} test patients, ${noPhoneFiltered} no-phone)`);

// ── Group by patient ──
const patientKey = (p) => `${p.lastName.toLowerCase()}|${p.firstName.toLowerCase()}|${p.phone}`;
const patientMap = new Map();

for (const p of procedures) {
  const k = patientKey(p);
  if (!patientMap.has(k)) {
    patientMap.set(k, {
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      email: p.email,
      location: p.location,
      carrier: p.carrier,
      renewalMonth: p.renewalMonth,
      // Sanitize obvious bad benefit numbers (placeholders like 99999)
      remainingBenefits: p.remainingBenefits >= 99000 ? null : p.remainingBenefits,
      lastVisit: p.lastVisit,
      nextAppt: p.nextAppt,
      procedures: [],
      totalAmount: 0,
    });
  }
  const pt = patientMap.get(k);
  pt.procedures.push(p);
  pt.totalAmount += p.amount;
  // Use most recent last visit
  if (p.lastVisit && (!pt.lastVisit || p.lastVisit > pt.lastVisit)) pt.lastVisit = p.lastVisit;
  // Update email/carrier if missing
  if (!pt.email && p.email) pt.email = p.email;
  if (!pt.carrier && p.carrier) pt.carrier = p.carrier;
  if (!pt.nextAppt && p.nextAppt) pt.nextAppt = p.nextAppt;
}

const allPatients = Array.from(patientMap.values());
console.log(`Total unique patients (any last-visit date): ${allPatients.length}`);

// ── Filter: Last Visit within 6 months ──
// Tier tag: "Ghosting" = no future appt at all (safest to bulk-text)
//           "Has Appt" = has a future appt (likely hygiene — verify before texting)
for (const p of allPatients) {
  p.tier = p.nextAppt ? 'Has Appt' : 'Ghosting';
}

const hotLeads = allPatients
  .filter(p => p.lastVisit && p.lastVisit >= SIX_MONTHS_AGO)
  .sort((a, b) => {
    // Ghosting first, then by case value desc
    if (a.tier !== b.tier) return a.tier === 'Ghosting' ? -1 : 1;
    return b.totalAmount - a.totalAmount;
  });

const ghostingLeads = hotLeads.filter(p => p.tier === 'Ghosting');
const withApptLeads = hotLeads.filter(p => p.tier === 'Has Appt');

// Hottest of the hot: last visit ≤ 60 days AND has at least one "big" code unscheduled
const bigTreatment60d = allPatients
  .filter(p => p.lastVisit && p.lastVisit >= SIXTY_DAYS_AGO)
  .filter(p => p.procedures.some(pr => BIG_CODES.has(pr.code)))
  .sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'Ghosting' ? -1 : 1;
    return b.totalAmount - a.totalAmount;
  });

console.log(`Hot leads (last visit ≥ ${fmtDate(SIX_MONTHS_AGO)}): ${hotLeads.length}`);
console.log(`  Ghosting (no future appt — safe to bulk-text): ${ghostingLeads.length}`);
console.log(`  Has future appt (verify before texting): ${withApptLeads.length}`);
console.log(`Big treatment + last 60 days: ${bigTreatment60d.length}`);

// Break out by location — ALL hot leads (Ghosting sorted first within each location)
const byLocation = {};
for (const p of hotLeads) {
  const loc = p.location || '(No Location)';
  if (!byLocation[loc]) byLocation[loc] = [];
  byLocation[loc].push(p);
}
const locationNames = Object.keys(byLocation).sort((a, b) => byLocation[b].length - byLocation[a].length);
console.log('Hot leads by location (all 504):');
for (const loc of locationNames) {
  const locGhosting = byLocation[loc].filter(p => p.tier === 'Ghosting').length;
  console.log(`  ${loc}: ${byLocation[loc].length} (${locGhosting} ghosting, ${byLocation[loc].length - locGhosting} has-appt)`);
}

const totalCaseValue = hotLeads.reduce((s, p) => s + p.totalAmount, 0);
const ghostingCaseValue = ghostingLeads.reduce((s, p) => s + p.totalAmount, 0);
console.log(`Total case value (all hot leads): ${fmtMoney(totalCaseValue)}`);
console.log(`Total case value (ghosting only): ${fmtMoney(ghostingCaseValue)}`);

// ── Build sheet rows ──
const PATIENT_HEADER = [
  'Tier', 'Last Name', 'First Name', 'Phone', 'Email', 'Location',
  'Last Visit', 'Days Since Last Visit', 'Next Appt',
  '# Procedures', 'Total Case Value', 'Procedure Summary',
  'Primary Carrier', 'Remaining Benefits', 'Renewal Month',
];

function patientRow(p) {
  const daysSince = p.lastVisit
    ? Math.floor((TODAY - p.lastVisit) / (1000 * 60 * 60 * 24))
    : '';
  const procSummary = p.procedures
    .map(pr => `${pr.code} ${pr.description} (${fmtMoney(pr.amount)})`)
    .join(' | ');
  return [
    p.tier,
    p.lastName,
    p.firstName,
    p.phone,
    p.email,
    p.location,
    fmtDate(p.lastVisit),
    daysSince,
    fmtDate(p.nextAppt),
    p.procedures.length,
    fmtMoney(p.totalAmount),
    procSummary,
    p.carrier,
    p.remainingBenefits === null ? '' : fmtMoney(p.remainingBenefits),
    p.renewalMonth,
  ];
}

const PROC_HEADER = [
  'Last Name', 'First Name', 'Phone', 'Email', 'Location',
  'Last Visit', 'Next Appt', 'Tx Date',
  'Code', 'Description', 'Amount', 'Provider',
  'Primary Carrier', 'Remaining Benefits', 'Renewal Month',
];

function procRow(p, pr) {
  return [
    p.lastName, p.firstName, p.phone, p.email, pr.location,
    fmtDate(p.lastVisit), fmtDate(p.nextAppt), fmtDate(pr.txDate),
    pr.code, pr.description, fmtMoney(pr.amount), pr.provider,
    pr.carrier,
    pr.remainingBenefits >= 99000 ? '' : fmtMoney(pr.remainingBenefits),
    pr.renewalMonth,
  ];
}

const hotLeadRows = hotLeads.map(patientRow);
const ghostingRows = ghostingLeads.map(patientRow);
const bigTreatment60dRows = bigTreatment60d.map(patientRow);
const procRows = [];
for (const p of hotLeads) for (const pr of p.procedures) procRows.push(procRow(p, pr));

const bigTreatment60dCaseValue = bigTreatment60d.reduce((s, p) => s + p.totalAmount, 0);

// ── Save CSV backup before attempting Sheet upload ──
import { writeFileSync } from 'fs';
function toCsv(rows) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
const csvOutPath = 'c:/Users/tswil/Dentiflow v2/imports/unscheduled-tx-hot-leads-2026-06-01.csv';
writeFileSync(csvOutPath, toCsv([PATIENT_HEADER, ...hotLeadRows]));
console.log(`\nCSV backup saved: ${csvOutPath}`);
const ghostingCsvPath = 'c:/Users/tswil/Dentiflow v2/imports/unscheduled-tx-ghosting-2026-06-01.csv';
writeFileSync(ghostingCsvPath, toCsv([PATIENT_HEADER, ...ghostingRows]));
console.log(`Ghosting CSV saved: ${ghostingCsvPath}`);
const procCsvPath = 'c:/Users/tswil/Dentiflow v2/imports/unscheduled-tx-hot-leads-procedures-2026-06-01.csv';
writeFileSync(procCsvPath, toCsv([PROC_HEADER, ...procRows]));
console.log(`Procedures CSV saved: ${procCsvPath}`);

// ── Create Google Sheet ──
console.log('\nAuthenticating with gcloud...');
const token = execSync('gcloud.cmd auth print-access-token', { encoding: 'utf-8' }).trim();

const PATIENT_COL_COUNT = PATIENT_HEADER.length;
const PROC_COL_COUNT = PROC_HEADER.length;

// Tab title helper — Google Sheets allows up to 100 chars
function locTabTitle(loc) {
  const title = `${loc} unscheduled treatment`;
  return title.length > 100 ? title.slice(0, 100) : title;
}

const sheetDefs = [
  // Hottest segment FIRST: big treatment + last 60 days
  {
    properties: {
      sheetId: 0,
      title: 'Big Treatment (Last 60 Days)',
      gridProperties: { frozenRowCount: 1, rowCount: bigTreatment60dRows.length + 10, columnCount: PATIENT_COL_COUNT },
    },
  },
  // Per-location tabs (primary working view)
  ...locationNames.map((loc, i) => ({
    properties: {
      sheetId: i + 1,
      title: locTabTitle(loc),
      gridProperties: { frozenRowCount: 1, rowCount: byLocation[loc].length + 10, columnCount: PATIENT_COL_COUNT },
    },
  })),
  // Overview tabs after
  {
    properties: {
      sheetId: locationNames.length + 1,
      title: 'All Hot Leads',
      gridProperties: { frozenRowCount: 1, rowCount: hotLeadRows.length + 10, columnCount: PATIENT_COL_COUNT },
    },
  },
  {
    properties: {
      sheetId: locationNames.length + 2,
      title: 'Ghosting (Safe to Text)',
      gridProperties: { frozenRowCount: 1, rowCount: ghostingRows.length + 10, columnCount: PATIENT_COL_COUNT },
    },
  },
  {
    properties: {
      sheetId: locationNames.length + 3,
      title: 'All Procedures',
      gridProperties: { frozenRowCount: 1, rowCount: procRows.length + 10, columnCount: PROC_COL_COUNT },
    },
  },
];

console.log('Creating spreadsheet...');
const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    properties: { title: SHEET_TITLE },
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

// ── Upload data ──
function colLetter(n) {
  // 1 → A, 26 → Z, 27 → AA
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function uploadToTab(tabName, hdr, rows) {
  const all = [hdr, ...rows];
  const lastCol = colLetter(hdr.length);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    const startRow = i + 1;
    const range = `'${tabName}'!A${startRow}:${lastCol}${startRow + batch.length - 1}`;
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

console.log(`Uploading Big Treatment (Last 60 Days) (${bigTreatment60dRows.length} rows)...`);
await uploadToTab('Big Treatment (Last 60 Days)', PATIENT_HEADER, bigTreatment60dRows);

// Upload per-location tabs
for (const loc of locationNames) {
  const tabName = locTabTitle(loc);
  const rows = byLocation[loc].map(patientRow);
  console.log(`Uploading ${tabName} (${rows.length} rows)...`);
  await uploadToTab(tabName, PATIENT_HEADER, rows);
}

console.log(`Uploading All Hot Leads (${hotLeadRows.length} rows)...`);
await uploadToTab('All Hot Leads', PATIENT_HEADER, hotLeadRows);

console.log(`Uploading Ghosting (${ghostingRows.length} rows)...`);
await uploadToTab('Ghosting (Safe to Text)', PATIENT_HEADER, ghostingRows);

console.log(`Uploading All Procedures (${procRows.length} rows)...`);
await uploadToTab('All Procedures', PROC_HEADER, procRows);

// ── Format ──
console.log('Formatting...');
const formatRequests = [];
for (const def of sheetDefs) {
  const sid = def.properties.sheetId;
  const rowCount = def.properties.gridProperties.rowCount;
  const colCount = def.properties.gridProperties.columnCount;
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
        dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: colCount },
      },
    },
    {
      setBasicFilter: {
        filter: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: colCount } },
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
  console.log('Formatting applied.');
}

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('Done!');
console.log(`Sheet: ${spreadsheetUrl}`);
console.log('');
console.log(`Big Treatment (last 60d): ${bigTreatment60d.length} patients · ${fmtMoney(bigTreatment60dCaseValue)}`);
console.log(`Ghosting (safe to text):  ${ghostingLeads.length} patients · ${fmtMoney(ghostingCaseValue)}`);
console.log(`Has future appt (verify): ${withApptLeads.length} patients · ${fmtMoney(totalCaseValue - ghostingCaseValue)}`);
console.log(`─────────────────────────────────`);
console.log(`Total hot leads:          ${hotLeads.length} patients · ${fmtMoney(totalCaseValue)}`);
console.log('═══════════════════════════════════════════════════════════');

process.exit(0);

#!/usr/bin/env npx tsx
// Sync the office call list (callback_requests) to a Google Sheet you can share.
// Creates the Sheet once (owned by your gcloud-authed Google account), saves its
// ID locally, and updates the same Sheet on every re-run so the shared link stays valid.
//
// Requires a one-time: gcloud auth login --enable-gdrive-access
// Usage: npx tsx scripts/sync-callback-sheet.ts
import dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const ID_FILE = resolve(__dirname, '.callback-sheet-id.txt');
const TITLE = 'Village Dental — Recall Call List';
const TAB = 'Call List';
const HEADER = ['Requested', 'Name', 'Phone', 'Type', 'Status', 'What they said'];
// Second tab: patients who deferred to a timeframe. The system auto-re-engages them
// on the date — this tab is the office's visibility into who's queued and when.
const TAB2 = 'Future Reach Outs';
const HEADER2 = ['Re-engage date', 'Name', 'Phone', 'What they said', 'Handled by'];

function gcloudToken(): string {
  // On this machine `python`/`python3` hit a broken Windows Store alias; gcloud
  // needs a real interpreter via CLOUDSDK_PYTHON. The `py` launcher resolves it.
  let pyExe = '';
  try { pyExe = execSync('py -c "import sys; print(sys.executable)"', { encoding: 'utf-8' }).trim(); } catch { /* fall through */ }
  const env = pyExe ? { ...process.env, CLOUDSDK_PYTHON: pyExe } : process.env;
  for (const bin of ['gcloud', 'gcloud.cmd']) {
    try { return execSync(`${bin} auth print-access-token`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], env }).trim(); } catch { /* try next */ }
  }
  console.error('Could not get a gcloud token. Run: gcloud auth login --enable-gdrive-access');
  process.exit(1);
}

async function gfetch(token: string, url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { console.error(`${method} ${url} -> ${res.status}`, await res.text()); process.exit(1); }
  return res.json();
}

(async () => {
  const token = gcloudToken();

  // 1a. Pull callback_requests. Deferred follow-ups go to their own tab (below),
  //     so the Call List shows only items needing a human touch now.
  const { data, error } = await supabase
    .from('callback_requests')
    .select('created_at, patient_id, patient_name, phone, request_type, status, message')
    .eq('practice_id', PID)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('query failed:', error.message); process.exit(1); }

  const callList = (data || []).filter(r => r.request_type !== 'deferred_followup');
  const rows = callList.map(r => [
    new Date(r.created_at).toLocaleString('en-US'),
    r.patient_name || '', r.phone || '', r.request_type || '', r.status || '', r.message || '',
  ]);

  // 1b. Pull the timed-defer queue (authoritative date lives on the sequence).
  const { data: deferred } = await supabase
    .from('recall_sequences')
    .select('patient_id, defer_until, patients!inner(first_name,last_name,phone,location)')
    .eq('practice_id', PID).eq('exit_reason', 'deferred')
    .not('defer_until', 'is', null)
    .order('defer_until', { ascending: true });
  // Map patient_id -> what they said (from the deferred_followup log), prefix stripped.
  const saidBy = new Map<string, string>();
  (data || []).filter(r => r.request_type === 'deferred_followup').forEach(r => {
    if (r.patient_id) saidBy.set(r.patient_id, (r.message || '').replace(/^\[re-engage[^\]]*\]\s*/, ''));
  });
  const deferRows = (deferred || [])
    .filter((r: any) => (r.patients?.location || '').includes('Village'))
    .map((r: any) => [
      r.defer_until.slice(0, 10),
      [r.patients?.first_name, r.patients?.last_name].filter(Boolean).join(' '),
      r.patients?.phone || '', saidBy.get(r.patient_id) || '', 'Auto-text on date',
    ]);

  // 2. Create the sheet once, or reuse the saved one.
  let spreadsheetId = existsSync(ID_FILE) ? readFileSync(ID_FILE, 'utf-8').trim() : '';
  let spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  if (!spreadsheetId) {
    const created = await gfetch(token, 'https://sheets.googleapis.com/v4/spreadsheets', 'POST', {
      properties: { title: TITLE },
      sheets: [{ properties: { sheetId: 0, title: TAB, gridProperties: { frozenRowCount: 1 } } }],
    });
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
    writeFileSync(ID_FILE, spreadsheetId, 'utf-8');
    await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, 'POST', {
      requests: [{ repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }],
    });
  }

  // 2b. Ensure the "Future Reach Outs" tab exists; create + bold-header it if missing.
  const meta = await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, 'GET');
  const hasTab2 = (meta.sheets || []).some((s: any) => s.properties?.title === TAB2);
  if (!hasTab2) {
    const added = await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, 'POST', {
      requests: [{ addSheet: { properties: { title: TAB2, gridProperties: { frozenRowCount: 1 } } } }],
    });
    const newSheetId = added.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newSheetId !== undefined) {
      await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, 'POST', {
        requests: [{ repeatCell: { range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }],
      });
    }
  }

  // 3. Write each tab WITHOUT destroying office-added notes.
  //    The office keeps a free-text "Notes" column on the sheet. Because this sync
  //    rewrites and REORDERS rows every run, a positional notes column would be both
  //    wiped and misaligned. So we: (a) read the existing sheet, (b) recover any
  //    "Notes" column keyed by PHONE, (c) re-attach each note to that patient's new
  //    row, (d) clear ONLY the columns we own — never A:Z — so anything the office
  //    added to the right survives. RAW so leading +/-/= in phones aren't formulas.
  const colLetter = (n: number) => String.fromCharCode(65 + n); // 0->A, 6->G
  async function writeTab(tab: string, header: string[], dataRows: string[][], phoneIdx: number) {
    const existing = await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A1:Z100000`)}`, 'GET');
    const existingRows: string[][] = existing.values || [];
    const existingHeader: string[] = existingRows[0] || [];
    // Find the office's notes + phone columns by header name (robust to the office
    // inserting/renaming columns), falling back to our known phone position.
    const noteIdx = existingHeader.findIndex((h) => /note/i.test(h || ''));
    const ePhoneIdx = existingHeader.findIndex((h) => /phone/i.test(h || ''));
    const readPhoneIdx = ePhoneIdx >= 0 ? ePhoneIdx : phoneIdx;
    const noteByPhone = new Map<string, string>();
    if (noteIdx >= 0) {
      for (let i = 1; i < existingRows.length; i++) {
        const r = existingRows[i] || [];
        const phone = (r[readPhoneIdx] || '').toString().trim();
        const note = (r[noteIdx] || '').toString().trim();
        if (phone && note) noteByPhone.set(phone, note);
      }
    }
    const outHeader = [...header, 'Notes'];
    const noteCol = outHeader.length - 1;
    const outRows = dataRows.map((r) => {
      const row = [...r];
      row[noteCol] = noteByPhone.get((r[phoneIdx] || '').toString().trim()) || '';
      return row;
    });
    const vals = [outHeader, ...outRows];
    const lastCol = colLetter(outHeader.length - 1);
    await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A1:${lastCol}100000`)}:clear`, 'POST', {});
    const range = `'${tab}'!A1:${lastCol}${vals.length}`;
    await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, 'PUT', { range, values: vals });
    return noteByPhone.size;
  }
  const notesKept1 = await writeTab(TAB, HEADER, rows, 2);
  const notesKept2 = await writeTab(TAB2, HEADER2, deferRows, 2);

  console.log(`Synced ${rows.length} call-list item(s) + ${deferRows.length} future reach-out(s); preserved ${notesKept1 + notesKept2} office note(s).`);
  console.log(`Sheet: ${spreadsheetUrl}`);
})();

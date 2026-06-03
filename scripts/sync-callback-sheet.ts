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

  // 1. Pull the call list (newest first), open requests first.
  const { data, error } = await supabase
    .from('callback_requests')
    .select('created_at, patient_name, phone, request_type, status, message')
    .eq('practice_id', PID)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('query failed:', error.message); process.exit(1); }

  const rows = (data || []).map(r => [
    new Date(r.created_at).toLocaleString('en-US'),
    r.patient_name || '', r.phone || '', r.request_type || '', r.status || '', r.message || '',
  ]);
  const values = [HEADER, ...rows];

  // 2. Create the sheet once, or reuse the saved one.
  let spreadsheetId = existsSync(ID_FILE) ? readFileSync(ID_FILE, 'utf-8').trim() : '';
  let spreadsheetUrl = '';

  if (!spreadsheetId) {
    const created = await gfetch(token, 'https://sheets.googleapis.com/v4/spreadsheets', 'POST', {
      properties: { title: TITLE },
      sheets: [{ properties: { sheetId: 0, title: TAB, gridProperties: { frozenRowCount: 1 } } }],
    });
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
    writeFileSync(ID_FILE, spreadsheetId, 'utf-8');
    // bold header
    await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, 'POST', {
      requests: [{
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      }],
    });
  } else {
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }

  // 3. Clear old data, then write current values.
  await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${TAB}'!A1:Z100000`)}:clear`, 'POST', {});
  const range = `'${TAB}'!A1:F${values.length}`;
  await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, 'PUT', { range, values });

  console.log(`Synced ${rows.length} callback request(s).`);
  console.log(`Sheet: ${spreadsheetUrl}`);
  console.log('Share it with the office via the Share button (it is owned by your Google account).');
})();

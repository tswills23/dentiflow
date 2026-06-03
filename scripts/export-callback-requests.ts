#!/usr/bin/env npx tsx
// Export the office's call list (callback_requests) to a CSV the office can work from.
// Usage:
//   npx tsx scripts/export-callback-requests.ts                 → open requests → callback-list.csv
//   npx tsx scripts/export-callback-requests.ts --all           → include done ones
//   npx tsx scripts/export-callback-requests.ts --out path.csv  → custom output path
import dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const includeAll = process.argv.includes('--all');
const outIdx = process.argv.indexOf('--out');
const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : 'callback-list.csv';

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

(async () => {
  let q = supabase
    .from('callback_requests')
    .select('created_at, patient_name, phone, request_type, status, message')
    .eq('practice_id', PID)
    .order('created_at', { ascending: false });
  if (!includeAll) q = q.eq('status', 'open');

  const { data, error } = await q;
  if (error) { console.error('query failed:', error.message); process.exit(1); }

  const rows = data || [];
  const header = ['Requested', 'Name', 'Phone', 'Type', 'Status', 'What they said'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.created_at, r.patient_name, r.phone, r.request_type, r.status, r.message].map(csvCell).join(','));
  }
  writeFileSync(resolve(process.cwd(), outPath), lines.join('\n'), 'utf8');
  console.log(`Wrote ${rows.length} callback request(s) to ${outPath}`);
})();

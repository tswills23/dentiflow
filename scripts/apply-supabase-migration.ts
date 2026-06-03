// Apply a Supabase migration file to the project DB via the Management API.
// Target project ref is derived from .env SUPABASE_URL (the same DB the app uses).
// Usage: npx tsx scripts/apply-supabase-migration.ts supabase/migrations/<file>.sql
import dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const file = process.argv[2];
if (!file) {
  console.error('Usage: apply-supabase-migration.ts <path-to-sql>');
  process.exit(1);
}

const url = process.env.SUPABASE_URL || '';
const ref = url.replace(/^https?:\/\//, '').split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env');
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), file), 'utf8');

(async () => {
  console.log(`Applying ${file} to project ${ref} ...`);
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  console.log('HTTP', r.status);
  console.log(text);
  process.exit(r.ok ? 0 : 1);
})();

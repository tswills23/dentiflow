import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const tables = ["practices", "patients", "conversations", "appointments", "metrics_daily", "automation_log", "user_profiles"];

for (const table of tables) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
  });
  const data = await resp.json();
  console.log(`${table}: ${resp.status} — ${Array.isArray(data) ? data.length + " rows" : "error"}`);
  if (table === "practices" && Array.isArray(data) && data.length > 0) {
    console.log(JSON.stringify(data[0], null, 2));
  }
}

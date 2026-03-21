/**
 * Run migration 003_patient_location.sql against Supabase.
 * Reuses the same pooler-scanning approach from run_migration.mjs.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
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
const PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0];

const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-west-2", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "ap-south-1", "sa-east-1"];

async function tryPoolerConnection(region, port) {
  const connString = `postgresql://postgres.${PROJECT_REF}:${SERVICE_KEY}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  await client.query("SELECT 1 as test");
  console.log(`  Connected! Region: ${region}, Port: ${port}`);
  return client;
}

async function findWorkingConnection() {
  for (const region of REGIONS) {
    console.log(`Trying region: ${region} (session mode, port 5432)...`);
    try {
      return await tryPoolerConnection(region, 5432);
    } catch (e) {
      continue;
    }
  }
  for (const region of REGIONS) {
    console.log(`Trying region: ${region} (transaction mode, port 6543)...`);
    try {
      return await tryPoolerConnection(region, 6543);
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function main() {
  console.log(`Project ref: ${PROJECT_REF}`);
  console.log("Searching for working connection...\n");

  let client = await findWorkingConnection();

  if (!client) {
    console.log("Trying direct connection...");
    const directClient = new Client({
      connectionString: `postgresql://postgres:${SERVICE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await directClient.connect();
      console.log("Connected via direct connection!");
      client = directClient;
    } catch (e) {
      console.error(`Direct connection failed: ${e.message}`);
      console.log("\n=== CONNECTION FAILED ===");
      console.log("Please run this SQL in Supabase Dashboard > SQL Editor:");
      const sql = readFileSync(resolve(__dirname, "..", "supabase", "migrations", "003_patient_location.sql"), "utf-8");
      console.log("\n" + sql);
      return;
    }
  }

  // Run migration
  const migrationPath = resolve(__dirname, "..", "supabase", "migrations", "003_patient_location.sql");
  const sql = readFileSync(migrationPath, "utf-8");

  console.log(`\nRunning migration 003_patient_location.sql...`);
  console.log("-".repeat(50));

  try {
    await client.query(sql);
    console.log("\nMigration 003 completed successfully!");

    // Verify
    const result = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'location'");
    if (result.rows.length > 0) {
      console.log("\nVerified: 'location' column exists on patients table");
      console.log(JSON.stringify(result.rows[0], null, 2));
    }

    // Check index
    const idxResult = await client.query("SELECT indexname FROM pg_indexes WHERE tablename = 'patients' AND indexname = 'idx_patients_practice_location'");
    if (idxResult.rows.length > 0) {
      console.log("Verified: idx_patients_practice_location index exists");
    }
  } catch (e) {
    console.error(`Migration error: ${e.message}`);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

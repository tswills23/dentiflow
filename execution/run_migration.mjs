/**
 * Run SQL migration against Supabase via direct PostgreSQL connection.
 * Uses Supavisor (pooler) with JWT auth for the service_role.
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

// Supabase pooler regions to try
const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-west-2", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "ap-south-1", "sa-east-1"];

async function tryPoolerConnection(region, port) {
  const connString = `postgresql://postgres.${PROJECT_REF}:${SERVICE_KEY}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    const res = await client.query("SELECT 1 as test");
    console.log(`  Connected! Region: ${region}, Port: ${port}`);
    return client;
  } catch (e) {
    try { await client.end(); } catch (_) {}
    throw e;
  }
}

async function findWorkingConnection() {
  // Try session mode (port 5432) - needed for DDL statements
  // Session mode is required for CREATE TABLE, etc.
  for (const region of REGIONS) {
    console.log(`Trying region: ${region} (session mode, port 5432)...`);
    try {
      return await tryPoolerConnection(region, 5432);
    } catch (e) {
      const msg = e.message || e.toString();
      if (msg.includes("ENOTFOUND") || msg.includes("timeout") || msg.includes("ECONNREFUSED")) {
        // Wrong region, try next
        continue;
      }
      console.log(`  Error: ${msg.slice(0, 120)}`);
      // If auth error, try next region (might be wrong region format)
      if (msg.includes("password") || msg.includes("auth")) continue;
      // For other errors, still try next
      continue;
    }
  }

  // Also try transaction mode (port 6543) as fallback
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
  console.log(`Target: ${SUPABASE_URL}`);
  console.log("=".repeat(50));
  console.log("Searching for working Supabase pooler connection...\n");

  const client = await findWorkingConnection();

  if (!client) {
    console.log("\nCould not connect via pooler with JWT auth.");
    console.log("Trying direct connection...");

    // Try direct connection
    const directClient = new Client({
      connectionString: `postgresql://postgres:${SERVICE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });

    try {
      await directClient.connect();
      console.log("Connected via direct connection!");
      await runMigration(directClient);
    } catch (e) {
      console.log(`Direct connection failed: ${e.message}`);
      console.log("\n=== CONNECTION FAILED ===");
      console.log("Could not establish a PostgreSQL connection.");
      console.log("Options:");
      console.log("1. Provide database password (from Supabase Dashboard > Settings > Database)");
      console.log("2. Run migration in Supabase Dashboard SQL Editor");
      console.log("3. Run: npx supabase login (then use CLI)");
    }
    return;
  }

  await runMigration(client);
}

async function runMigration(client) {
  const migrationPath = resolve(__dirname, "..", "supabase", "migrations", "001_initial_schema.sql");
  const sql = readFileSync(migrationPath, "utf-8");

  console.log(`\nRunning migration: ${sql.length} characters`);
  console.log("-".repeat(50));

  try {
    await client.query(sql);
    console.log("\nMigration completed successfully!");

    // Verify by querying practices
    const result = await client.query("SELECT * FROM practices");
    console.log("\n" + "=".repeat(50));
    console.log("PRACTICES TABLE - SEED DATA:");
    console.log("=".repeat(50));
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (e) {
    console.error(`\nMigration error: ${e.message}`);
    if (e.message.includes("already exists")) {
      console.log("\nTables may already exist. Checking current state...");
      try {
        const result = await client.query("SELECT * FROM practices");
        console.log(JSON.stringify(result.rows, null, 2));
      } catch (e2) {
        console.error(`Query error: ${e2.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch(console.error);

// Direct import — bypasses HTTP, calls ingest functions directly
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// Import our modules
const { parseRecallCsv } = await import('../src/services/recall/csvParser.js');
const { ingestPatients } = await import('../src/services/recall/ingestAgent.js');

const practiceId = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const csv = readFileSync('c:/Users/tswil/Downloads/Active Patient List- 2026.csv', 'utf-8');

console.log('Parsing CSV...');
const parseResult = parseRecallCsv(csv);
console.log(`Parsed: ${parseResult.records.length} records, ${parseResult.skipped} skipped, ${parseResult.errors.length} errors`);

if (parseResult.records.length === 0) {
  console.log('No records to import');
  process.exit(1);
}

// Process in batches of 100
const BATCH_SIZE = 100;
const totalRecords = parseResult.records;
let totalImported = 0;
let totalSkipped = 0;
let totalErrors = [];

const startTime = Date.now();

for (let i = 0; i < totalRecords.length; i += BATCH_SIZE) {
  const batch = totalRecords.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(totalRecords.length / BATCH_SIZE);

  console.log(`\nBatch ${batchNum}/${totalBatches} (records ${i + 1}-${i + batch.length})...`);

  try {
    const result = await ingestPatients(practiceId, batch);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalErrors.push(...result.errors);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (totalImported / (elapsed || 1)).toFixed(1);
    console.log(`  imported: ${result.imported}, skipped: ${result.skipped}, errors: ${result.errors.length}`);
    console.log(`  Running total: ${totalImported} imported, ${totalSkipped} skipped (${elapsed}s elapsed, ~${rate}/s)`);
  } catch (err) {
    console.error(`  Batch ${batchNum} failed:`, err.message);
    totalErrors.push(`Batch ${batchNum}: ${err.message}`);
  }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n' + '='.repeat(50));
console.log('IMPORT COMPLETE');
console.log('='.repeat(50));
console.log(`Time: ${totalTime}s`);
console.log(`Imported: ${totalImported}`);
console.log(`Skipped: ${totalSkipped}`);
console.log(`Errors: ${totalErrors.length}`);
if (totalErrors.length > 0) {
  console.log('\nFirst 10 errors:');
  totalErrors.slice(0, 10).forEach(e => console.log('  ' + e));
}

process.exit(0);

import { runSequenceOrchestrator } from '../src/services/recall/sequenceOrchestrator';
import 'dotenv/config';

const PRACTICE = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  console.log(`Firing orchestrator: practice=${PRACTICE} location="Village Dental"`);
  const start = Date.now();
  const result = await runSequenceOrchestrator(PRACTICE, { location: 'Village Dental' });
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n--- Orchestrator complete in ${secs}s ---`);
  console.log(JSON.stringify(result, null, 2));
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });

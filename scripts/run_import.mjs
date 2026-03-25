import { readFileSync } from 'fs';

const csv = readFileSync('c:/Users/tswil/Downloads/Active Patient List- 2026.csv', 'utf-8');
const practiceId = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

console.log(`Sending import request with ${csv.length} bytes of CSV data...`);
console.log(`Practice: ${practiceId}`);
console.log('');

const startTime = Date.now();

try {
  const res = await fetch('http://localhost:3000/api/recall/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ practiceId, csv }),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Response received in ${elapsed}s (status: ${res.status})`);
  console.log('');

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Request failed:', err.message);
}

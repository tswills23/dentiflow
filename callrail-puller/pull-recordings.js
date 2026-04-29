const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.CALLRAIL_API_KEY;
if (!API_KEY) throw new Error('CALLRAIL_API_KEY env var required');
const MIN_DURATION = 0;
const MAX_DURATION = 99999;
const MONTHS_BACK = 12;
const OUTPUT_DIR = './recordings';
const MAX_CALLS_PER_COMPANY = null;
const BUSINESS_HOURS_ONLY = false;
const BIZ_START_HOUR = 8;
const BIZ_END_HOUR = 18; // 6pm

const api = axios.create({
  baseURL: 'https://api.callrail.com/v3',
  headers: {
    'Authorization': `Token token="${API_KEY}"`,
    'Content-Type': 'application/json'
  }
});

const endDate = new Date().toISOString().split('T')[0];
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - MONTHS_BACK);
const startDateStr = startDate.toISOString().split('T')[0];

function isBusinessHours(startTime) {
  if (!BUSINESS_HOURS_ONLY) return true;
  const dt = new Date(startTime);
  // Convert to Central Time (UTC-5 or UTC-6 depending on DST)
  const central = new Date(dt.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const day = central.getDay(); // 0=Sun, 6=Sat
  const hour = central.getHours();
  return day >= 1 && day <= 5 && hour >= BIZ_START_HOUR && hour < BIZ_END_HOUR;
}

function loadExistingCallIds() {
  const ids = new Set();
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('.mp3')) {
        // filename format: 2026-03-23_205s_CAL019d1b1b70d07811be18f981b3d3a751.mp3
        const match = entry.name.match(/(CAL[a-f0-9]+)\.mp3$/);
        if (match) ids.add(match[1]);
      }
    }
  }
  scan(OUTPUT_DIR);
  return ids;
}

async function getAccount() {
  console.log('Fetching account info...');
  const res = await apiCallWithRetry(() => api.get('/a.json'), 'getAccount');
  const accounts = res.data.accounts || [res.data];
  if (accounts.length === 0) throw new Error('No accounts found');
  console.log(`Found account: ${accounts[0].name} (ID: ${accounts[0].id})`);
  return accounts[0];
}

async function getCompanies(accountId) {
  console.log('Fetching companies...');
  const res = await apiCallWithRetry(() => api.get(`/a/${accountId}/companies.json`), 'getCompanies');
  const companies = res.data.companies || [];
  console.log(`Found ${companies.length} companies:`);
  companies.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
  return companies;
}

async function apiCallWithRetry(fn, label, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response && err.response.status === 429 && attempt < maxRetries) {
        const waitMins = Math.min(10 * (attempt + 1), 62);
        console.log(`\n  *** Rate limited (429) on ${label}. Waiting ${waitMins} minutes... ***`);
        await new Promise(r => setTimeout(r, waitMins * 60 * 1000));
        console.log(`  *** Resuming after rate limit wait ***`);
        continue;
      }
      throw err;
    }
  }
}

async function getCallsForCompany(accountId, companyId, companyName) {
  console.log(`\nFetching calls for ${companyName}...`);
  let allCalls = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await apiCallWithRetry(
      () => api.get(`/a/${accountId}/calls.json`, {
        params: {
          company_id: companyId,
          start_date: startDateStr,
          end_date: endDate,
          per_page: 250,
          page: page,
          fields: 'duration,direction,recording,tracking_phone_number,source_name,start_time,customer_name,customer_phone_number',
          sorting: 'duration',
          order: 'desc'
        }
      }),
      `calls page ${page} for ${companyName}`
    );

    const calls = res.data.calls || [];
    totalPages = res.data.total_pages || 1;

    const filtered = calls.filter(c =>
      c.direction === 'inbound' &&
      c.duration >= MIN_DURATION &&
      c.duration <= MAX_DURATION &&
      isBusinessHours(c.start_time)
    );

    allCalls = allCalls.concat(filtered);
    console.log(`  Page ${page}/${totalPages} - Found ${filtered.length} qualifying calls (${allCalls.length} total)`);

    if (MAX_CALLS_PER_COMPANY && allCalls.length >= MAX_CALLS_PER_COMPANY) {
      allCalls = allCalls.slice(0, MAX_CALLS_PER_COMPANY);
      break;
    }

    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`  Total qualifying calls for ${companyName}: ${allCalls.length}`);
  return allCalls;
}

async function getRecordingUrl(accountId, callId) {
  try {
    const res = await apiCallWithRetry(
      () => api.get(`/a/${accountId}/calls/${callId}/recording.json`),
      `recording ${callId}`
    );
    return res.data.url || null;
  } catch (err) {
    if (!err.response || err.response.status !== 429) {
      // Non-rate-limit error — just skip this recording
    }
    return null;
  }
}

async function downloadMp3(url, filepath) {
  const response = await axios({ method: 'GET', url: url, responseType: 'stream' });
  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function sanitizeFolderName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '_');
}

async function main() {
  console.log('=== CallRail Recording Puller (FULL — No Filters) ===\n');
  console.log(`Date range: ${startDateStr} to ${endDate}`);
  console.log(`Duration filter: ${MIN_DURATION}s - ${MAX_DURATION}s`);
  console.log(`Business hours filter: ${BUSINESS_HOURS_ONLY ? 'ON' : 'OFF'}`);
  console.log(`Max calls per company: ${MAX_CALLS_PER_COMPANY || 'ALL'}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existingIds = loadExistingCallIds();
  console.log(`Found ${existingIds.size} existing recordings to skip.\n`);

  const account = await getAccount();
  const companies = await getCompanies(account.id);
  if (companies.length === 0) { console.error('No companies found.'); process.exit(1); }

  const csvRows = ['company,call_id,date,start_time,duration_seconds,caller_name,caller_phone,source,tracking_number,has_recording,mp3_file'];
  let totalDownloaded = 0;
  let totalSkippedExisting = 0;
  let totalNoRecording = 0;
  let totalCalls = 0;

  for (const company of companies) {
    const folderName = sanitizeFolderName(company.name);
    const companyDir = path.join(OUTPUT_DIR, folderName);
    if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });

    const calls = await getCallsForCompany(account.id, company.id, company.name);
    totalCalls += calls.length;
    let companyDownloads = 0;
    let companyNoRec = 0;
    let companySkipped = 0;

    console.log(`\nProcessing ${calls.length} calls for ${company.name}...`);

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const callDate = new Date(call.start_time).toISOString().split('T')[0];
      const hasRecording = !!call.recording;
      const filename = hasRecording ? `${callDate}_${call.duration}s_${call.id}.mp3` : '';

      // Write ALL calls to metadata CSV
      csvRows.push([
        `"${company.name}"`,
        call.id,
        callDate,
        `"${call.start_time}"`,
        call.duration,
        `"${(call.customer_name || 'Unknown').replace(/"/g, '""')}"`,
        `"${call.customer_phone_number || ''}"`,
        `"${(call.source_name || '').replace(/"/g, '""')}"`,
        `"${call.tracking_phone_number || ''}"`,
        hasRecording,
        `"${filename}"`
      ].join(','));

      // Skip download if no recording available
      if (!hasRecording) { companyNoRec++; totalNoRecording++; continue; }

      // Skip if already downloaded
      if (existingIds.has(call.id)) { companySkipped++; totalSkippedExisting++; continue; }

      const filepath = path.join(companyDir, filename);
      if (fs.existsSync(filepath)) { companySkipped++; totalSkippedExisting++; continue; }

      const recordingUrl = await getRecordingUrl(account.id, call.id);
      if (!recordingUrl) continue;

      try {
        await downloadMp3(recordingUrl, filepath);
        totalDownloaded++;
        companyDownloads++;
        if (companyDownloads <= 5 || companyDownloads % 50 === 0) {
          console.log(`  [${companyDownloads} new] Downloaded: ${filename}`);
        }
      } catch (err) {
        console.log(`  FAILED: ${filename} - ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`  ${company.name}: ${calls.length} total | ${companyDownloads} downloaded | ${companySkipped} skipped | ${companyNoRec} no recording`);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'call_metadata.csv'), csvRows.join('\n'));
  console.log(`\n=== COMPLETE ===`);
  console.log(`Total inbound calls: ${totalCalls}`);
  console.log(`With recording: ${totalCalls - totalNoRecording}`);
  console.log(`Without recording: ${totalNoRecording}`);
  console.log(`New recordings downloaded: ${totalDownloaded}`);
  console.log(`Skipped (already had MP3): ${totalSkippedExisting}`);
  console.log(`Metadata CSV: ${OUTPUT_DIR}/call_metadata.csv`);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  if (err.response) {
    console.error('Status:', err.response.status);
    console.error('Data:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});

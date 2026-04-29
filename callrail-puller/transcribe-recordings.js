const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY env var required');
const RECORDINGS_DIR = './recordings';
const OUTPUT_CSV = './recordings/transcripts_master_full.csv';
const CONCURRENT_LIMIT = 10;
const RETRY_LIMIT = 5;

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

function getAllMp3Files(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllMp3Files(fullPath));
    } else if (entry.name.endsWith('.mp3')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function transcribeFile(mp3Path, index, total) {
  const filename = path.basename(mp3Path);
  const company = path.basename(path.dirname(mp3Path));
  const txtPath = mp3Path.replace('.mp3', '.txt');

  // Skip if already transcribed
  if (fs.existsSync(txtPath)) {
    const existing = fs.readFileSync(txtPath, 'utf-8');
    if (!existing.startsWith('TRANSCRIPTION_FAILED')) {
      console.log(`  [${index}/${total}] Skipping (exists): ${filename}`);
      return { company, filename, transcript: existing, skipped: true };
    }
  }

  let attempts = 0;
  while (attempts <= RETRY_LIMIT) {
    try {
      const response = await client.audio.transcriptions.create({
        file: fs.createReadStream(mp3Path),
        model: 'whisper-1',
        response_format: 'verbose_json',
        prompt: 'This is a dental office phone call. Speakers include a receptionist and a caller/patient.'
      });

      const transcript = response.text;
      fs.writeFileSync(txtPath, transcript);
      console.log(`  [${index}/${total}] Transcribed: ${filename} (${transcript.length} chars)`);
      return { company, filename, transcript, skipped: false };

    } catch (err) {
      attempts++;
      if (err.status === 429) {
        const wait = Math.pow(2, attempts) * 5000;
        console.log(`  [${index}/${total}] Rate limited on ${filename}, waiting ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
      } else if (attempts > RETRY_LIMIT) {
        console.log(`  [${index}/${total}] FAILED: ${filename} - ${err.message}`);
        fs.writeFileSync(txtPath, `TRANSCRIPTION_FAILED: ${err.message}`);
        return { company, filename, transcript: `FAILED: ${err.message}`, skipped: false };
      } else {
        const wait = 3000;
        console.log(`  [${index}/${total}] Error on ${filename}, retrying in ${wait/1000}s... (${err.message})`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
}

async function processInBatches(files, batchSize) {
  const results = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((file, j) => transcribeFile(file, i + j + 1, files.length))
    );
    results.push(...batchResults);

    // Pause between batches to avoid rate limits
    if (i + batchSize < files.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return results;
}

async function main() {
  console.log('=== CallRail Recording Transcriber (Whisper) ===\n');

  const mp3Files = getAllMp3Files(RECORDINGS_DIR);
  console.log(`Found ${mp3Files.length} MP3 files to transcribe.\n`);

  if (mp3Files.length === 0) {
    console.error('No MP3 files found in recordings directory.');
    process.exit(1);
  }

  const results = await processInBatches(mp3Files, CONCURRENT_LIMIT);

  // Build master CSV
  const csvHeader = 'company,filename,transcript';
  const csvRows = results.map(r => {
    const cleanTranscript = r.transcript.replace(/"/g, '""').replace(/\n/g, ' | ');
    return `"${r.company}","${r.filename}","${cleanTranscript}"`;
  });

  fs.writeFileSync(OUTPUT_CSV, [csvHeader, ...csvRows].join('\n'));

  const transcribed = results.filter(r => !r.skipped && !r.transcript.startsWith('FAILED'));
  const skipped = results.filter(r => r.skipped);
  const failed = results.filter(r => r.transcript.startsWith('FAILED'));

  console.log(`\n=== COMPLETE ===`);
  console.log(`Transcribed: ${transcribed.length}`);
  console.log(`Skipped (already done): ${skipped.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Master CSV: ${OUTPUT_CSV}`);
  console.log(`\nIndividual .txt files saved next to each .mp3`);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});

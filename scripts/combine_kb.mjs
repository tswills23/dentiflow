/**
 * Combine 7 KB docs into 1 unified file for Retell AI upload.
 * Strips metadata headers, TOCs, and trailing attribution lines.
 * Downgrades headers by one level.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = resolve(__dirname, '../callrail-puller/recordings/kb-docs');

const docs = [
  { file: '01-practice-information.md', section: '1. Practice Information' },
  { file: '02-scheduling-protocols.md', section: '2. Scheduling Protocols' },
  { file: '03-insurance-billing-faq.md', section: '3. Insurance & Billing FAQ' },
  { file: '04-emergency-triage.md', section: '4. Emergency Triage' },
  { file: '06-service-menu.md', section: '5. Service Menu' },
  { file: '05-edge-cases-objections.md', section: '6. Edge Cases & Objections' },
  { file: '07-tone-personality.md', section: '7. Tone & Personality' },
];

function processDoc(content, sectionTitle) {
  let lines = content.split('\n');

  // Remove leading metadata block (# title, > source lines, ---)
  let startIdx = 0;
  // Skip blank lines at start
  while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
  // Skip # title line
  if (startIdx < lines.length && lines[startIdx].startsWith('# ')) startIdx++;
  // Skip blank lines
  while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
  // Skip > metadata lines
  while (startIdx < lines.length && lines[startIdx].trim().startsWith('>')) startIdx++;
  // Skip blank lines and --- separators
  while (startIdx < lines.length && (lines[startIdx].trim() === '' || lines[startIdx].trim() === '---')) startIdx++;
  // Skip Table of Contents section if present (with or without header)
  if (startIdx < lines.length && lines[startIdx].includes('Table of Contents')) {
    startIdx++; // skip the TOC header
    while (startIdx < lines.length && lines[startIdx].trim() !== '' && !lines[startIdx].startsWith('## ') && !lines[startIdx].startsWith('---')) {
      startIdx++;
    }
    // Skip trailing blank lines and ---
    while (startIdx < lines.length && (lines[startIdx].trim() === '' || lines[startIdx].trim() === '---')) startIdx++;
  }
  // Also skip numbered anchor-link lists (e.g., "1. [Cottage Dental Care](#cottage-dental-care)")
  while (startIdx < lines.length && /^\d+\.\s+\[.+\]\(#/.test(lines[startIdx].trim())) {
    startIdx++;
  }
  // Skip trailing blank lines and ---
  while (startIdx < lines.length && (lines[startIdx].trim() === '' || lines[startIdx].trim() === '---')) startIdx++;

  // Remove trailing attribution
  let endIdx = lines.length - 1;
  while (endIdx > 0 && lines[endIdx].trim() === '') endIdx--;
  if (endIdx > 0 && (lines[endIdx].trim().startsWith('*Document') || lines[endIdx].trim().startsWith('*document'))) {
    endIdx--;
  }
  while (endIdx > 0 && lines[endIdx].trim() === '') endIdx--;

  lines = lines.slice(startIdx, endIdx + 1);

  // Downgrade headers: ## -> ###, ### -> ####, etc.
  lines = lines.map(line => {
    if (line.startsWith('######')) return '#######' + line.slice(6);
    if (line.startsWith('#####')) return '######' + line.slice(5);
    if (line.startsWith('####')) return '#####' + line.slice(4);
    if (line.startsWith('###')) return '####' + line.slice(3);
    if (line.startsWith('## ')) return '### ' + line.slice(3);
    return line;
  });

  // Add section header
  return `## ${sectionTitle}\n\n${lines.join('\n')}`;
}

// Build combined document
const parts = [
  `# 32 Family Dental — Voice Agent Knowledge Base`,
  ``,
  `> Compiled from 1,756 real patient call transcripts across Cottage Dental Care (Bloomington IL), Western Springs Dentistry, and Village Dental. Use this knowledge base to answer patient questions accurately.`,
  ``,
];

for (const doc of docs) {
  const content = readFileSync(resolve(KB_DIR, doc.file), 'utf-8');
  parts.push(processDoc(content, doc.section));
  parts.push(''); // blank line between sections
}

const output = parts.join('\n');
const outPath = resolve(KB_DIR, 'retell-knowledge-base.md');
writeFileSync(outPath, output, 'utf-8');

const lineCount = output.split('\n').length;
const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
console.log(`Combined KB written to: ${outPath}`);
console.log(`Lines: ${lineCount} | Size: ${sizeKB} KB`);

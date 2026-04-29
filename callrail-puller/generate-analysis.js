const fs = require('fs');
const path = require('path');

const METADATA_CSV = './recordings/call_metadata.csv';
const CLASSIFIED_CSV = './recordings/classified_calls.csv';
const OUTPUT_FILE = './recordings/full_dataset_analysis.md';

function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || (char === '\r' && content[i + 1] === '\n')) && !inQuotes) {
      if (char === '\r') i++; // skip \n in \r\n
      rows.push(current);
      current = '';
    } else if (char !== '\r') {
      current += char;
    }
  }
  if (current.trim()) rows.push(current);

  const header = parseRow(rows[0]);
  return rows.slice(1).map(row => {
    const fields = parseRow(row);
    const obj = {};
    header.forEach((h, idx) => obj[h.replace(/"/g, '').trim()] = (fields[idx] || '').trim());
    return obj;
  });
}

function parseRow(row) {
  const fields = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (inQ && row[i + 1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function getTimeSlot(startTime) {
  try {
    const dt = new Date(startTime);
    const central = new Date(dt.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const hour = central.getHours();
    if (hour < 8) return 'Before 8am';
    if (hour < 12) return '8am-12pm';
    if (hour < 17) return '12pm-5pm';
    return 'After 5pm';
  } catch { return 'Unknown'; }
}

function getDayOfWeek(startTime) {
  try {
    const dt = new Date(startTime);
    const central = new Date(dt.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][central.getDay()];
  } catch { return 'Unknown'; }
}

function extractCallId(filename) {
  const match = filename.match(/(CAL[a-f0-9]+)\.(mp3|txt)$/);
  return match ? match[1] : null;
}

function main() {
  console.log('=== Full Dataset Analysis Generator ===\n');

  // Load metadata
  const metadata = parseCSV(METADATA_CSV);
  console.log(`Loaded ${metadata.length} calls from metadata.`);

  // Load classifications
  const classified = parseCSV(CLASSIFIED_CSV);
  console.log(`Loaded ${classified.length} classified calls.`);

  // Build classification lookup by filename
  const classMap = {};
  classified.forEach(c => { classMap[c.filename] = c; });

  // ===== SECTION 1: Total calls pulled =====
  const totalCalls = metadata.length;

  // ===== SECTION 2: Recordings vs no recording =====
  const withRecording = metadata.filter(m => m.has_recording === 'true').length;
  const withoutRecording = metadata.filter(m => m.has_recording !== 'true').length;

  // ===== SECTION 3: Voicemail vs real conversation =====
  // Join metadata with classifications for voicemail analysis
  const classifiedWithMeta = [];
  metadata.forEach(m => {
    if (m.mp3_file && classMap[m.mp3_file]) {
      classifiedWithMeta.push({ ...m, ...classMap[m.mp3_file] });
    }
  });

  const totalClassified = classifiedWithMeta.length;
  const voicemails = classifiedWithMeta.filter(c => c.primary_intent === 'VOICEMAIL_ONLY');
  const realConversations = classifiedWithMeta.filter(c => c.primary_intent !== 'VOICEMAIL_ONLY' && c.primary_intent !== 'CLASSIFICATION_FAILED');
  const classificationFailed = classifiedWithMeta.filter(c => c.primary_intent === 'CLASSIFICATION_FAILED');

  // ===== SECTION 4: Voicemail by company =====
  const companiesSet = [...new Set(classifiedWithMeta.map(c => c.company))];
  const vmByCompany = {};
  companiesSet.forEach(company => {
    const compCalls = classifiedWithMeta.filter(c => c.company === company);
    const compVm = compCalls.filter(c => c.primary_intent === 'VOICEMAIL_ONLY');
    vmByCompany[company] = { total: compCalls.length, vm: compVm.length, rate: compCalls.length > 0 ? (compVm.length / compCalls.length * 100).toFixed(1) : '0' };
  });

  // ===== SECTION 5: Voicemail by time of day =====
  const timeSlots = ['Before 8am', '8am-12pm', '12pm-5pm', 'After 5pm'];
  const vmByTime = {};
  timeSlots.forEach(slot => vmByTime[slot] = { total: 0, vm: 0 });
  classifiedWithMeta.forEach(c => {
    const slot = getTimeSlot(c.start_time);
    if (vmByTime[slot]) {
      vmByTime[slot].total++;
      if (c.primary_intent === 'VOICEMAIL_ONLY') vmByTime[slot].vm++;
    }
  });

  // ===== SECTION 6: Voicemail by day of week =====
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const vmByDay = {};
  days.forEach(d => vmByDay[d] = { total: 0, vm: 0 });
  classifiedWithMeta.forEach(c => {
    const day = getDayOfWeek(c.start_time);
    if (vmByDay[day]) {
      vmByDay[day].total++;
      if (c.primary_intent === 'VOICEMAIL_ONLY') vmByDay[day].vm++;
    }
  });

  // ===== SECTION 7: Intent distribution (real conversations only) =====
  const intentCounts = {};
  realConversations.forEach(c => {
    intentCounts[c.primary_intent] = (intentCounts[c.primary_intent] || 0) + 1;
  });
  const sortedIntents = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);

  // ===== SECTION 8: AI readiness (real conversations only) =====
  const aiCounts = {};
  realConversations.forEach(c => {
    aiCounts[c.would_ai_handle] = (aiCounts[c.would_ai_handle] || 0) + 1;
  });

  // ===== SECTION 9: Resolution distribution (real conversations only) =====
  const resCounts = {};
  realConversations.forEach(c => {
    resCounts[c.resolution] = (resCounts[c.resolution] || 0) + 1;
  });
  const sortedRes = Object.entries(resCounts).sort((a, b) => b[1] - a[1]);

  // ===== SECTION 10: Receptionist struggled =====
  const struggled = realConversations.filter(c => c.receptionist_struggled_with && c.receptionist_struggled_with !== 'NONE' && c.receptionist_struggled_with.trim() !== '');

  // ===== SECTION 11: Unique flow gap notes =====
  const gapNotes = new Set();
  classifiedWithMeta.forEach(c => {
    if (c.flow_gap_notes && c.flow_gap_notes !== 'NONE' && c.flow_gap_notes.trim() !== '') {
      gapNotes.add(c.flow_gap_notes.trim());
    }
  });

  // ===== BUILD REPORT =====
  let md = `# Full Dataset Analysis\n`;
  md += `*Generated: ${new Date().toISOString().split('T')[0]}*\n\n`;
  md += `---\n\n`;

  // 1. Total calls
  md += `## 1. Total Calls Pulled\n\n`;
  md += `**${totalCalls.toLocaleString()} inbound calls** across ${companiesSet.length} companies (past 12 months)\n\n`;

  // 2. Recordings
  md += `## 2. Recordings\n\n`;
  md += `| Metric | Count | % |\n`;
  md += `|--------|-------|---|\n`;
  md += `| With recording | ${withRecording.toLocaleString()} | ${(withRecording/totalCalls*100).toFixed(1)}% |\n`;
  md += `| No recording | ${withoutRecording.toLocaleString()} | ${(withoutRecording/totalCalls*100).toFixed(1)}% |\n`;
  md += `| **Total** | **${totalCalls.toLocaleString()}** | **100%** |\n\n`;

  // 3. Voicemail vs real
  md += `## 3. Voicemail vs Real Conversation\n\n`;
  md += `*Based on ${totalClassified.toLocaleString()} classified calls (those with recordings + transcripts)*\n\n`;
  md += `| Type | Count | % |\n`;
  md += `|------|-------|---|\n`;
  md += `| Voicemail | ${voicemails.length.toLocaleString()} | ${(voicemails.length/totalClassified*100).toFixed(1)}% |\n`;
  md += `| Real conversation | ${realConversations.length.toLocaleString()} | ${(realConversations.length/totalClassified*100).toFixed(1)}% |\n`;
  md += `| Classification failed | ${classificationFailed.length.toLocaleString()} | ${(classificationFailed.length/totalClassified*100).toFixed(1)}% |\n\n`;

  // 4. Voicemail by company
  md += `## 4. Voicemail Rate by Company\n\n`;
  md += `| Company | Total Calls | Voicemails | VM Rate |\n`;
  md += `|---------|-------------|------------|--------|\n`;
  Object.entries(vmByCompany).sort((a, b) => b[1].total - a[1].total).forEach(([company, data]) => {
    md += `| ${company} | ${data.total.toLocaleString()} | ${data.vm.toLocaleString()} | ${data.rate}% |\n`;
  });
  md += `\n`;

  // 5. Voicemail by time of day
  md += `## 5. Voicemail Rate by Time of Day\n\n`;
  md += `| Time Slot | Total Calls | Voicemails | VM Rate |\n`;
  md += `|-----------|-------------|------------|--------|\n`;
  timeSlots.forEach(slot => {
    const d = vmByTime[slot];
    const rate = d.total > 0 ? (d.vm/d.total*100).toFixed(1) : '0.0';
    md += `| ${slot} | ${d.total.toLocaleString()} | ${d.vm.toLocaleString()} | ${rate}% |\n`;
  });
  md += `\n`;

  // 6. Voicemail by day of week
  md += `## 6. Voicemail Rate by Day of Week\n\n`;
  md += `| Day | Total Calls | Voicemails | VM Rate |\n`;
  md += `|-----|-------------|------------|--------|\n`;
  days.forEach(day => {
    const d = vmByDay[day];
    const rate = d.total > 0 ? (d.vm/d.total*100).toFixed(1) : '0.0';
    md += `| ${day} | ${d.total.toLocaleString()} | ${d.vm.toLocaleString()} | ${rate}% |\n`;
  });
  md += `\n`;

  // 7. Intent distribution (real conversations only)
  md += `## 7. Intent Distribution (Real Conversations Only)\n\n`;
  md += `*Excludes voicemail and classification failures — ${realConversations.length} calls*\n\n`;
  md += `| Intent | Count | % |\n`;
  md += `|--------|-------|---|\n`;
  sortedIntents.forEach(([intent, count]) => {
    md += `| ${intent} | ${count} | ${(count/realConversations.length*100).toFixed(1)}% |\n`;
  });
  md += `\n`;

  // 8. AI readiness (real conversations only)
  md += `## 8. AI Readiness (Real Conversations Only)\n\n`;
  md += `| Rating | Count | % |\n`;
  md += `|--------|-------|---|\n`;
  Object.entries(aiCounts).sort((a, b) => b[1] - a[1]).forEach(([rating, count]) => {
    md += `| ${rating} | ${count} | ${(count/realConversations.length*100).toFixed(1)}% |\n`;
  });
  md += `\n`;

  // 9. Resolution distribution (real conversations only)
  md += `## 9. Resolution Distribution (Real Conversations Only)\n\n`;
  md += `| Resolution | Count | % |\n`;
  md += `|------------|-------|---|\n`;
  sortedRes.forEach(([res, count]) => {
    md += `| ${res} | ${count} | ${(count/realConversations.length*100).toFixed(1)}% |\n`;
  });
  md += `\n`;

  // 10. Receptionist struggled
  md += `## 10. Receptionist Struggled\n\n`;
  md += `**${struggled.length} calls** where receptionist_struggled_with is not "NONE"\n\n`;
  if (struggled.length > 0) {
    md += `| Company | Filename | Struggled With |\n`;
    md += `|---------|----------|----------------|\n`;
    struggled.forEach(c => {
      md += `| ${c.company} | ${c.filename} | ${c.receptionist_struggled_with.replace(/\|/g, '/')} |\n`;
    });
  }
  md += `\n`;

  // 11. Flow gap notes
  md += `## 11. Unique Flow Gap Notes\n\n`;
  md += `**${gapNotes.size} unique gaps identified**\n\n`;
  const sortedGaps = [...gapNotes].sort();
  sortedGaps.forEach((gap, i) => {
    md += `${i + 1}. ${gap}\n`;
  });
  md += `\n`;

  // Write output
  fs.writeFileSync(OUTPUT_FILE, md);
  console.log(`\n=== COMPLETE ===`);
  console.log(`Analysis saved to: ${OUTPUT_FILE}`);
  console.log(`\nQuick summary:`);
  console.log(`  Total calls: ${totalCalls}`);
  console.log(`  With recording: ${withRecording} | Without: ${withoutRecording}`);
  console.log(`  Voicemails: ${voicemails.length} (${(voicemails.length/totalClassified*100).toFixed(1)}%)`);
  console.log(`  Real conversations: ${realConversations.length}`);
  console.log(`  Receptionist struggled: ${struggled.length}`);
  console.log(`  Unique flow gaps: ${gapNotes.size}`);
}

main();

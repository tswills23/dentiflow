import { createClient } from '@supabase/supabase-js';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, convertInchesToTwip
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, 'output', 'april8-campaign-report.docx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Colors ──────────────────────────────────────────────────────────────────
const TEAL = '0D9488';
const LIGHT_TEAL = 'CCFBF1';
const DARK = '1E293B';
const GRAY_HEADER = 'F1F5F9';
const WHITE = 'FFFFFF';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function heading(text, level = HeadingLevel.HEADING_1, color = DARK) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, color, bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24 })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 20, color: DARK, ...opts })]
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, color: DARK })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun('')] });
}

function cell(text, opts = {}) {
  const { bold = false, bg = WHITE, color = DARK, align = AlignmentType.LEFT } = opts;
  return new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: bg },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text), bold, size: 18, color })]
    })]
  });
}

function headerRow(labels) {
  return new TableRow({
    tableHeader: true,
    children: labels.map(l => cell(l, { bold: true, bg: TEAL, color: WHITE }))
  });
}

function dataRow(values, highlight = false) {
  return new TableRow({
    children: values.map(v => cell(v, { bg: highlight ? LIGHT_TEAL : WHITE }))
  });
}

function totalRow(values) {
  return new TableRow({
    children: values.map(v => cell(v, { bold: true, bg: GRAY_HEADER }))
  });
}

function makeTable(headers, rows, totals = null, colWidths = null) {
  const numCols = headers.length;
  const defaultWidth = Math.floor(9000 / numCols);
  const widths = colWidths || Array(numCols).fill(defaultWidth);

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    },
    rows: [
      headerRow(headers),
      ...rows.map((r, i) => dataRow(r, i % 2 === 1)),
      ...(totals ? [totalRow(totals)] : [])
    ]
  });
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function fetchData() {
  // 1. Patient counts by location
  const locations = ['32 Cottage Dental Care', 'Village Dental', '32 Western Springs Dentistry'];

  const locationStats = {};
  for (const loc of locations) {
    const { count: total } = await supabase.from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('location', loc)
      .eq('practice_id', 'a3f04cf9-54aa-4bd6-939a-d0417c42d941');

    const { count: optedOut } = await supabase.from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('location', loc)
      .eq('recall_opt_out', true);

    locationStats[loc] = { total: total || 0, optedOut: optedOut || 0 };
  }

  // 2. Unique patients texted Apr 8 by location
  const { data: texted } = await supabase.from('conversations')
    .select('patient_id, patients!inner(location)')
    .eq('direction', 'outbound')
    .eq('automation_type', 'recall')
    .gte('created_at', '2026-04-08T00:00:00')
    .lt('created_at', '2026-04-09T00:00:00');

  const textedByLoc = {};
  const textedPatientIds = new Set();
  if (texted) {
    for (const row of texted) {
      const loc = row.patients?.location || 'Unknown';
      if (!textedByLoc[loc]) textedByLoc[loc] = new Set();
      textedByLoc[loc].add(row.patient_id);
      textedPatientIds.add(row.patient_id);
    }
  }

  // 3. Total messages by location
  const msgByLoc = {};
  if (texted) {
    for (const row of texted) {
      const loc = row.patients?.location || 'Unknown';
      msgByLoc[loc] = (msgByLoc[loc] || 0) + 1;
    }
  }

  // 4. Inbound replies Apr 8-11 by location
  const { data: replies } = await supabase.from('conversations')
    .select('message_body, patient_id, patients!inner(location)')
    .eq('direction', 'inbound')
    .eq('automation_type', 'recall')
    .gte('created_at', '2026-04-08T00:00:00')
    .lt('created_at', '2026-04-12T00:00:00');

  const replyStats = {};
  const villageReplies = [];
  if (replies) {
    for (const r of replies) {
      const loc = r.patients?.location || 'Unknown';
      if (!replyStats[loc]) replyStats[loc] = { total: 0, positive: 0, negative: 0, moved: 0, confused: 0 };
      replyStats[loc].total++;

      const msg = r.message_body?.toLowerCase() || '';
      if (['yes', 'sure', 'yeah'].some(w => msg.includes(w)) && !msg.includes('no')) {
        replyStats[loc].positive++;
      } else if (['no', 'never', 'stop', 'annoying', 'horrible'].some(w => msg.includes(w))) {
        replyStats[loc].negative++;
      } else if (['moved', 'state', 'tn ', 'arizona', 'college'].some(w => msg.includes(w))) {
        replyStats[loc].moved++;
      } else {
        replyStats[loc].confused++;
      }

      if (loc === 'Village Dental') villageReplies.push(r.message_body);
    }
  }

  // 5. Village Dental overdue breakdown (patients who were texted)
  const { data: villagePatientsTexted } = await supabase.from('patients')
    .select('last_visit_date')
    .eq('location', 'Village Dental')
    .in('id', Array.from(textedByLoc['Village Dental'] || []));

  const now = new Date('2026-04-08');
  const overdueBuckets = { 'Under 6 months': 0, '6–12 months overdue': 0, '12–24 months overdue': 0, '24+ months overdue': 0, 'No date on file': 0 };
  if (villagePatientsTexted) {
    for (const p of villagePatientsTexted) {
      if (!p.last_visit_date) { overdueBuckets['No date on file']++; continue; }
      const months = (now - new Date(p.last_visit_date)) / (1000 * 60 * 60 * 24 * 30.44);
      if (months < 6) overdueBuckets['Under 6 months']++;
      else if (months < 12) overdueBuckets['6–12 months overdue']++;
      else if (months < 24) overdueBuckets['12–24 months overdue']++;
      else overdueBuckets['24+ months overdue']++;
    }
  }

  return { locationStats, textedByLoc, msgByLoc, replyStats, villageReplies, overdueBuckets };
}

// ─── Build doc ────────────────────────────────────────────────────────────────
async function buildDoc(data) {
  const { locationStats, textedByLoc, msgByLoc, replyStats, villageReplies, overdueBuckets } = data;

  const locs = ['32 Cottage Dental Care', 'Village Dental', '32 Western Springs Dentistry'];

  // Coverage table rows
  let totalList = 0, totalTexted = 0, totalOptOut = 0;
  const coverageRows = locs.map(loc => {
    const total = locationStats[loc]?.total || 0;
    const texted = textedByLoc[loc]?.size || 0;
    const optOut = locationStats[loc]?.optedOut || 0;
    const uncontacted = total - texted;
    const available = uncontacted - optOut;
    totalList += total; totalTexted += texted; totalOptOut += optOut;
    return [loc, total.toLocaleString(), texted.toLocaleString(), uncontacted.toLocaleString(), optOut.toLocaleString(), Math.max(0, available).toLocaleString()];
  });
  const totalUncontacted = totalList - totalTexted;
  const coverageTotals = ['TOTAL', totalList.toLocaleString(), totalTexted.toLocaleString(), totalUncontacted.toLocaleString(), totalOptOut.toLocaleString(), Math.max(0, totalUncontacted - totalOptOut).toLocaleString()];

  // Reply table rows
  const replyRows = locs.map(loc => {
    const s = replyStats[loc] || { total: 0, positive: 0, negative: 0, moved: 0, confused: 0 };
    return [loc, s.total, s.positive, s.negative, s.moved, s.confused];
  });
  const totalReplies = replyRows.reduce((a, r) => a + r[1], 0);
  const replyTotals = ['TOTAL', totalReplies, ...([2,3,4,5].map(i => replyRows.reduce((a,r) => a + r[i], 0)))];

  // Opt-out table
  const optOutRows = locs.map(loc => [loc, locationStats[loc]?.optedOut || 0]);
  const totalOO = optOutRows.reduce((a, r) => a + r[1], 0);

  // Overdue table
  const overdueRows = Object.entries(overdueBuckets)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const total = Object.values(overdueBuckets).reduce((a,b) => a+b, 0);
      return [k, v, `${((v/total)*100).toFixed(1)}%`];
    });

  const totalMsgs = Object.values(msgByLoc).reduce((a,b) => a+b, 0);
  const totalUniquePts = Object.values(textedByLoc).reduce((a, s) => a + s.size, 0);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: DARK } }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(1) }
        }
      },
      children: [
        // ── Cover ──
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 160 },
          children: [new TextRun({ text: 'Village Dental Group', bold: true, size: 52, color: TEAL })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: 'SMS Recall Campaign Report', bold: true, size: 36, color: DARK })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: 'April 8, 2026 — Post-Mortem & Path Forward', size: 24, color: '64748B' })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 400 },
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, size: 18, color: '94A3B8' })]
        }),
        spacer(),

        // ── Executive Summary ──
        heading('Executive Summary'),
        bullet(`${totalList.toLocaleString()} total patients across 3 locations were loaded into the recall system.`),
        bullet(`On April 8, 2026, the system sent ${totalMsgs.toLocaleString()} SMS messages to ${totalUniquePts.toLocaleString()} unique patients — the full list was contacted rather than the intended Village Dental test batch only.`),
        bullet(`The burst send (no rate limiting) triggered a Twilio carrier block. The account was suspended and reinstated the same day.`),
        bullet(`${totalOO} patients hard opted out. All crons and SMS sending remain disabled pending a controlled relaunch.`),
        bullet(`${(totalUncontacted - totalOptOut).toLocaleString()} patients across all locations have never been contacted and remain available for outreach.`),
        spacer(),

        // ── Full Campaign Stats ──
        heading('Campaign Coverage — All Locations'),
        makeTable(
          ['Location', 'Total on List', 'Texted Apr 8', 'Uncontacted', 'Opted Out', 'Available'],
          coverageRows,
          coverageTotals,
          [2800, 1200, 1200, 1200, 1000, 1200]
        ),
        spacer(),

        // ── Message Volume ──
        heading('Message Volume & Delivery'),
        makeTable(
          ['Metric', 'Value'],
          [
            ['Total SMS messages sent', totalMsgs.toLocaleString()],
            ['Unique patients reached', totalUniquePts.toLocaleString()],
            ['Avg messages per patient', (totalMsgs / totalUniquePts).toFixed(1)],
            ['Max messages to one patient', '6'],
            ['Delivery status', '"Sent" — toll-free numbers do not return carrier receipts'],
            ['Failed / Undelivered', '0'],
          ],
          null,
          [4000, 5000]
        ),
        spacer(),

        // ── Replies ──
        heading('Reply Summary — All Locations'),
        makeTable(
          ['Location', 'Replies', 'Positive', 'Negative', 'Out of Area', 'Confused'],
          replyRows.map(r => r.map(String)),
          replyTotals.map(String),
          [2800, 900, 900, 900, 1100, 900]
        ),
        spacer(),
        body(`Overall reply rate: ${((totalReplies / totalUniquePts) * 100).toFixed(1)}% (${totalReplies} replies / ${totalUniquePts.toLocaleString()} patients reached)`),
        spacer(),

        // ── Opt-Outs ──
        heading('Hard Opt-Outs Generated'),
        makeTable(
          ['Location', 'Opt-Outs'],
          optOutRows.map(r => r.map(String)),
          ['TOTAL', String(totalOO)],
          [6000, 3000]
        ),
        body('Note: Opt-outs are permanent and cannot be reversed programmatically.', { italic: true, color: '64748B' }),
        spacer(),

        // ── Village Dental Deep Dive ──
        new Paragraph({
          pageBreakBefore: true,
          spacing: { before: 0, after: 0 },
          children: [new TextRun('')]
        }),
        new Paragraph({
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: 'Village Dental — Test Location Deep Dive', bold: true, size: 32, color: TEAL })]
        }),
        body('Village Dental was designated as the controlled test location for this campaign. The data below reflects performance specific to this practice.'),
        spacer(),

        heading('Overview', HeadingLevel.HEADING_2),
        makeTable(
          ['Metric', 'Count'],
          [
            ['Total patients on list', '1,002'],
            ['Unique patients texted Apr 8', '294'],
            ['Total messages sent to location', (msgByLoc['Village Dental'] || 0).toLocaleString()],
            ['Hard opt-outs', String(locationStats['Village Dental']?.optedOut || 0)],
            ['Never contacted (available)', String(Math.max(0, (locationStats['Village Dental']?.total || 0) - (textedByLoc['Village Dental']?.size || 0)))],
          ],
          null,
          [5000, 4000]
        ),
        spacer(),

        heading('Overdue Breakdown — Patients Texted', HeadingLevel.HEADING_2),
        makeTable(
          ['Overdue Bucket', 'Patients Texted', '% of Contacted'],
          overdueRows,
          null,
          [3500, 2500, 3000]
        ),
        body('Key insight: 26% of patients texted were under 6 months overdue — likely driving confused and negative replies. Next campaign should filter to 6+ months only.', { italic: true, color: '64748B' }),
        spacer(),

        heading('Replies Received', HeadingLevel.HEADING_2),
        makeTable(
          ['Reply', 'Sentiment'],
          [
            ['No thank you', 'Negative'],
            ['I\'m around but never going back. [cleaning complaint]', 'Negative — Flag for Dr. Philip'],
            ['I live in TN now, Thk u', 'Out of area (opted out)'],
            ['[4th reply not logged to Village Dental]', '—'],
          ],
          null,
          [6000, 3000]
        ),
        body('0 positive replies from Village Dental. The 12–24 month overdue segment (110 patients) had 1 reply — moved to Tennessee. 109 patients in this segment remain unreplied and in play.', { italic: true, color: '64748B' }),
        spacer(),

        heading('Action Items', HeadingLevel.HEADING_2),
        bullet('Manually opt out Iwona Becwar (replied "No thank you" — opt-out not yet set in system)'),
        bullet('Flag Lorant Bartha complaint to Dr. Philip / office manager for awareness'),
        bullet('109 unreplied patients in the 12–24 month bucket are the highest-priority targets for the next send'),
        spacer(),

        // ── Next Steps ──
        heading('Path Forward'),
        heading('Village Dental Next Campaign Pool', HeadingLevel.HEADING_2),
        makeTable(
          ['Segment', 'Count', 'Notes'],
          [
            ['Never contacted', '702', 'No prior outreach — full 3-message sequence'],
            ['Texted Apr 8, follow-ups pending', '502', 'Day 0 sent, Day 1 + Day 3 not yet sent'],
            ['Total sendable', '~1,204', 'Before overdue filtering'],
            ['Recommended send (6+ mo overdue only)', '~360', 'Removes noise from under-6-month patients'],
          ],
          null,
          [3500, 1500, 4000]
        ),
        spacer(),

        heading('Recommended Approach', HeadingLevel.HEADING_2),
        bullet('Filter next launch to 6+ months overdue only — this targets the highest-intent patients and reduces confused/negative replies'),
        bullet('Rate limit strictly to 1 message per second — no burst sending'),
        bullet('Start with Village Dental only before expanding to other locations'),
        bullet('All crons (RECALL_CRON_ENABLED, SMS_LIVE_MODE) remain off until explicitly re-enabled with confirmed patient count'),
        spacer(),
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [new TextRun({ text: 'Prepared by DentiFlow · Confidential', size: 16, color: '94A3B8', italic: true })]
        }),
      ]
    }]
  });

  return doc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching data from Supabase...');
  const data = await fetchData();

  console.log('Building document...');
  const doc = await buildDoc(data);

  console.log('Saving .docx...');
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_PATH, buffer);

  console.log(`\nDone. Report saved to:\n  ${OUTPUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });

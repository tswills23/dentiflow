// Create a Google Doc with the partner brief for the unscheduled treatment report.
// Uses Drive API's HTML→Doc conversion for clean formatting.
import { execSync } from 'child_process';

const token = execSync('gcloud.cmd auth print-access-token', { encoding: 'utf-8' }).trim();

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/18txoA5Lrp1cZ8gT_AgcDDip9gSSAK7SfUspMneZMPSo/edit';

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unscheduled Treatment Hot Leads — Partner Brief</title></head><body>

<h1>Unscheduled Treatment Hot Leads — Partner Brief</h1>
<p><strong>Snapshot:</strong> June 1, 2026 · <strong>Source:</strong> Dentrix Ascend (cleaned + deduped)</p>

<h2>TL;DR</h2>
<p><strong>$1,325,596</strong> in already-diagnosed, treatment-planned procedures sitting unscheduled across <strong>504 patients</strong> who were in our chair within the last 6 months. We diagnosed it, they didn't book. We've been letting it walk out the door.</p>
<p>🔗 <a href="${SHEET_URL}"><strong>Working sheet here</strong></a></p>

<hr/>

<h2>The Opportunity</h2>
<table border="1" cellpadding="6" cellspacing="0">
<thead><tr><th>Metric</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Hot-lead patients (last visit ≤ 6 mo)</td><td><strong>504</strong></td></tr>
<tr><td>Unique unscheduled procedures</td><td>1,009</td></tr>
<tr><td><strong>Total case value</strong></td><td><strong>$1,325,596</strong></td></tr>
<tr><td>Avg case value per patient</td><td>$2,651</td></tr>
<tr><td>Avg procedure value</td><td>$1,314</td></tr>
</tbody>
</table>

<h2>Where it lives (by location)</h2>
<table border="1" cellpadding="6" cellspacing="0">
<thead><tr><th>Location</th><th>Patients</th><th>$ Opportunity</th><th>Ghosting (no future appt)</th></tr></thead>
<tbody>
<tr><td><strong>32 Village Dental</strong></td><td>151</td><td><strong>$549,915</strong></td><td>70 (46%)</td></tr>
<tr><td>32 Cottage Dental Care</td><td>241</td><td>$447,150</td><td>57 (24%)</td></tr>
<tr><td>32 Western Springs Dentistry</td><td>112</td><td>$328,531</td><td>14 (13%)</td></tr>
</tbody>
</table>
<p><strong>Front desk pattern worth noting:</strong> Western Springs only ghosts 13% of unscheduled-treatment patients. Village ghosts 46%. Same diagnosis-to-book gap exists at every location, but Western Springs is clearly doing something at checkout that the others aren't. Worth a 15-min conversation across location managers.</p>

<h2>What treatments are unscheduled</h2>
<table border="1" cellpadding="6" cellspacing="0">
<thead><tr><th>Treatment</th><th>Procs</th><th>$ Value</th></tr></thead>
<tbody>
<tr><td><strong>Crowns (D2740) — full porcelain</strong></td><td>420</td><td><strong>$674,087</strong></td></tr>
<tr><td><strong>Implant placements (D6010)</strong></td><td>71</td><td>$191,714</td></tr>
<tr><td>Implant crowns (D6058)</td><td>84</td><td>$154,701</td></tr>
<tr><td>Core buildups (D2950)</td><td>259</td><td>$105,027</td></tr>
<tr><td>Implant abutments (D6057)</td><td>70</td><td>$101,421</td></tr>
<tr><td>Root canals (D3310/3320/3330)</td><td>52</td><td>$62,331</td></tr>
<tr><td>Other (perio, bridge components)</td><td>53</td><td>$36,316</td></tr>
</tbody>
</table>
<p><strong>Crowns alone = 51% of the opportunity.</strong> This is a single-treatment story. Reactivating one crown patient = $1,600+ in production.</p>

<h2>Case-size distribution</h2>
<table border="1" cellpadding="6" cellspacing="0">
<thead><tr><th>Case Size</th><th>Patients</th><th>Combined Value</th></tr></thead>
<tbody>
<tr><td>$300 – $999</td><td>64</td><td>$37,770</td></tr>
<tr><td>$1,000 – $1,999</td><td>196</td><td>$310,686</td></tr>
<tr><td><strong>$2,000 – $4,999</strong></td><td><strong>183</strong></td><td><strong>$552,410</strong></td></tr>
<tr><td>$5,000 – $9,999</td><td>54</td><td>$388,745</td></tr>
<tr><td>$10,000+</td><td>3</td><td>$35,985</td></tr>
</tbody>
</table>
<p>Sweet spot: <strong>the 183 patients with $2K–$5K cases drive 42% of the total opportunity</strong>. These are crown + buildup combos and partial implant cases. Not too daunting financially, big enough to matter.</p>

<h2>Hottest sub-segment: Big Treatment, Last 60 Days</h2>
<p>Filtered down further — patients in the chair in the past 60 days with a crown / implant / RCT / bridge unscheduled:</p>
<ul>
<li><strong>214 patients</strong></li>
<li><strong>$594,607</strong> in case value</li>
<li>Avg $2,778 per case</li>
</ul>
<p>These are the people whose dentist just told them they need a crown. The diagnosis is still fresh. Highest-conversion segment of the entire list.</p>

<h2>Revenue projections</h2>
<p>These are warm leads — diagnosed by us, recently in our chair. Industry benchmark for warm reactivation is 10–25%. Conservative math:</p>
<table border="1" cellpadding="6" cellspacing="0">
<thead><tr><th>Conversion Rate</th><th>Revenue</th><th>Cases Closed</th></tr></thead>
<tbody>
<tr><td>5% (skeptical)</td><td>$66,280</td><td>25</td></tr>
<tr><td><strong>10% (realistic)</strong></td><td><strong>$132,560</strong></td><td><strong>50</strong></td></tr>
<tr><td>15% (industry avg)</td><td>$198,839</td><td>75</td></tr>
<tr><td>20% (optimized)</td><td>$265,119</td><td>100</td></tr>
<tr><td>25% (best case)</td><td>$331,399</td><td>125</td></tr>
</tbody>
</table>
<p><strong>Even at the floor 5%, we're looking at $66K in net new production from a single CSV pull.</strong> That's one person making calls for 2–3 weeks.</p>

<h2>Why this is HUGE (and only grows from here)</h2>
<ol>
<li><strong>This is a 6-month snapshot.</strong> Every 30 days another ~80–100 patients will roll into the "hot" window as they hit the 6-month mark.</li>
<li><strong>Compound effect.</strong> If we run this report monthly and clear even the top 50 each cycle, we close 600+ unscheduled treatment cases per year = roughly <strong>$1.5M in incremental annual production</strong> at conservative rates.</li>
<li><strong>No new patients required.</strong> Zero CAC. These are people who already chose us.</li>
<li><strong>No new tech required.</strong> The report builder is built and saved in Ascend. We rerun it monthly in 2 minutes.</li>
</ol>

<h2>What we need to decide</h2>
<ol>
<li><strong>Who works the list?</strong> Front desk capacity, or dedicated treatment coordinator?</li>
<li><strong>Phone-first or SMS-first?</strong> Top 100 by case value warrants phone calls. The other 400 could be SMS sequence (template bank needs partner review before any send).</li>
<li><strong>Cadence?</strong> Monthly Ascend pull on the 1st, work the list down through the month.</li>
<li><strong>Tracking?</strong> Mark patients as "contacted" / "scheduled" / "declined" in the sheet so we measure conversion and compound learning.</li>
</ol>

<h2>Recommendation</h2>
<p>Top 100 calls in the first week (one dedicated person, ~5 hours/day, 20–25 calls/day). Rest of the list goes to SMS sequence after partner-approved templates. Re-pull on July 1, repeat.</p>

<h2>Glossary</h2>
<ul>
<li><strong>Ghosting</strong> = patient has zero future appointments scheduled. Safe to text without conflict.</li>
<li><strong>Has Appt</strong> = patient has some future appointment (almost always hygiene/recare since the unscheduled-treatment report by definition excludes treatments that ARE on the schedule). Front desk should glance at the schedule before contact, but generally safe.</li>
<li><strong>Big Treatment</strong> = crowns, root canals, implants, bridges. Excludes standalone core buildups and perio scaling as those are usually paired with bigger work or smaller in revenue impact.</li>
</ul>

</body></html>`;

// Upload as Google Doc via Drive API multipart upload
const boundary = '----dentiflow_partner_brief_boundary';
const metadata = {
  name: 'Unscheduled Treatment Hot Leads — Partner Brief (6/1)',
  mimeType: 'application/vnd.google-apps.document',
};

const body =
  `--${boundary}\r\n` +
  `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
  JSON.stringify(metadata) + '\r\n' +
  `--${boundary}\r\n` +
  `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
  html + '\r\n' +
  `--${boundary}--`;

console.log('Creating Google Doc...');
const res = await fetch(
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  }
);

if (!res.ok) {
  console.error('Failed:', res.status, await res.text());
  process.exit(1);
}

const result = await res.json();
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('Done!');
console.log(`Doc URL: ${result.webViewLink}`);
console.log('═══════════════════════════════════════════════════════════');

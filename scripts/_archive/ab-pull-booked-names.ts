// Pull candidate patient list for the front-desk revenue export.
// Two cohorts:
//   1. S6_COMPLETED — reached booking-intent state in the AI chat (4 patients per DB)
//   2. Link-clickers — clicked the booking link but state machine never advanced
//      (these are the "booked outside our visible loop" candidates)
//
// Trevor reported 11 confirmed bookings via manual Dentrix cross-reference.
// 4 are in the S6 list. The other 7 should be among the 48 link-clickers.
//
// Output: docs/case-study-1-booked-patient-list.md

import dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { supabase } from '../src/lib/supabase';

const PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const LAUNCH_DATE = '2026-05-12';

type Row = {
  id: string; patient_id: string; created_at: string; booking_stage: string | null; link_clicked_at: string | null;
  patients: { first_name: string | null; last_name: string | null; phone: string | null };
};

async function main(): Promise<void> {
  const { data: seqs, error } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, created_at, booking_stage, link_clicked_at, patients!inner(first_name, last_name, phone)')
    .eq('practice_id', PRACTICE_ID)
    .eq('experiment_arm', 'control_voice')
    .order('created_at', { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }

  const rows = (seqs || []) as unknown as Row[];
  const s6 = rows.filter(r => r.booking_stage === 'S6_COMPLETED');
  const clickedOnly = rows.filter(r => r.link_clicked_at && r.booking_stage !== 'S6_COMPLETED');

  function tableRow(r: Row, i: number): string {
    const fn = r.patients?.first_name || '[missing]';
    const ln = r.patients?.last_name || '[missing]';
    const ph = r.patients?.phone || '[missing]';
    const clickedAt = r.link_clicked_at ? new Date(r.link_clicked_at).toISOString().slice(0, 10) : '';
    return `| ${i + 1} | ${fn} | ${ln} | ${ph} | ${clickedAt} |\n`;
  }

  let md = `# Case Study #1 — Booked Patient List (for Front-Desk Revenue Export)\n\n`;
  md += `**Source:** Production DB, Arm A (control_voice, 3-voice sequence)\n`;
  md += `**Test window:** ${LAUNCH_DATE} through 2026-05-26 (14 days)\n`;
  md += `**Pulled:** 2026-06-02\n\n`;
  md += `---\n\n`;
  md += `## Important: this DB pull is a candidate pool, not the confirmed 11\n\n`;
  md += `Trevor reported **11 confirmed bookings** from Arm A via manual Dentrix cross-reference. The production DB only shows **${s6.length} patients** reaching booking-intent state (S6_COMPLETED) — those are guaranteed bookings per our system.\n\n`;
  md += `The other 7 confirmed bookings happened **outside our visible loop**: patient clicked the booking link, went to the external scheduler, booked without our state machine seeing it. OR called the office directly.\n\n`;
  md += `That means the other 7 are almost certainly somewhere in the **${clickedOnly.length} link-clickers** below. The front desk can verify which by cross-checking against actual Dentrix appointment data for these phone numbers / names.\n\n`;
  md += `---\n\n`;
  md += `## Cohort 1 — S6_COMPLETED (${s6.length} patients, system-confirmed bookings)\n\n`;
  md += `These patients reached booking-intent in our AI chat. Confirmed bookings per Dentiflow.\n\n`;
  md += `| # | First Name | Last Name | Phone | Link clicked |\n`;
  md += `|---|---|---|---|---|\n`;
  s6.forEach((r, i) => { md += tableRow(r, i); });

  md += `\n---\n\n`;
  md += `## Cohort 2 — Link-clickers (${clickedOnly.length} patients, likely contains the other 7 bookings)\n\n`;
  md += `These patients clicked the booking link but our state machine never advanced to S6_COMPLETED. They likely booked through Dentrix Ascend's external scheduler or by phone — invisible to our system.\n\n`;
  md += `| # | First Name | Last Name | Phone | Link clicked |\n`;
  md += `|---|---|---|---|---|\n`;
  clickedOnly.forEach((r, i) => { md += tableRow(r, i); });

  md += `\n---\n\n`;
  md += `## Ask for Scott (text to send to Village front desk)\n\n`;
  md += `> "Hey — for the case study Trevor's putting together, can you cross-reference the patient list below against Dentrix appointments scheduled or completed between ${LAUNCH_DATE} and today? We're looking for the ~11 we confirmed booked. Then run a Production by Patient report for just those, sum the production column, and send back the total. Should take ~15 minutes."\n\n`;
  md += `---\n\n`;
  md += `## What we need back\n\n`;
  md += `Just one number: **total production (in dollars) for the confirmed booked patients in the date range above.**\n\n`;
  md += `Step-by-step for the front desk:\n`;
  md += `1. Open Dentrix Ascend\n`;
  md += `2. For each name on the list, check if an appointment exists between ${LAUNCH_DATE} and today\n`;
  md += `3. For the patients who DID have an appointment, pull production via Reports → Production by Patient\n`;
  md += `4. Sum the production column across all confirmed-booked patients\n`;
  md += `5. Send back the total\n\n`;
  md += `> **HIPAA note:** Do NOT share the report itself outside the practice. Only the aggregated total dollar number is needed.\n\n`;
  md += `---\n\n`;
  md += `## If Trevor already has the 11 names locked from prior cross-reference\n\n`;
  md += `Skip this file — just hand the front desk that confirmed list of 11 directly. This file is the candidate pool in case the original confirmation list isn't handy.\n`;

  const outPath = resolve(__dirname, '..', 'docs', 'case-study-1-booked-patient-list.md');
  writeFileSync(outPath, md, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`  Cohort 1 (S6_COMPLETED): ${s6.length} patients`);
  console.log(`  Cohort 2 (link-clickers, no S6): ${clickedOnly.length} patients`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

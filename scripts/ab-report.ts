#!/usr/bin/env npx tsx
// A/B test attribution report for the Village Dental recall launch.
//
// Reports per arm:
//   - sent: total sequences with that experiment_arm
//   - link_clicks: sequences where link_clicked_at IS NOT NULL
//   - booked: distinct patients with an appointment created within 14 days of sequence start
//
// Usage: npx tsx scripts/ab-report.ts [--days N]

import { resolve } from 'path';
import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const DEFAULT_PRACTICE_ID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const ATTRIBUTION_WINDOW_DAYS = 14;

interface ArmStats {
  sent: number;
  link_clicks: number;
  booked: number;
  patientIds: string[];
}

async function fetchArm(practiceId: string, arm: 'control_voice' | 'offer_only', windowDays: number): Promise<ArmStats> {
  const { data: seqs, error } = await supabase
    .from('recall_sequences')
    .select('id, patient_id, created_at, link_clicked_at')
    .eq('practice_id', practiceId)
    .eq('experiment_arm', arm);
  if (error) throw new Error(`Failed to fetch ${arm}: ${error.message}`);

  const stats: ArmStats = {
    sent: seqs?.length || 0,
    link_clicks: (seqs || []).filter(s => s.link_clicked_at !== null).length,
    booked: 0,
    patientIds: (seqs || []).map(s => s.patient_id),
  };

  if (!seqs?.length) return stats;

  // Pull all appointments for these patients, then filter in JS to the
  // per-sequence window (each sequence has its own created_at + 14 days).
  const patientToSeqStart = new Map<string, string>();
  for (const s of seqs) {
    // Keep earliest sequence start per patient (in case of edge cases).
    const existing = patientToSeqStart.get(s.patient_id);
    if (!existing || s.created_at < existing) patientToSeqStart.set(s.patient_id, s.created_at);
  }

  const patientIds = Array.from(patientToSeqStart.keys());
  // Chunk patient IDs to avoid PostgREST URL length limits.
  const CHUNK = 200;
  const bookedPatients = new Set<string>();
  for (let i = 0; i < patientIds.length; i += CHUNK) {
    const slice = patientIds.slice(i, i + CHUNK);
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('patient_id, created_at')
      .eq('practice_id', practiceId)
      .in('patient_id', slice);
    if (apptErr) throw new Error(`Failed to fetch appointments: ${apptErr.message}`);
    for (const a of appts || []) {
      const start = patientToSeqStart.get(a.patient_id);
      if (!start) continue;
      const startMs = new Date(start).getTime();
      const apptMs = new Date(a.created_at).getTime();
      const windowEnd = startMs + windowDays * 24 * 60 * 60 * 1000;
      if (apptMs >= startMs && apptMs <= windowEnd) {
        bookedPatients.add(a.patient_id);
      }
    }
  }
  stats.booked = bookedPatients.size;
  return stats;
}

function pct(n: number, d: number): string {
  if (d === 0) return '0.0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let windowDays = ATTRIBUTION_WINDOW_DAYS;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days') {
      const n = parseInt(args[++i] || '', 10);
      if (!isNaN(n)) windowDays = n;
    }
  }

  console.log('\n========== RECALL A/B REPORT ==========');
  console.log(`Practice: ${DEFAULT_PRACTICE_ID}`);
  console.log(`Attribution window: ${windowDays} days from sequence start\n`);

  const control = await fetchArm(DEFAULT_PRACTICE_ID, 'control_voice', windowDays);
  const offer = await fetchArm(DEFAULT_PRACTICE_ID, 'offer_only', windowDays);

  const rows = [
    ['Arm', 'Sent', 'Link Clicks', 'CTR', 'Booked', 'Booking Rate'],
    [
      'A (control_voice)',
      String(control.sent),
      String(control.link_clicks),
      pct(control.link_clicks, control.sent),
      String(control.booked),
      pct(control.booked, control.sent),
    ],
    [
      'B (offer_only)',
      String(offer.sent),
      String(offer.link_clicks),
      pct(offer.link_clicks, offer.sent),
      String(offer.booked),
      pct(offer.booked, offer.sent),
    ],
  ];
  const widths = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length)));
  for (const r of rows) {
    console.log('  ' + r.map((cell, c) => cell.padEnd(widths[c])).join('  '));
  }

  const winner = control.booked > offer.booked
    ? 'Arm A (control_voice)'
    : offer.booked > control.booked
    ? 'Arm B (offer_only)'
    : 'tie';
  console.log(`\nLeader by bookings: ${winner}`);
  console.log(`Delta: ${Math.abs(control.booked - offer.booked)} bookings (${pct(Math.abs(control.booked - offer.booked), Math.max(control.sent, offer.sent))})`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

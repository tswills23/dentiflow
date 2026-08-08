// Outbound Recall Sequence Test Setup
// Creates a separate test practice with only your test patient,
// so /api/recall/launch can be called safely without touching real patients.
//
// Usage:
//   node .tmp/setup_outbound_test.mjs setup     — create test practice + patient + sequence
//   node .tmp/setup_outbound_test.mjs launch     — call /api/recall/launch for test practice
//   node .tmp/setup_outbound_test.mjs advance    — backdate last_sent_at + call orchestrate (Day 0→1→3)
//   node .tmp/setup_outbound_test.mjs status     — show current sequence status
//   node .tmp/setup_outbound_test.mjs cleanup    — delete all test data + restore real practice

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_PRACTICE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const REAL_PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const TWILIO_PHONE = '+18333486593';
const TEST_PHONE = '+16306400029';
const SERVER_URL = 'http://localhost:3000';

const command = process.argv[2] || 'setup';

async function setup() {
  console.log('=== Setting up outbound test ===\n');

  // 1. Remove twilio_phone from real practice (temporarily)
  console.log('1. Temporarily removing twilio_phone from real practice...');
  const { error: clearErr } = await supabase
    .from('practices')
    .update({ twilio_phone: null })
    .eq('id', REAL_PRACTICE_ID);
  if (clearErr) {
    console.error('  Error:', clearErr.message);
    return;
  }
  console.log('  Done — real practice twilio_phone set to NULL\n');

  // 2. Create test practice
  console.log('2. Creating test practice...');
  const { error: practiceErr } = await supabase
    .from('practices')
    .upsert({
      id: TEST_PRACTICE_ID,
      name: 'Wills Family Dentistry',
      phone: TEST_PHONE,
      twilio_phone: TWILIO_PHONE,
    }, { onConflict: 'id' });
  if (practiceErr) {
    console.error('  Error:', practiceErr.message);
    // Restore real practice
    await supabase.from('practices').update({ twilio_phone: TWILIO_PHONE }).eq('id', REAL_PRACTICE_ID);
    return;
  }
  console.log(`  Created: ${TEST_PRACTICE_ID}\n`);

  // 3. Create test patient
  console.log('3. Creating test patient...');
  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', TEST_PRACTICE_ID)
    .eq('phone', TEST_PHONE)
    .maybeSingle();

  let patientId;
  if (existingPatient) {
    patientId = existingPatient.id;
    console.log(`  Already exists: ${patientId}\n`);
  } else {
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .insert({
        practice_id: TEST_PRACTICE_ID,
        first_name: 'Test',
        last_name: 'Tyler',
        phone: TEST_PHONE,
        status: 'active',
        source: 'test',
        location: '32 Cottage Dental Care',
      })
      .select('id')
      .single();
    if (patientErr) {
      console.error('  Error:', patientErr.message);
      return;
    }
    patientId = patient.id;
    console.log(`  Created: ${patientId}\n`);
  }

  // 4. Create recall sequence (Day 0, never sent)
  console.log('4. Creating recall sequence...');
  // Delete any existing test sequences first
  await supabase
    .from('recall_sequences')
    .delete()
    .eq('practice_id', TEST_PRACTICE_ID);

  const { data: seq, error: seqErr } = await supabase
    .from('recall_sequences')
    .insert({
      practice_id: TEST_PRACTICE_ID,
      patient_id: patientId,
      sequence_status: 'active',
      sequence_day: 0,
      assigned_voice: 'office',
      segment_overdue: 'gte_6_lt_12',
      months_overdue: 8,
      last_sent_at: null,
      next_send_at: null,
      reply_count: 0,
      booking_stage: 'S0_OPENING',
    })
    .select('id')
    .single();
  if (seqErr) {
    console.error('  Error:', seqErr.message);
    return;
  }
  console.log(`  Created sequence: ${seq.id}\n`);

  console.log('=== Setup complete! ===');
  console.log(`Test Practice ID: ${TEST_PRACTICE_ID}`);
  console.log(`Patient ID: ${patientId}`);
  console.log(`Sequence ID: ${seq.id}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Make sure server + tunnel are running`);
  console.log(`  2. Run: node .tmp/setup_outbound_test.mjs launch`);
  console.log(`  3. Check your phone for Day 0 SMS`);
  console.log(`  4. Run: node .tmp/setup_outbound_test.mjs advance  (to fast-forward to Day 1, then Day 3)`);
}

async function launch() {
  console.log('=== Launching Day 0 outreach ===\n');
  try {
    const resp = await fetch(`${SERVER_URL}/api/recall/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practiceId: TEST_PRACTICE_ID }),
    });
    const data = await resp.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error — is the server running?', err.message);
  }
}

async function advance() {
  console.log('=== Fast-forwarding sequence ===\n');

  // Get current sequence state
  const { data: seq } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('practice_id', TEST_PRACTICE_ID)
    .single();

  if (!seq) {
    console.error('No sequence found for test practice');
    return;
  }

  console.log(`Current state: Day ${seq.sequence_day}, status=${seq.sequence_status}`);
  console.log(`last_sent_at: ${seq.last_sent_at}`);
  console.log(`next_send_at: ${seq.next_send_at}\n`);

  if (seq.sequence_status !== 'active') {
    console.log('Sequence is not active. Reset it first with: node .tmp/setup_outbound_test.mjs setup');
    return;
  }

  if (!seq.last_sent_at) {
    console.log('Sequence has not been sent yet. Run "launch" first.');
    return;
  }

  // Backdate last_sent_at and next_send_at to simulate time passing
  const hoursBack = seq.sequence_day === 0 ? 25 : 49; // 25h for Day 0→1, 49h for Day 1→3
  const backdated = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  console.log(`Backdating last_sent_at by ${hoursBack} hours to: ${backdated}`);

  await supabase
    .from('recall_sequences')
    .update({
      last_sent_at: backdated,
      next_send_at: backdated, // Must also be in the past for orchestrator to pick it up
    })
    .eq('id', seq.id);

  console.log('Calling orchestrator...\n');

  try {
    const resp = await fetch(`${SERVER_URL}/api/recall/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practiceId: TEST_PRACTICE_ID }),
    });
    const data = await resp.json();
    console.log('Orchestrator result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error — is the server running?', err.message);
  }

  // Show updated state
  await status();
}

async function status() {
  console.log('\n=== Current sequence status ===\n');

  const { data: seq } = await supabase
    .from('recall_sequences')
    .select('*')
    .eq('practice_id', TEST_PRACTICE_ID)
    .single();

  if (!seq) {
    console.log('No sequence found for test practice');
    return;
  }

  console.log(`Sequence ID:    ${seq.id}`);
  console.log(`Status:         ${seq.sequence_status}`);
  console.log(`Day:            ${seq.sequence_day}`);
  console.log(`Voice:          ${seq.assigned_voice}`);
  console.log(`Booking Stage:  ${seq.booking_stage}`);
  console.log(`Reply Count:    ${seq.reply_count}`);
  console.log(`Last Sent:      ${seq.last_sent_at || 'never'}`);
  console.log(`Next Send:      ${seq.next_send_at || 'none'}`);
  console.log(`Exit Reason:    ${seq.exit_reason || 'n/a'}`);

  // Check conversations
  const { data: convos } = await supabase
    .from('conversations')
    .select('direction, message_body, created_at, twilio_sid')
    .eq('practice_id', TEST_PRACTICE_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (convos?.length) {
    console.log(`\nRecent messages:`);
    for (const c of convos) {
      const dir = c.direction === 'outbound' ? '→ OUT' : '← IN ';
      const time = new Date(c.created_at).toLocaleTimeString();
      console.log(`  ${dir} [${time}] ${c.message_body?.substring(0, 80)}...`);
    }
  }
}

async function cleanup() {
  console.log('=== Cleaning up test data ===\n');

  // 1. Delete conversations
  const { count: convCount } = await supabase
    .from('conversations')
    .delete({ count: 'exact' })
    .eq('practice_id', TEST_PRACTICE_ID);
  console.log(`Deleted ${convCount || 0} conversations`);

  // 2. Delete automation_log entries
  const { count: logCount } = await supabase
    .from('automation_log')
    .delete({ count: 'exact' })
    .eq('practice_id', TEST_PRACTICE_ID);
  console.log(`Deleted ${logCount || 0} automation_log entries`);

  // 3. Delete recall sequences
  const { count: seqCount } = await supabase
    .from('recall_sequences')
    .delete({ count: 'exact' })
    .eq('practice_id', TEST_PRACTICE_ID);
  console.log(`Deleted ${seqCount || 0} recall sequences`);

  // 4. Delete patients
  const { count: patCount } = await supabase
    .from('patients')
    .delete({ count: 'exact' })
    .eq('practice_id', TEST_PRACTICE_ID);
  console.log(`Deleted ${patCount || 0} patients`);

  // 5. Delete test practice
  const { error: delErr } = await supabase
    .from('practices')
    .delete()
    .eq('id', TEST_PRACTICE_ID);
  console.log(`Deleted test practice${delErr ? ' (error: ' + delErr.message + ')' : ''}`);

  // 6. Restore twilio_phone on real practice
  const { error: restoreErr } = await supabase
    .from('practices')
    .update({ twilio_phone: TWILIO_PHONE })
    .eq('id', REAL_PRACTICE_ID);
  console.log(`\nRestored twilio_phone on real practice${restoreErr ? ' (error: ' + restoreErr.message + ')' : ''}`);

  console.log('\n=== Cleanup complete ===');
}

// Route command
switch (command) {
  case 'setup':
    await setup();
    break;
  case 'launch':
    await launch();
    break;
  case 'advance':
    await advance();
    break;
  case 'status':
    await status();
    break;
  case 'cleanup':
    await cleanup();
    break;
  default:
    console.log('Usage: node .tmp/setup_outbound_test.mjs [setup|launch|advance|status|cleanup]');
}

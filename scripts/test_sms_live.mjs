// Live SMS Test — Scott Wills + Tyler Wills
// Uses REAL practice (Wills Family Dentistry) — no isolated test practice needed.
//
// Usage:
//   node scripts/test_sms_live.mjs setup       — ensure both patients exist on real practice
//   node scripts/test_sms_live.mjs recall       — create recall sequences for both, send Day 0
//   node scripts/test_sms_live.mjs advance      — fast-forward → trigger Day 1 (then Day 3)
//   node scripts/test_sms_live.mjs status       — show sequences + recent messages
//   node scripts/test_sms_live.mjs cleanup      — delete test sequences + conversations (keeps patients)

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';
const TWILIO_PHONE = '+18333486593';
const SERVER_URL = 'http://localhost:3000';

const TEST_PATIENTS = [
  { first_name: 'Scott', last_name: 'Wills', phone: '+16307476875' },
  { first_name: 'Tyler', last_name: 'Wills', phone: '+16306400029' },
];

const command = process.argv[2] || 'setup';

async function setup() {
  console.log('=== Setting up test patients ===\n');

  // Ensure practice has twilio_phone
  const { data: practice } = await supabase
    .from('practices')
    .select('id, name, twilio_phone')
    .eq('id', PRACTICE_ID)
    .single();

  if (!practice) {
    console.error('Practice not found!');
    return;
  }

  console.log(`Practice: ${practice.name}`);
  console.log(`Twilio Phone: ${practice.twilio_phone || 'NOT SET'}\n`);

  if (!practice.twilio_phone) {
    console.log('Setting twilio_phone...');
    await supabase
      .from('practices')
      .update({ twilio_phone: TWILIO_PHONE })
      .eq('id', PRACTICE_ID);
    console.log(`  Set to ${TWILIO_PHONE}\n`);
  }

  // Create/verify each test patient
  for (const p of TEST_PATIENTS) {
    const { data: existing } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, status, recall_opt_out')
      .eq('practice_id', PRACTICE_ID)
      .eq('phone', p.phone)
      .maybeSingle();

    if (existing) {
      console.log(`✓ ${existing.first_name} ${existing.last_name} — ${existing.phone} (${existing.id})`);
      console.log(`  Status: ${existing.status} | Recall opt-out: ${existing.recall_opt_out || false}`);

      // Make sure they're active and not opted out
      if (existing.status !== 'active' || existing.recall_opt_out) {
        console.log('  Fixing: setting active + recall_opt_out=false');
        await supabase
          .from('patients')
          .update({ status: 'active', recall_opt_out: false })
          .eq('id', existing.id);
      }
    } else {
      const { data: created, error } = await supabase
        .from('patients')
        .insert({
          practice_id: PRACTICE_ID,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          status: 'active',
          source: 'test',
          location: '32 Cottage Dental Care',
        })
        .select('id')
        .single();

      if (error) {
        console.error(`✗ Failed to create ${p.first_name}: ${error.message}`);
      } else {
        console.log(`+ Created ${p.first_name} ${p.last_name} — ${p.phone} (${created.id})`);
      }
    }
  }

  console.log('\n=== Setup complete ===');
  console.log('\nInbound test: Have Scott or Tyler text +18333486593');
  console.log('Outbound test: Run  node scripts/test_sms_live.mjs recall');
}

async function recall() {
  console.log('=== Creating recall sequences + sending Day 0 ===\n');

  for (const p of TEST_PATIENTS) {
    // Find patient
    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone')
      .eq('practice_id', PRACTICE_ID)
      .eq('phone', p.phone)
      .maybeSingle();

    if (!patient) {
      console.error(`Patient ${p.first_name} not found — run setup first`);
      continue;
    }

    // Delete any existing active sequence for this patient
    const { data: existingSeqs } = await supabase
      .from('recall_sequences')
      .select('id, sequence_status')
      .eq('patient_id', patient.id)
      .in('sequence_status', ['active', 'deferred']);

    if (existingSeqs?.length) {
      console.log(`  Cleaning ${existingSeqs.length} existing sequence(s) for ${p.first_name}...`);
      await supabase
        .from('recall_sequences')
        .delete()
        .eq('patient_id', patient.id)
        .in('sequence_status', ['active', 'deferred']);
    }

    // Create fresh Day 0 sequence
    const { data: seq, error } = await supabase
      .from('recall_sequences')
      .insert({
        practice_id: PRACTICE_ID,
        patient_id: patient.id,
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

    if (error) {
      console.error(`✗ Failed to create sequence for ${p.first_name}: ${error.message}`);
      continue;
    }

    console.log(`✓ ${p.first_name} ${p.last_name} — sequence ${seq.id} (Day 0, ready to send)`);
  }

  // Safety check: make sure only our test patients are queued
  const { count } = await supabase
    .from('recall_sequences')
    .select('*', { count: 'exact', head: true })
    .eq('practice_id', PRACTICE_ID)
    .eq('sequence_status', 'active')
    .eq('sequence_day', 0)
    .is('last_sent_at', null);

  console.log(`\nUnsent Day 0 sequences: ${count}`);

  if (count > TEST_PATIENTS.length) {
    console.error(`\n⚠ SAFETY STOP: Found ${count} unsent sequences but only ${TEST_PATIENTS.length} test patients.`);
    console.error('Other patients may be queued. Aborting to prevent accidental mass send.');
    console.error('Fix: run cleanup first, or manually delete stale sequences.');
    return;
  }

  // Send Day 0 via the server's launch endpoint
  console.log('Sending Day 0 messages...\n');
  try {
    const resp = await fetch(`${SERVER_URL}/api/recall/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practiceId: PRACTICE_ID }),
    });
    const data = await resp.json();
    console.log('Launch result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error — is the server running?', err.message);
  }
}

async function advance() {
  console.log('=== Fast-forwarding test sequences ===\n');

  // Get active sequences for our test patients
  const phones = TEST_PATIENTS.map(p => p.phone);

  for (const p of TEST_PATIENTS) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name')
      .eq('practice_id', PRACTICE_ID)
      .eq('phone', p.phone)
      .maybeSingle();

    if (!patient) continue;

    const { data: seq } = await supabase
      .from('recall_sequences')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('sequence_status', 'active')
      .maybeSingle();

    if (!seq) {
      console.log(`${p.first_name}: No active sequence found`);
      continue;
    }

    console.log(`${p.first_name}: Day ${seq.sequence_day}, last_sent=${seq.last_sent_at ? 'yes' : 'never'}`);

    if (!seq.last_sent_at) {
      console.log(`  → Not sent yet. Run "recall" first.`);
      continue;
    }

    if (seq.sequence_day >= 3) {
      console.log(`  → Already at Day 3 (final). No more advances.`);
      continue;
    }

    const hoursBack = seq.sequence_day === 0 ? 25 : 49;
    const backdated = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    console.log(`  → Backdating by ${hoursBack}h to trigger Day ${seq.sequence_day === 0 ? 1 : 3}`);

    await supabase
      .from('recall_sequences')
      .update({ last_sent_at: backdated, next_send_at: backdated })
      .eq('id', seq.id);
  }

  console.log('\nCalling orchestrator...\n');
  try {
    const resp = await fetch(`${SERVER_URL}/api/recall/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practiceId: PRACTICE_ID }),
    });
    const data = await resp.json();
    console.log('Orchestrator result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error — is the server running?', err.message);
  }

  // Show updated status
  await status();
}

async function status() {
  console.log('\n=== Test patient status ===\n');

  for (const p of TEST_PATIENTS) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('practice_id', PRACTICE_ID)
      .eq('phone', p.phone)
      .maybeSingle();

    if (!patient) {
      console.log(`${p.first_name} ${p.last_name}: NOT FOUND`);
      continue;
    }

    console.log(`--- ${patient.first_name} ${patient.last_name} (${p.phone}) ---`);

    // Active recall sequence
    const { data: seq } = await supabase
      .from('recall_sequences')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seq) {
      console.log(`  Recall: Day ${seq.sequence_day} | ${seq.sequence_status} | Stage: ${seq.booking_stage}`);
      console.log(`  Replies: ${seq.reply_count} | Last sent: ${seq.last_sent_at || 'never'}`);
      if (seq.exit_reason) console.log(`  Exit: ${seq.exit_reason}`);
    } else {
      console.log('  Recall: No sequence');
    }

    // Recent conversations
    const { data: convos } = await supabase
      .from('conversations')
      .select('direction, message_body, created_at')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(6);

    if (convos?.length) {
      console.log('  Messages:');
      for (const c of convos.reverse()) {
        const dir = c.direction === 'outbound' ? '  →' : '  ←';
        const time = new Date(c.created_at).toLocaleTimeString();
        const body = c.message_body?.substring(0, 90) || '';
        console.log(`    ${dir} [${time}] ${body}`);
      }
    }
    console.log('');
  }
}

async function cleanup() {
  console.log('=== Cleaning up test data ===\n');

  for (const p of TEST_PATIENTS) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name')
      .eq('practice_id', PRACTICE_ID)
      .eq('phone', p.phone)
      .maybeSingle();

    if (!patient) continue;

    // Delete conversations
    const { count: convCount } = await supabase
      .from('conversations')
      .delete({ count: 'exact' })
      .eq('patient_id', patient.id);

    // Delete recall sequences
    const { count: seqCount } = await supabase
      .from('recall_sequences')
      .delete({ count: 'exact' })
      .eq('patient_id', patient.id);

    // Delete noshow sequences
    const { count: noshowCount } = await supabase
      .from('noshow_sequences')
      .delete({ count: 'exact' })
      .eq('patient_id', patient.id);

    console.log(`${p.first_name}: ${convCount || 0} convos, ${seqCount || 0} recall seqs, ${noshowCount || 0} noshow seqs deleted`);

    // Keep the patient record but reset status
    await supabase
      .from('patients')
      .update({ status: 'active', recall_opt_out: false })
      .eq('id', patient.id);
  }

  console.log('\nDone — patients kept, sequences + conversations cleared.');
  console.log('Run "recall" again to start a fresh test.');
}

// Route
switch (command) {
  case 'setup': await setup(); break;
  case 'recall': await recall(); break;
  case 'advance': await advance(); break;
  case 'status': await status(); break;
  case 'cleanup': await cleanup(); break;
  default:
    console.log('Usage: node scripts/test_sms_live.mjs [setup|recall|advance|status|cleanup]');
}

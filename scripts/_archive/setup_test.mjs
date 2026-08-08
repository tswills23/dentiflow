import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PRACTICE_ID = 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function setup() {
  // Step 1: Set twilio_phone on practice
  console.log('Setting twilio_phone on practice...');
  const { data: practice, error: practiceErr } = await supabase
    .from('practices')
    .update({ twilio_phone: '+18333486593' })
    .eq('id', PRACTICE_ID)
    .select()
    .single();

  if (practiceErr) {
    console.error('Failed to update practice:', practiceErr.message);
  } else {
    console.log(`Practice "${practice.name}" twilio_phone set to ${practice.twilio_phone}`);
  }

  // Step 2: Create test patient (Tyler's phone)
  // First check if already exists
  const { data: existing } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .eq('practice_id', PRACTICE_ID)
    .eq('phone', '+16306400029')
    .single();

  if (existing) {
    console.log(`Test patient already exists: ${existing.first_name} ${existing.last_name} (${existing.id})`);
  } else {
    console.log('Creating test patient for Tyler...');
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .insert({
        practice_id: PRACTICE_ID,
        first_name: 'Test',
        last_name: 'Tyler',
        phone: '+16306400029',
        status: 'active',
        source: 'test',
      })
      .select()
      .single();

    if (patientErr) {
      console.error('Failed to create test patient:', patientErr.message);
    } else {
      console.log(`Test patient created: ${patient.first_name} ${patient.last_name} (${patient.id})`);
    }
  }

  console.log('\nDone! Ready for SMS testing.');
}

setup().catch(console.error);

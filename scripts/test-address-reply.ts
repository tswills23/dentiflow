// Verify the recall reply AI now gives the verified address when explicitly
// asked, and still does NOT volunteer it otherwise.
// Use: npx tsx scripts/test-address-reply.ts
import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { generateRecallReply } from '../src/services/recall/recallReplyAI';
import { validateResponse, resolvePracticeAddress } from '../src/services/execution/responseValidator';
import type { Practice, Patient } from '../src/types/database';
import type { RecallSequence, RecallStage, RecallVoice } from '../src/types/recall';

const PID = process.env.DEFAULT_PRACTICE_ID || 'a3f04cf9-54aa-4bd6-939a-d0417c42d941';

async function main() {
  const { data: practice } = await supabase.from('practices').select('*').eq('id', PID).single();
  if (!practice) throw new Error('practice not found');

  const resolved = resolvePracticeAddress(practice as Practice, 'Village Dental');
  console.log(`Resolved address for "Village Dental": ${resolved}\n`);

  // Validator unit check: verified address passes, a different invented one blocks.
  const v1 = validateResponse(`We're at ${resolved}. Want me to get you on the schedule?`, 'identify_practice', practice as Practice);
  const v2 = validateResponse(`We're at 412 Fake Maple Street, Chicago, IL. Come on by.`, 'identify_practice', practice as Practice);
  console.log(`Validator — verified address: ${v1.blocked ? 'BLOCKED ✗' : 'allowed ✓'} (${v1.blockReason || 'ok'})`);
  console.log(`Validator — invented address: ${v2.blocked ? 'blocked ✓' : 'ALLOWED ✗'} (${v2.blockReason || 'ok'})\n`);

  const patient = { id: '00000000-0000-0000-0000-000000000000', first_name: 'Test', last_name: 'Patient', location: 'Village Dental', phone: '+15555550100' } as Patient;
  const sequence = { id: 'seq', practice_id: PID, booking_stage: 'S0_OPENING' } as unknown as RecallSequence;

  const cases: { label: string; msg: string; expectAddress: boolean }[] = [
    { label: 'Niki — "Which city?"', msg: 'Which city?', expectAddress: true },
    { label: 'Maria — "What\'s your address"', msg: "What's your address", expectAddress: true },
    { label: 'Near landmark', msg: 'are you near the Walmart?', expectAddress: true },
    { label: 'Plain yes (should NOT volunteer address)', msg: 'Yes', expectAddress: false },
  ];

  for (const c of cases) {
    const res = await generateRecallReply({
      practice: practice as Practice,
      patient,
      sequence,
      inboundMessage: c.msg,
      bookingStage: 'S0_OPENING' as RecallStage,
      conversationHistory: [],
      bookingLinkUrl: null,
      monthsOverdue: 7,
      voiceTier: 'hygienist' as RecallVoice,
    });
    const reply = res.replyText || '(fell back: ' + res.fallbackReason + ')';
    const hasAddr = /958\s+elk grove town center/i.test(reply);
    const pass = c.expectAddress ? hasAddr : !hasAddr;
    console.log(`${pass ? 'PASS ✓' : 'FAIL ✗'} | ${c.label}`);
    console.log(`   reply: ${reply}`);
    console.log(`   intent=${res.intent} blocked=${res.fellBackToTemplate} reason=${res.validatorBlockReason || res.fallbackReason || '-'}\n`);
  }
  process.exit(0);
}
main();

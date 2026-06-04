// Verify Day 3 deadline A/B: deadline math (+5 days, skip closed days),
// ~50/50 split, hygienist v2-only, gate default off.
// Use: npx tsx scripts/test-day3-deadline.ts
import { computeOfferDeadline, isDay3DeadlineArm, day3DeadlineTestEnabled } from '../src/services/recall/offerDeadline';
import { selectTemplate, getTemplateId, renderTemplate } from '../src/services/recall/templates';
import type { Practice } from '../src/types/database';
import type { SequenceDay } from '../src/types/recall';

const BH = {
  monday: { open: '08:00', close: '17:00' }, tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' }, thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '16:00' }, saturday: null, sunday: null,
};
const practice = { timezone: 'America/Chicago', business_hours: BH, practice_config: {} } as unknown as Practice;

let pass = 0, fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label} | got=${got}${ok ? '' : ` want=${want}`}`);
  ok ? pass++ : fail++;
};

// Deadline math. Day 3 sends at noon CT on the given date; +5 days, then skip closed days.
// Tue 6/2 +5 = Sun 6/7 -> bump to Mon 6/8
check('Tue 6/2 send -> Mon 6/8 (Sun bumped)', computeOfferDeadline('2026-06-02T17:00:00Z', practice), 'Mon 6/8');
// Wed 6/3 +5 = Mon 6/8
check('Wed 6/3 send -> Mon 6/8', computeOfferDeadline('2026-06-03T17:00:00Z', practice), 'Mon 6/8');
// Mon 6/1 +5 = Sat 6/6 -> bump to Mon 6/8
check('Mon 6/1 send -> Mon 6/8 (Sat bumped)', computeOfferDeadline('2026-06-01T17:00:00Z', practice), 'Mon 6/8');
// Thu 6/4 +5 = Tue 6/9 (open)
check('Thu 6/4 send -> Tue 6/9', computeOfferDeadline('2026-06-04T17:00:00Z', practice), 'Tue 6/9');
// Sat 6/6 send +5 = Thu 6/11 (open)
check('Sat 6/6 send -> Thu 6/11', computeOfferDeadline('2026-06-06T17:00:00Z', practice), 'Thu 6/11');

// Gate default off (empty config)
check('gate default OFF', day3DeadlineTestEnabled(practice), false);
check('gate ON when flagged', day3DeadlineTestEnabled({ ...practice, practice_config: { day3_deadline_test: true } } as unknown as Practice), true);

// ~50/50 split across many phones
let arm = 0; const N = 4000;
for (let i = 0; i < N; i++) if (isDay3DeadlineArm(`+1312555${String(1000 + i).padStart(4, '0')}`)) arm++;
const pct = (arm / N * 100);
check('split ~50% (45-55)', pct > 45 && pct < 55, true);
console.log(`   (deadline arm = ${pct.toFixed(1)}%)`);

// Hygienist Day 3 is v2 only — try many phones, all must be v2
let allV2 = true;
for (let i = 0; i < 200; i++) {
  const id = getTemplateId('hygienist', 3 as SequenceDay, `+1773555${String(2000 + i).padStart(4, '0')}`);
  if (!id.startsWith('hygienist_day3_v2')) { allV2 = false; break; }
}
check('hygienist Day 3 always v2', allV2, true);

// Deadline template renders the offer deadline; control does not contain the token
const tplDeadline = selectTemplate('office', 3 as SequenceDay, '+13125550001', null, true);
const renderedDeadline = renderTemplate(tplDeadline, 'Sam', 'Village Dental', 'Philip', 'hygiene team', 'https://x/r/abc', 'Mon 6/8');
check('deadline copy contains the date', renderedDeadline.includes('Mon 6/8'), true);
check('deadline copy contains 30% off', renderedDeadline.includes('30% off'), true);
check('no leftover {{Offer Deadline}} token', !renderedDeadline.includes('{{Offer Deadline}}'), true);
const tplControl = selectTemplate('office', 3 as SequenceDay, '+13125550001', null, false);
check('control copy has NO deadline token', !tplControl.body.includes('{{Offer Deadline}}'), true);
console.log(`\n   sample deadline send: ${renderedDeadline}`);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

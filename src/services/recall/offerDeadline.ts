// Day 3 "30% off" deadline A/B test helpers.
//
// - The deadline auto-fills as (Day 3 send date + 5 days), in the practice
//   timezone. If it lands on a day the practice is closed (per business_hours),
//   it advances to the next open day.
// - The test is gated OFF by default (practice_config.day3_deadline_test).
//   When ON, ~half the patients (deterministic phone hash) get the deadline
//   copy; the other half get the standard offer copy.
import { createHash } from 'crypto';
import type { Practice } from '../../types/database';

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Is the deadline A/B test turned on for this practice? Default false.
export function day3DeadlineTestEnabled(practice: Practice): boolean {
  const cfg = practice.practice_config as Record<string, unknown> | null | undefined;
  return cfg?.day3_deadline_test === true;
}

// Deterministic ~50/50 split. Uses a different slice of the phone hash than the
// v1/v2 variant selection (substring 0-8), so the arm is independent of variant.
export function isDay3DeadlineArm(phone: string): boolean {
  const hash = createHash('md5').update(phone).digest('hex');
  return parseInt(hash.substring(8, 16), 16) % 2 === 0;
}

// Compute the offer deadline string, e.g. "Wed 6/11".
// sentAtISO = when the Day 3 message went out. daysOut defaults to 5.
export function computeOfferDeadline(sentAtISO: string, practice: Practice, daysOut = 5): string {
  const tz = practice.timezone || 'America/Chicago';

  // Civil (calendar) date of the send moment in the practice timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(sentAtISO));
  const y = Number(parts.find(p => p.type === 'year')!.value);
  const m = Number(parts.find(p => p.type === 'month')!.value);
  const d = Number(parts.find(p => p.type === 'day')!.value);

  // Work in a pure UTC calendar date to avoid DST drift, then add the window.
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + daysOut);

  // Advance off any closed day (business_hours[weekday] is null/absent).
  const hours = (practice.business_hours as unknown as Record<string, unknown> | null | undefined) || {};
  for (let guard = 0; guard < 14; guard++) {
    const key = WEEKDAY_KEYS[dt.getUTCDay()];
    if (hours[key]) break; // truthy = open
    dt.setUTCDate(dt.getUTCDate() + 1);
  }

  return `${WEEKDAY_SHORT[dt.getUTCDay()]} ${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

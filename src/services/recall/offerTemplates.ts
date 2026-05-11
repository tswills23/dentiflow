// Arm B (offer_only) template bank for the 2026-05-11 A/B launch.
// Single Day 0 message, no follow-ups. Sequence auto-exits 7 days after send.
//
// Hardcoded practice name + phone per the offer copy approved by the user.
// Booking link uses the standard {{Booking Link}} placeholder so it routes
// through our tracked redirect (/r/<token>) for click attribution, then
// 302s to practices.booking_url (Dentrix Ascend).

import type { RecallTemplate } from '../../types/recall';

export const OFFER_DAY0: RecallTemplate = {
  subject: '',
  body: `32 Village Dental in Elk Grove Village has missed seeing your smile! For a limited time, we're offering 30% off your recommended treatment plan—call us today at 847.364.5100 or click to schedule your visit and get back on track with your dental health. {{Booking Link}}`,
};

export const OFFER_TEMPLATE_ID = 'offer_only_day0';

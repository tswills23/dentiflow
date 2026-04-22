// Segment Agent
// Pure function: CSV text → segmented patient list
// No database reads or writes. No side effects.
//
// Responsibilities:
//   1. Parse CSV using production csvParser
//   2. Normalize phones, dedup, filter test patients
//   3. Assign voice tier and overdue segment via production voiceAssignment
//   4. Return enriched SegmentedRecord[] with summary stats
//
// recall_eligible means: "overdue, no upcoming appointment"
// Nothing about sequences or sends — that's a downstream concern.

import { parseRecallCsv } from './csvParser';
import { assignVoiceFromLastVisit } from './voiceAssignment';
import { normalizePhone } from './phoneUtils';
import type { SegmentedRecord, SegmentAgentResult } from '../../types/recall';

export function runSegmentAgent(csvText: string): SegmentAgentResult {
  const result: SegmentAgentResult = {
    records: [],
    skippedNextAppt: 0,
    skippedDuplicate: 0,
    skippedInvalidPhone: 0,
    skippedTest: 0,
    parseErrors: [],
    byLocation: {},
    byVoice: {},
    bySegment: {},
  };

  // Step 1: Parse CSV using production parser
  const { records: parsed, skipped: csvSkipped, errors: csvErrors } = parseRecallCsv(csvText);
  result.skippedNextAppt = csvSkipped;
  result.parseErrors = csvErrors;

  // Step 2: Dedup, normalize, filter
  const seenPhones = new Set<string>();

  for (const rec of parsed) {
    // Filter test patients
    if (
      rec.firstName?.toLowerCase() === 'test' ||
      rec.lastName?.toLowerCase() === 'test'
    ) {
      result.skippedTest++;
      continue;
    }

    // Normalize phone
    const phone = normalizePhone(rec.phone);
    if (!phone) {
      result.skippedInvalidPhone++;
      continue;
    }

    // Dedup by phone
    if (seenPhones.has(phone)) {
      result.skippedDuplicate++;
      continue;
    }
    seenPhones.add(phone);

    // Step 3: Voice + segment assignment
    const lastVisit = rec.lastVisitDate ? new Date(rec.lastVisitDate) : null;
    const { segment, voice, monthsOverdue } = assignVoiceFromLastVisit(lastVisit);

    const enriched: SegmentedRecord = {
      firstName: rec.firstName,
      lastName: rec.lastName,
      phone,
      email: rec.email,
      lastVisitDate: rec.lastVisitDate,
      location: rec.location,
      monthsOverdue: Math.round(monthsOverdue * 10) / 10,
      voice,
      segment,
    };

    result.records.push(enriched);

    // Accumulate summary stats
    const loc = rec.location || '(none)';
    result.byLocation[loc] = (result.byLocation[loc] || 0) + 1;
    result.byVoice[voice] = (result.byVoice[voice] || 0) + 1;
    result.bySegment[segment] = (result.bySegment[segment] || 0) + 1;
  }

  return result;
}

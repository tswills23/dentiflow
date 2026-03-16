// Voice Assignment for Recall Engine
// Ported from execution/assign_voice.py
//
// HARD RULES (never change):
// - < 6 months overdue        → office voice
// - ≥ 6 months and < 12 months → hygienist voice
// - ≥ 12 months overdue       → doctor voice

import type { RecallVoice, OverdueSegment } from '../../types/recall';

const AVG_DAYS_PER_MONTH = 30.44;

const VOICE_MAP: Record<OverdueSegment, RecallVoice> = {
  lt_6: 'office',
  gte_6_lt_12: 'hygienist',
  gte_12: 'doctor',
};

export function calculateMonthsOverdue(lastVisitDate: Date | null): number {
  if (!lastVisitDate) return 24.0; // No visit date → assume very overdue

  const daysOverdue = (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysOverdue / AVG_DAYS_PER_MONTH;
}

export function calculateSegment(lastVisitDate: Date | null): OverdueSegment {
  const months = calculateMonthsOverdue(lastVisitDate);

  if (months < 6) return 'lt_6';
  if (months < 12) return 'gte_6_lt_12';
  return 'gte_12';
}

export function assignVoice(segment: OverdueSegment): RecallVoice {
  return VOICE_MAP[segment] ?? 'office';
}

export function assignVoiceFromLastVisit(lastVisitDate: Date | null): {
  segment: OverdueSegment;
  voice: RecallVoice;
  monthsOverdue: number;
} {
  const monthsOverdue = calculateMonthsOverdue(lastVisitDate);
  const segment = calculateSegment(lastVisitDate);
  const voice = assignVoice(segment);

  return { segment, voice, monthsOverdue };
}

// Slot Selector for Recall Booking Agent
// Ported from execution/booking_agent/slot_selector.py
//
// Implements BALANCED slot selection that distributes slots
// across requested days instead of returning the first N chronologically.
//
// THE BUG BEING FIXED:
//   Old behavior: "Tuesday and Thursday" → all 5 slots are Tuesday
//   New behavior: "Tuesday and Thursday" → 2-3 Tuesday + 2-3 Thursday slots

import type {
  AvailableSlot,
  TimePreferences,
  TimeOfDay,
  DayOfWeek,
} from '../../types/recall';

// =============================================================================
// Configuration
// =============================================================================

const OFFICE_HOURS: Record<string, [number, number][]> = {
  morning: [[9, 0], [10, 0], [11, 0]],
  afternoon: [[14, 0], [15, 0], [16, 0]],
  evening: [[17, 0], [18, 0]],
};

const OPEN_DAYS = [1, 2, 3, 4, 5]; // Mon=1 through Fri=5 (JS Date.getDay: 0=Sun)
const LOOKAHEAD_DAYS = 14;
const DEFAULT_NUM_SLOTS = 3;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// =============================================================================
// Slot Generation
// =============================================================================

interface RawSlot {
  datetime: Date;
  dayName: string;
  timeOfDay: string;
}

function generateAllSlots(startDate?: Date): RawSlot[] {
  let start = startDate ?? new Date();
  if (!startDate) {
    // Default to tomorrow at midnight
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  }

  const slots: RawSlot[] = [];

  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = date.getDay();

    if (!OPEN_DAYS.includes(dayOfWeek)) continue;

    const dayName = DAY_NAMES[dayOfWeek];

    // Morning slots
    for (const [hour, minute] of OFFICE_HOURS.morning) {
      const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
      slots.push({ datetime: dt, dayName, timeOfDay: 'morning' });
    }

    // Afternoon slots
    for (const [hour, minute] of OFFICE_HOURS.afternoon) {
      const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
      slots.push({ datetime: dt, dayName, timeOfDay: 'afternoon' });
    }
  }

  return slots;
}

function filterByPreferences(slots: RawSlot[], prefs: TimePreferences): RawSlot[] {
  let filtered = [...slots];

  // Filter by time of day
  if (prefs.timeOfDay !== 'any') {
    filtered = filtered.filter((s) => s.timeOfDay === prefs.timeOfDay);
  }

  // Filter by preferred days
  if (prefs.days.length > 0) {
    filtered = filtered.filter((s) => prefs.days.includes(s.dayName as DayOfWeek));
  }

  // Exclude specific days
  if (prefs.excludedDays.length > 0) {
    filtered = filtered.filter((s) => !prefs.excludedDays.includes(s.dayName as DayOfWeek));
  }

  return filtered;
}

function selectBalancedSlots(
  filteredSlots: RawSlot[],
  requestedDays: string[],
  numSlots: number
): RawSlot[] {
  if (filteredSlots.length === 0) return [];

  if (requestedDays.length === 0) {
    // No day preference — first N chronologically
    return filteredSlots
      .sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
      .slice(0, numSlots);
  }

  // Group by day name
  const slotsByDay: Record<string, RawSlot[]> = {};
  for (const slot of filteredSlots) {
    if (requestedDays.includes(slot.dayName)) {
      if (!slotsByDay[slot.dayName]) slotsByDay[slot.dayName] = [];
      slotsByDay[slot.dayName].push(slot);
    }
  }

  if (Object.keys(slotsByDay).length === 0) return [];

  // Sort within each day
  for (const day of Object.keys(slotsByDay)) {
    slotsByDay[day].sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  }

  // Round-robin selection
  const selected: RawSlot[] = [];
  const dayIndices: Record<string, number> = {};
  for (const day of Object.keys(slotsByDay)) dayIndices[day] = 0;

  while (selected.length < numSlots) {
    let addedThisRound = false;

    for (const day of requestedDays) {
      if (!(day in slotsByDay)) continue;
      const idx = dayIndices[day];
      const daySlots = slotsByDay[day];

      if (idx < daySlots.length && selected.length < numSlots) {
        selected.push(daySlots[idx]);
        dayIndices[day]++;
        addedThisRound = true;
      }
    }

    if (!addedThisRound) break;
  }

  // Sort final selection by datetime
  selected.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

  return selected;
}

function formatSlot(slot: RawSlot): AvailableSlot {
  const dt = slot.datetime;
  const hours = dt.getHours();
  const minutes = dt.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const timeDisplay = `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  const dateDisplay = `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const slotId = `slot_${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}_${pad(hours)}${pad(minutes)}`;

  return {
    slotId,
    datetimeIso: dt.toISOString(),
    dayName: slot.dayName,
    dateDisplay,
    timeDisplay,
    fullDisplay: `${slot.dayName}, ${dateDisplay} at ${timeDisplay}`,
    timeOfDay: slot.timeOfDay as TimeOfDay,
  };
}

// =============================================================================
// Main Entry Point
// =============================================================================

export function getAvailableSlots(
  preferences: TimePreferences,
  numSlots: number = DEFAULT_NUM_SLOTS,
  startDate?: Date
): AvailableSlot[] {
  const allSlots = generateAllSlots(startDate);
  const filtered = filterByPreferences(allSlots, preferences);
  const requestedDays = preferences.days;
  const selected = selectBalancedSlots(filtered, requestedDays, numSlots);
  return selected.map(formatSlot);
}

export function getDefaultSlots(numSlots: number = DEFAULT_NUM_SLOTS): AvailableSlot[] {
  return getAvailableSlots(
    { days: [], timeOfDay: 'any', excludedDays: [], rawText: '' },
    numSlots
  );
}

export function slotsToDisplayList(slots: AvailableSlot[]): string {
  return slots.map((slot, i) => `  ${i + 1}. ${slot.fullDisplay}`).join('\n');
}

export function getSlotByNumber(
  slots: AvailableSlot[],
  number: number
): AvailableSlot | null {
  if (number >= 1 && number <= slots.length) return slots[number - 1];
  return null;
}

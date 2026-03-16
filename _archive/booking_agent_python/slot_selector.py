"""
Slot Selection for Dentiflow Booking Agent V4.

This module implements BALANCED slot selection that distributes slots
across requested days instead of returning the first N chronologically.

THE BUG BEING FIXED:
    Old behavior: "Tuesday and Thursday" → all 5 slots are Tuesday
    New behavior: "Tuesday and Thursday" → 2-3 Tuesday + 2-3 Thursday slots

Algorithm:
    1. Generate all available slots for next 14 days
    2. Filter by patient preferences (days, time of day)
    3. Group by day of week
    4. Round-robin select from each requested day
    5. Sort final selection by datetime for presentation
"""

from typing import List, Dict, Optional
from collections import defaultdict
from datetime import datetime, timedelta
import math

from .schemas import (
    AvailableSlot,
    TimePreferences,
    TimeOfDay,
    DayOfWeek,
)


# =============================================================================
# Configuration
# =============================================================================

# Office hours
OFFICE_HOURS = {
    'morning': [(9, 0), (10, 0), (11, 0)],      # 9am, 10am, 11am
    'afternoon': [(14, 0), (15, 0), (16, 0)],   # 2pm, 3pm, 4pm
    'evening': [(17, 0), (18, 0)],              # 5pm, 6pm (if offered)
}

# Days the office is open (0=Monday, 6=Sunday)
OPEN_DAYS = [0, 1, 2, 3, 4]  # Mon-Fri by default

# How far ahead to look for slots
LOOKAHEAD_DAYS = 14

# Default number of slots to return
DEFAULT_NUM_SLOTS = 3


# =============================================================================
# Core Functions
# =============================================================================

def generate_all_slots(
    start_date: Optional[datetime] = None,
    lookahead_days: int = LOOKAHEAD_DAYS,
    open_days: List[int] = OPEN_DAYS,
) -> List[Dict]:
    """
    Generate all possible appointment slots for the lookahead period.

    Args:
        start_date: Starting date (defaults to tomorrow)
        lookahead_days: How many days ahead to generate
        open_days: List of weekday numbers (0=Mon, 6=Sun)

    Returns:
        List of raw slot dicts with datetime, day_name, time_of_day
    """
    if start_date is None:
        start_date = datetime.now() + timedelta(days=1)
        # Start from beginning of day
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

    all_slots = []

    for i in range(lookahead_days):
        date = start_date + timedelta(days=i)

        # Skip closed days
        if date.weekday() not in open_days:
            continue

        day_name = date.strftime('%A')

        # Generate morning slots
        for hour, minute in OFFICE_HOURS['morning']:
            slot_dt = date.replace(hour=hour, minute=minute)
            all_slots.append({
                'datetime': slot_dt,
                'day_name': day_name,
                'time_of_day': 'morning',
            })

        # Generate afternoon slots
        for hour, minute in OFFICE_HOURS['afternoon']:
            slot_dt = date.replace(hour=hour, minute=minute)
            all_slots.append({
                'datetime': slot_dt,
                'day_name': day_name,
                'time_of_day': 'afternoon',
            })

    return all_slots


def filter_slots_by_preferences(
    all_slots: List[Dict],
    preferences: TimePreferences,
) -> List[Dict]:
    """
    Filter slots by patient preferences.

    Args:
        all_slots: All available slots
        preferences: Patient's time preferences

    Returns:
        Filtered list of slots matching preferences
    """
    filtered = all_slots.copy()

    # Filter by time of day
    if preferences.time_of_day != TimeOfDay.ANY:
        time_pref = preferences.time_of_day.value
        filtered = [s for s in filtered if s['time_of_day'] == time_pref]

    # Filter by preferred days
    if preferences.days:
        day_names = [d.value for d in preferences.days]
        filtered = [s for s in filtered if s['day_name'] in day_names]

    # Exclude specific days
    if preferences.excluded_days:
        excluded_names = [d.value for d in preferences.excluded_days]
        filtered = [s for s in filtered if s['day_name'] not in excluded_names]

    return filtered


def select_balanced_slots(
    filtered_slots: List[Dict],
    requested_days: List[str],
    num_slots: int = DEFAULT_NUM_SLOTS,
) -> List[Dict]:
    """
    Select slots BALANCED across requested days.

    This is the key fix for the Tuesday-only bug. Instead of taking
    the first N slots chronologically (which are all the same day),
    we round-robin across requested days.

    Algorithm:
        1. Group slots by day of week
        2. Round-robin select from each day
        3. Sort final selection by datetime

    Args:
        filtered_slots: Slots already filtered by time preference
        requested_days: List of day names (e.g., ['Tuesday', 'Thursday'])
        num_slots: Number of slots to return

    Returns:
        Balanced selection of slots across days

    Example:
        Input: filtered_slots with Tue/Thu slots, num_slots=5
        Output: [Tue 2pm, Thu 2pm, Tue 3pm, Thu 3pm, Tue 4pm]
        NOT:    [Tue 2pm, Tue 3pm, Tue 4pm, Tue 9am, Tue 10am]
    """
    if not filtered_slots:
        return []

    if not requested_days:
        # No specific day preference - return first N chronologically
        # (sorted by datetime)
        sorted_slots = sorted(filtered_slots, key=lambda s: s['datetime'])
        return sorted_slots[:num_slots]

    # Group slots by day name
    slots_by_day: Dict[str, List[Dict]] = defaultdict(list)
    for slot in filtered_slots:
        if slot['day_name'] in requested_days:
            slots_by_day[slot['day_name']].append(slot)

    if not slots_by_day:
        # No matching slots for requested days
        return []

    # Sort slots within each day by datetime
    for day in slots_by_day:
        slots_by_day[day].sort(key=lambda s: s['datetime'])

    # Round-robin selection
    selected = []
    day_indices = {day: 0 for day in slots_by_day}

    # Keep selecting until we have enough or run out
    while len(selected) < num_slots:
        added_this_round = False

        # Go through requested days in order
        for day in requested_days:
            if day not in slots_by_day:
                continue

            idx = day_indices[day]
            day_slots = slots_by_day[day]

            if idx < len(day_slots) and len(selected) < num_slots:
                selected.append(day_slots[idx])
                day_indices[day] += 1
                added_this_round = True

        # If we couldn't add any slots this round, we're out
        if not added_this_round:
            break

    # Sort final selection by datetime for presentation
    selected.sort(key=lambda s: s['datetime'])

    return selected


def format_slot(slot: Dict) -> AvailableSlot:
    """
    Convert raw slot dict to AvailableSlot schema.

    Args:
        slot: Raw slot dict with datetime, day_name, time_of_day

    Returns:
        Formatted AvailableSlot object
    """
    dt = slot['datetime']

    return AvailableSlot(
        slot_id=f"slot_{dt.strftime('%Y%m%d_%H%M')}",
        datetime_iso=dt.isoformat(),
        day_name=slot['day_name'],
        date_display=dt.strftime('%B %d'),
        time_display=dt.strftime('%I:%M %p').lstrip('0'),
        full_display=f"{slot['day_name']}, {dt.strftime('%B %d')} at {dt.strftime('%I:%M %p').lstrip('0')}",
        time_of_day=TimeOfDay(slot['time_of_day']),
    )


# =============================================================================
# Main Entry Point
# =============================================================================

def get_available_slots(
    preferences: TimePreferences,
    num_slots: int = DEFAULT_NUM_SLOTS,
    start_date: Optional[datetime] = None,
) -> List[AvailableSlot]:
    """
    Get available slots based on patient preferences.

    This is the main entry point. It:
    1. Generates all possible slots
    2. Filters by preferences
    3. Selects balanced slots across requested days
    4. Formats for output

    Args:
        preferences: Patient's time preferences
        num_slots: Number of slots to return (default 3)
        start_date: Starting date (default tomorrow)

    Returns:
        List of formatted AvailableSlot objects
    """
    # Generate all slots
    all_slots = generate_all_slots(start_date=start_date)

    # Filter by preferences
    filtered = filter_slots_by_preferences(all_slots, preferences)

    # Get requested day names
    requested_days = [d.value for d in preferences.days] if preferences.days else []

    # Select balanced slots
    selected = select_balanced_slots(filtered, requested_days, num_slots)

    # Format for output
    return [format_slot(s) for s in selected]


def get_default_slots(num_slots: int = DEFAULT_NUM_SLOTS) -> List[AvailableSlot]:
    """
    Get default slots when no preferences specified.

    Returns first N available slots chronologically.
    """
    return get_available_slots(
        preferences=TimePreferences(raw_text=""),
        num_slots=num_slots,
    )


# =============================================================================
# Utility Functions
# =============================================================================

def slots_to_display_list(slots: List[AvailableSlot]) -> str:
    """
    Format slots as numbered list for email.

    Example:
        1. Tuesday, January 21 at 2:00 PM
        2. Thursday, January 23 at 2:00 PM
        3. Tuesday, January 21 at 3:00 PM
    """
    lines = []
    for i, slot in enumerate(slots, 1):
        lines.append(f"  {i}. {slot.full_display}")
    return '\n'.join(lines)


def get_slot_by_number(
    slots: List[AvailableSlot],
    number: int,
) -> Optional[AvailableSlot]:
    """
    Get slot by selection number (1-indexed).

    Args:
        slots: List of offered slots
        number: Patient's selection (1, 2, or 3)

    Returns:
        Selected slot or None if invalid number
    """
    if 1 <= number <= len(slots):
        return slots[number - 1]
    return None


# =============================================================================
# Testing
# =============================================================================

if __name__ == "__main__":
    # Test the balanced slot selection
    print("Testing balanced slot selection...\n")

    # Test case: Tuesday and Thursday afternoons
    prefs = TimePreferences(
        days=[DayOfWeek.TUESDAY, DayOfWeek.THURSDAY],
        time_of_day=TimeOfDay.AFTERNOON,
        raw_text="Tuesday and Thursday afternoons",
    )

    slots = get_available_slots(prefs, num_slots=5)

    print(f"Preferences: {prefs.raw_text}")
    print(f"Days requested: {[d.value for d in prefs.days]}")
    print(f"Time of day: {prefs.time_of_day.value}")
    print(f"\nSlots returned ({len(slots)}):")
    print(slots_to_display_list(slots))

    # Verify balance
    day_counts = defaultdict(int)
    for slot in slots:
        day_counts[slot.day_name] += 1

    print(f"\nDay distribution: {dict(day_counts)}")

    # Check if balanced
    if len(day_counts) > 1:
        counts = list(day_counts.values())
        max_diff = max(counts) - min(counts)
        if max_diff <= 1:
            print("PASS: Slots are balanced across days")
        else:
            print(f"FAIL: Slots not balanced (diff={max_diff})")
    else:
        print("WARN: Only one day in results (might be expected)")

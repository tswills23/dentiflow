#!/usr/bin/env python3
"""
Voice Assignment for Recall V2

Deterministically assigns voice based on how overdue a patient is.
Voice is assigned ONCE at Day 0 and NEVER changes during the sequence.

HARD RULES:
- < 6 months overdue        → office voice
- ≥ 6 months and < 12 months → hygienist voice
- ≥ 12 months overdue       → doctor voice
"""

from datetime import datetime


def calculate_months_overdue(last_visit_date):
    """
    Calculate months since last visit

    Args:
        last_visit_date: datetime object

    Returns:
        float: Months overdue (30.44 days per month average)
    """
    if not last_visit_date:
        # If no visit date, assume very overdue (default to doctor voice)
        return 24.0

    days_overdue = (datetime.now() - last_visit_date).days
    months_overdue = days_overdue / 30.44  # Average days per month

    return months_overdue


def calculate_segment_overdue(last_visit_date):
    """
    Calculate segment bucket based on months overdue

    Args:
        last_visit_date: datetime object

    Returns:
        str: "lt_6" | "gte_6_lt_12" | "gte_12"
    """
    months_overdue = calculate_months_overdue(last_visit_date)

    if months_overdue < 6:
        return "lt_6"
    elif months_overdue < 12:
        return "gte_6_lt_12"
    else:
        return "gte_12"


def assign_voice(segment_overdue):
    """
    Assign voice based on segment (HARD RULE - never changes)

    Args:
        segment_overdue: str ("lt_6" | "gte_6_lt_12" | "gte_12")

    Returns:
        str: "office" | "hygienist" | "doctor"
    """
    voice_map = {
        "lt_6": "office",
        "gte_6_lt_12": "hygienist",
        "gte_12": "doctor"
    }

    return voice_map.get(segment_overdue, "office")  # Default to office if unknown


def assign_voice_from_last_visit(last_visit_date):
    """
    Convenience function: Calculate segment and assign voice in one step

    Args:
        last_visit_date: datetime object

    Returns:
        tuple: (segment_overdue, assigned_voice, months_overdue)

    Example:
        >>> from datetime import datetime, timedelta
        >>> last_visit = datetime.now() - timedelta(days=200)
        >>> segment, voice, months = assign_voice_from_last_visit(last_visit)
        >>> print(f"{months:.1f} months overdue → {voice} voice ({segment})")
        6.6 months overdue → hygienist voice (gte_6_lt_12)
    """
    months_overdue = calculate_months_overdue(last_visit_date)
    segment_overdue = calculate_segment_overdue(last_visit_date)
    assigned_voice = assign_voice(segment_overdue)

    return segment_overdue, assigned_voice, months_overdue


# Example usage for testing
if __name__ == '__main__':
    from datetime import timedelta

    test_cases = [
        ("3 months overdue", datetime.now() - timedelta(days=90)),
        ("6 months overdue", datetime.now() - timedelta(days=180)),
        ("8 months overdue", datetime.now() - timedelta(days=240)),
        ("12 months overdue", datetime.now() - timedelta(days=365)),
        ("18 months overdue", datetime.now() - timedelta(days=540)),
    ]

    print("Voice Assignment Test Cases:")
    print("=" * 60)

    for label, last_visit in test_cases:
        segment, voice, months = assign_voice_from_last_visit(last_visit)
        print(f"{label:20} → {voice:10} voice ({segment}, {months:.1f}mo)")

    print("\nExpected Results:")
    print("  0-5.99 months  → office voice")
    print("  6-11.99 months → hygienist voice")
    print("  12+ months     → doctor voice")

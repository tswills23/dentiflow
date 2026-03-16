"""
Intent Classification for Dentiflow Booking Agent V4.

Classifies patient messages into intents for state machine routing.

Key Design Principles:
1. CONTEXT-AWARE: Same words mean different things in different stages
   - "yes" in S0_OPENING = booking_interest
   - "yes" in S4_AVAILABILITY = confirm
2. PRIORITY-ORDERED: Check high-impact intents first (opt_out > urgent)
3. KEYWORD-SPECIFIC: Remove overlapping keywords between intents
"""

from typing import List, Tuple, Dict, Optional
import re
from difflib import SequenceMatcher

from .schemas import (
    Intent,
    Stage,
    IntentClassification,
    TimePreferences,
    TimeOfDay,
    DayOfWeek,
)


# =============================================================================
# Keyword Definitions (NO OVERLAPS between intents)
# =============================================================================

# OPT_OUT: Permanent unsubscribe (highest priority)
OPT_OUT_KEYWORDS = [
    'unsubscribe', 'opt out', 'opt-out', 'optout', 'remove me',
    'stop emailing', 'stop texting', 'stop contacting', 'stop messaging',
    'dont contact', "don't contact", 'do not contact', 'leave me alone',
    'take me off', 'remove from list', 'no more emails', 'spam',
]

# URGENT: Pain/emergency - handoff to human
URGENT_KEYWORDS = [
    'pain', 'painful', 'hurts', 'hurt', 'hurting', 'ache', 'aching',
    'emergency', 'urgent', 'asap', 'bleeding', 'blood', 'swollen',
    'swelling', 'broken', 'cracked', 'chipped', 'infection', 'abscess',
]

# COST_QUESTION: Price/insurance - handoff to human
COST_KEYWORDS = [
    'cost', 'price', 'how much', 'insurance', 'coverage', 'copay',
    'deductible', 'payment plan', 'payment option', 'payment', 'afford',
    'expensive', 'fee', 'financing', 'estimate', 'quote', 'ballpark',
]

# NOT_NOW: Deferral
NOT_NOW_KEYWORDS = [
    'not right now', 'not now', 'maybe later', 'check back',
    'remind me later', 'not a good time', 'another time',
    'in a few months', 'reach out later', 'not this month',
    'too busy', 'im busy', "i'm busy", 'busy right now',
]

# DECLINE: Soft no
DECLINE_KEYWORDS = [
    'no thanks', 'no thank you', 'not interested', 'pass',
    'already have a dentist', 'have a dentist', 'no longer a patient',
    "i'm good", 'im good', "i'm all set", 'all set', 'no need',
]

# CONFIRM: Positive affirmation (ONLY in S4/S5 context)
# Note: These should NOT match in S0_OPENING
CONFIRM_KEYWORDS = [
    'sounds good', 'that works', 'works for me', 'perfect',
    'awesome', 'great', "let's do it", 'lets do it', 'book it',
    'confirmed', 'confirm',
]

# BOOKING_INTEREST: General interest (for S0_OPENING)
BOOKING_INTEREST_KEYWORDS = [
    'book', 'schedule', 'appointment', 'interested',
    "i'd like", 'id like', 'i would like', 'sign me up',
    'count me in', 'put me down', 'get scheduled', 'come in',
    'cleaning', 'cleanings', 'checkup', 'check-up', 'exam',
    'i need', 'need to',
]

# ASKING_AVAILABILITY: Wants to see times
ASKING_AVAILABILITY_KEYWORDS = [
    'what times', 'what time', 'available', 'availability',
    'do you have', 'any openings', 'any slots', 'what days',
    'show me', 'let me see', 'what options', 'what are my options',
]

# SHORT POSITIVE: "yes", "yeah", "sure", "ok" - context-dependent
SHORT_POSITIVE = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay']

# Multi-word short positive phrases
SHORT_POSITIVE_PHRASES = [
    'sure thing', 'yes please', 'yep please', 'yeah please',
    'sounds good', 'works for me', 'that works',
]

# SLOT SELECTION patterns
SLOT_EXACT = ['1', '2', '3', 'one', 'two', 'three']
SLOT_PHRASES = [
    'option 1', 'option 2', 'option 3',
    'number 1', 'number 2', 'number 3',
    '#1', '#2', '#3',
    'first', 'second', 'third',
    'first one', 'second one', 'third one',
    'the first', 'the second', 'the third',
]

# Day and time mappings
DAY_MAPPINGS = {
    'monday': DayOfWeek.MONDAY, 'mon': DayOfWeek.MONDAY,
    'tuesday': DayOfWeek.TUESDAY, 'tues': DayOfWeek.TUESDAY, 'tue': DayOfWeek.TUESDAY,
    'wednesday': DayOfWeek.WEDNESDAY, 'wed': DayOfWeek.WEDNESDAY, 'weds': DayOfWeek.WEDNESDAY,
    'thursday': DayOfWeek.THURSDAY, 'thurs': DayOfWeek.THURSDAY, 'thu': DayOfWeek.THURSDAY,
    'friday': DayOfWeek.FRIDAY, 'fri': DayOfWeek.FRIDAY,
    'saturday': DayOfWeek.SATURDAY, 'sat': DayOfWeek.SATURDAY,
    'sunday': DayOfWeek.SUNDAY, 'sun': DayOfWeek.SUNDAY,
}

TIME_MAPPINGS = {
    'morning': TimeOfDay.MORNING, 'mornings': TimeOfDay.MORNING,
    'afternoon': TimeOfDay.AFTERNOON, 'afternoons': TimeOfDay.AFTERNOON,
    'evening': TimeOfDay.EVENING, 'evenings': TimeOfDay.EVENING,
}

POSITIVE_EMOJIS = ['\U0001f44d', '\u2705', '\U0001f44c', '\U0001f642', '\U0001f60a', '\U0001f600', '\U0001f389', '\U0001f4af', '\u2714\ufe0f', '\u263a\ufe0f', '\U0001f44f']


# =============================================================================
# Intent Classifier
# =============================================================================

class IntentClassifier:
    """Context-aware intent classifier."""

    def classify(
        self,
        text: str,
        current_stage: Stage,
    ) -> IntentClassification:
        """
        Classify intent with full context awareness.

        The same text can produce different intents based on stage:
        - "yes" in S0 = booking_interest
        - "yes" in S4 = confirm
        """
        text_lower = text.lower().strip()
        text_clean = re.sub(r'[^\w\s]', '', text_lower)  # Remove punctuation

        # Check for emoji-only messages FIRST (before empty check)
        # This handles thumbs up, check mark, etc. that would otherwise be stripped
        emoji_match = self._check_emojis(text)
        if emoji_match and not text_clean.strip():
            # Emoji only - treat as confirm if in S4, otherwise unclear
            if current_stage == Stage.S4_AVAILABILITY:
                return IntentClassification(
                    intent=Intent.CONFIRM,
                    confidence='high',
                    matched_keywords=emoji_match,
                    raw_text=text,
                )

        # Empty/whitespace (and no emoji) -> unclear
        if not text_clean:
            return IntentClassification(
                intent=Intent.UNCLEAR,
                confidence='low',
                matched_keywords=[],
                raw_text=text,
            )

        # =============================================================
        # 1. ALWAYS CHECK: Opt-out (highest priority, any stage)
        # =============================================================
        if self._match_any(text_lower, OPT_OUT_KEYWORDS):
            return IntentClassification(
                intent=Intent.OPT_OUT,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, OPT_OUT_KEYWORDS),
                raw_text=text,
            )

        # =============================================================
        # 2. CHECK COST before URGENT (cost is more specific)
        # =============================================================
        if self._match_any(text_lower, COST_KEYWORDS):
            return IntentClassification(
                intent=Intent.COST_QUESTION,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, COST_KEYWORDS),
                raw_text=text,
            )

        # =============================================================
        # 3. URGENT (pain, emergency)
        # =============================================================
        if self._match_any(text_lower, URGENT_KEYWORDS):
            return IntentClassification(
                intent=Intent.URGENT,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, URGENT_KEYWORDS),
                raw_text=text,
            )

        # =============================================================
        # 4. STAGE-SPECIFIC: S4_AVAILABILITY
        # =============================================================
        if current_stage == Stage.S4_AVAILABILITY:
            # Slot selection (1, 2, 3)
            slot_match = self._check_slot_selection(text_clean)
            if slot_match:
                return IntentClassification(
                    intent=Intent.SLOT_SELECTION,
                    confidence='high',
                    matched_keywords=slot_match,
                    raw_text=text,
                )

            # Emoji confirmation
            emoji_match = self._check_emojis(text)
            if emoji_match:
                return IntentClassification(
                    intent=Intent.CONFIRM,
                    confidence='high',
                    matched_keywords=emoji_match,
                    raw_text=text,
                )

            # Short positive = confirm in S4 ("yes", "ok", "k")
            if self._is_short_positive(text_clean):
                return IntentClassification(
                    intent=Intent.CONFIRM,
                    confidence='high',
                    matched_keywords=[text_clean],
                    raw_text=text,
                )

            # Explicit confirm keywords
            if self._match_any(text_lower, CONFIRM_KEYWORDS):
                return IntentClassification(
                    intent=Intent.CONFIRM,
                    confidence='high',
                    matched_keywords=self._get_matches(text_lower, CONFIRM_KEYWORDS),
                    raw_text=text,
                )

            # New preferences in S4 (switching days)
            pref_matches = self._check_preferences(text_lower)
            if pref_matches:
                return IntentClassification(
                    intent=Intent.PREFERENCES,
                    confidence='high',
                    matched_keywords=pref_matches,
                    raw_text=text,
                )

            # Not now / decline still works in S4
            if self._match_any(text_lower, NOT_NOW_KEYWORDS):
                return IntentClassification(
                    intent=Intent.NOT_NOW,
                    confidence='high',
                    matched_keywords=self._get_matches(text_lower, NOT_NOW_KEYWORDS),
                    raw_text=text,
                )

            if self._match_any(text_lower, DECLINE_KEYWORDS):
                return IntentClassification(
                    intent=Intent.DECLINE,
                    confidence='high',
                    matched_keywords=self._get_matches(text_lower, DECLINE_KEYWORDS),
                    raw_text=text,
                )

            # Fallback: unclear in S4
            return IntentClassification(
                intent=Intent.UNCLEAR,
                confidence='low',
                matched_keywords=[],
                raw_text=text,
            )

        # =============================================================
        # 5. STAGE-SPECIFIC: S0_OPENING, S3_TIME_PREF
        # =============================================================

        # NOT NOW (check before booking interest)
        if self._match_any(text_lower, NOT_NOW_KEYWORDS):
            return IntentClassification(
                intent=Intent.NOT_NOW,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, NOT_NOW_KEYWORDS),
                raw_text=text,
            )

        # DECLINE
        if self._match_any(text_lower, DECLINE_KEYWORDS):
            return IntentClassification(
                intent=Intent.DECLINE,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, DECLINE_KEYWORDS),
                raw_text=text,
            )

        # PREFERENCES (day/time mentions)
        pref_matches = self._check_preferences(text_lower)
        if pref_matches:
            return IntentClassification(
                intent=Intent.PREFERENCES,
                confidence='high',
                matched_keywords=pref_matches,
                raw_text=text,
            )

        # ASKING AVAILABILITY
        if self._match_any(text_lower, ASKING_AVAILABILITY_KEYWORDS):
            return IntentClassification(
                intent=Intent.ASKING_AVAILABILITY,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, ASKING_AVAILABILITY_KEYWORDS),
                raw_text=text,
            )

        # BOOKING INTEREST (explicit keywords)
        if self._match_any(text_lower, BOOKING_INTEREST_KEYWORDS):
            return IntentClassification(
                intent=Intent.BOOKING_INTEREST,
                confidence='high',
                matched_keywords=self._get_matches(text_lower, BOOKING_INTEREST_KEYWORDS),
                raw_text=text,
            )

        # SHORT POSITIVE in S0/S3 = booking interest
        if self._is_short_positive(text_clean):
            return IntentClassification(
                intent=Intent.BOOKING_INTEREST,
                confidence='high',
                matched_keywords=[text_clean],
                raw_text=text,
            )

        # FUZZY MATCH for typos
        fuzzy = self._fuzzy_match_booking(text_clean)
        if fuzzy:
            return IntentClassification(
                intent=Intent.BOOKING_INTEREST,
                confidence='medium',
                matched_keywords=fuzzy,
                raw_text=text,
            )

        # FALLBACK: unclear
        return IntentClassification(
            intent=Intent.UNCLEAR,
            confidence='low',
            matched_keywords=[],
            raw_text=text,
        )

    def _match_any(self, text: str, keywords: List[str]) -> bool:
        """Check if any keyword matches using word boundaries for all keywords."""
        for kw in keywords:
            # Always use word boundary to avoid 'reaching' matching 'aching'
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def _get_matches(self, text: str, keywords: List[str]) -> List[str]:
        """Get all matching keywords using word boundaries."""
        matches = []
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                matches.append(kw)
        return matches

    def _is_short_positive(self, text: str) -> bool:
        """Check if text is a short positive response."""
        text = text.strip().lower()

        # Direct matches
        if text in SHORT_POSITIVE:
            return True

        # Single 'k' as ok
        if text == 'k':
            return True

        # "yes!" "yeah!!" etc
        clean = re.sub(r'[^\w]', '', text)
        if clean in SHORT_POSITIVE:
            return True

        # Multi-word positive phrases ("sure thing", "yes please")
        for phrase in SHORT_POSITIVE_PHRASES:
            if phrase in text:
                return True

        # Handle "yes" with suffix ("yes please", "yes!")
        if text.startswith('yes') and len(text) < 15:
            return True

        return False

    def _check_slot_selection(self, text: str) -> Optional[List[str]]:
        """Check for slot number selection."""
        text = text.strip().lower()

        # Clean punctuation for matching
        text_clean = re.sub(r'[^\w\s]', '', text)

        # Short messages with number
        if len(text_clean) <= 10:
            for num in SLOT_EXACT:
                if num in text_clean.split() or text_clean == num:
                    return [num]

        # Check phrases
        for phrase in SLOT_PHRASES:
            if phrase in text:
                return [phrase]

        return None

    def _check_emojis(self, text: str) -> Optional[List[str]]:
        """Check for emoji responses."""
        matched = [e for e in POSITIVE_EMOJIS if e in text]

        # Only count if message is mostly emoji
        text_no_emoji = text
        for e in POSITIVE_EMOJIS:
            text_no_emoji = text_no_emoji.replace(e, '')
        text_no_emoji = text_no_emoji.strip()

        if matched and len(text_no_emoji) < 10:
            return matched
        return None

    def _check_preferences(self, text: str) -> List[str]:
        """Check for day/time preferences."""
        matches = []

        for day_key in DAY_MAPPINGS:
            if re.search(r'\b' + day_key + r's?\b', text, re.IGNORECASE):
                matches.append(day_key)

        for time_key in TIME_MAPPINGS:
            if re.search(r'\b' + time_key + r'\b', text, re.IGNORECASE):
                matches.append(time_key)

        return matches

    def _fuzzy_match_booking(self, text: str) -> List[str]:
        """Fuzzy match for typos in booking words."""
        targets = ['yes', 'yeah', 'yep', 'sure', 'book', 'schedule']
        matches = []

        for word in text.split():
            for target in targets:
                ratio = SequenceMatcher(None, word, target).ratio()
                if ratio > 0.75 and word != target:
                    matches.append(f"{word}~{target}")

        return matches

    def parse_preferences(self, text: str) -> TimePreferences:
        """Parse time preferences from text."""
        text_lower = text.lower()

        days = []
        excluded_days = []
        for day_key, day_enum in DAY_MAPPINGS.items():
            if re.search(r'\b' + day_key + r's?\b', text_lower, re.IGNORECASE):
                negation = rf'(not|except|no|avoid|cant|can\'t)\s+{day_key}'
                if re.search(negation, text_lower, re.IGNORECASE):
                    if day_enum not in excluded_days:
                        excluded_days.append(day_enum)
                else:
                    if day_enum not in days:
                        days.append(day_enum)

        time_of_day = TimeOfDay.ANY
        for time_key, time_enum in TIME_MAPPINGS.items():
            if re.search(r'\b' + time_key + r'\b', text_lower, re.IGNORECASE):
                negation = rf'(not|except|no|avoid)\s+{time_key}'
                if not re.search(negation, text_lower, re.IGNORECASE):
                    time_of_day = time_enum
                    break

        return TimePreferences(
            days=days,
            time_of_day=time_of_day,
            excluded_days=excluded_days,
            raw_text=text,
        )

    def extract_slot_number(self, text: str) -> Optional[int]:
        """Extract slot number from text."""
        text_lower = text.lower().strip()
        text_clean = re.sub(r'[^\w\s]', '', text_lower)

        if '1' in text_clean or 'one' in text_clean or 'first' in text_clean:
            return 1
        if '2' in text_clean or 'two' in text_clean or 'second' in text_clean:
            return 2
        if '3' in text_clean or 'three' in text_clean or 'third' in text_clean:
            return 3
        return None


# =============================================================================
# Module-level instance and functions
# =============================================================================

classifier = IntentClassifier()


def classify_intent(text: str, current_stage: Stage) -> IntentClassification:
    """Convenience function for intent classification."""
    return classifier.classify(text, current_stage)


def parse_preferences(text: str) -> TimePreferences:
    """Convenience function for preference parsing."""
    return classifier.parse_preferences(text)


def extract_slot_number(text: str) -> Optional[int]:
    """Convenience function for slot extraction."""
    return classifier.extract_slot_number(text)


# =============================================================================
# Testing
# =============================================================================

if __name__ == "__main__":
    print("Testing intent classification...\n")

    clf = IntentClassifier()

    test_cases = [
        # S0_OPENING tests
        ("Yes, I'd like to schedule", Stage.S0_OPENING, Intent.BOOKING_INTEREST),
        ("Yes", Stage.S0_OPENING, Intent.BOOKING_INTEREST),
        ("sure thing", Stage.S0_OPENING, Intent.BOOKING_INTEREST),
        ("yeaah", Stage.S0_OPENING, Intent.BOOKING_INTEREST),
        ("Tuesday mornings", Stage.S0_OPENING, Intent.PREFERENCES),
        ("Please unsubscribe", Stage.S0_OPENING, Intent.OPT_OUT),
        ("How much does it cost?", Stage.S0_OPENING, Intent.COST_QUESTION),
        ("I have tooth pain", Stage.S0_OPENING, Intent.URGENT),

        # S3_TIME_PREF tests
        ("Tuesday and Thursday afternoons", Stage.S3_TIME_PREF, Intent.PREFERENCES),
        ("Wednesday morning", Stage.S3_TIME_PREF, Intent.PREFERENCES),
        ("not right now", Stage.S3_TIME_PREF, Intent.NOT_NOW),

        # S4_AVAILABILITY tests
        ("1", Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION),
        ("2", Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION),
        ("1!!!", Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION),
        ("option 2 please", Stage.S4_AVAILABILITY, Intent.SLOT_SELECTION),
        ("yes", Stage.S4_AVAILABILITY, Intent.CONFIRM),
        ("k", Stage.S4_AVAILABILITY, Intent.CONFIRM),
        ("sounds good", Stage.S4_AVAILABILITY, Intent.CONFIRM),
        ("perfect!", Stage.S4_AVAILABILITY, Intent.CONFIRM),
    ]

    passed = 0
    for text, stage, expected in test_cases:
        result = clf.classify(text, stage)
        status = "PASS" if result.intent == expected else "FAIL"
        if status == "PASS":
            passed += 1
        print(f"{status}: '{text}' @ {stage.value}")
        print(f"       Expected: {expected.value}, Got: {result.intent.value}")
        if result.matched_keywords:
            print(f"       Matched: {result.matched_keywords}")
        print()

    print(f"\nPassed: {passed}/{len(test_cases)}")

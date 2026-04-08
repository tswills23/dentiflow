// Deterministic satisfaction score parser — no AI needed
// Parses 1-5 from patient SMS replies

import type { ScoreParseResult } from '../../types/review';

// Exact number patterns (highest confidence)
const NUMBER_PATTERN = /^[^0-9]*([1-5])[^0-9]*$/;

// Word-to-number map
const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

// Keyword sentiment map (lower confidence)
const POSITIVE_KEYWORDS: Record<string, number> = {
  amazing: 5,
  awesome: 5,
  excellent: 5,
  fantastic: 5,
  incredible: 5,
  outstanding: 5,
  perfect: 5,
  wonderful: 5,
  'loved it': 5,
  'love it': 5,
  'the best': 5,
  'so good': 5,
  great: 5,
  'really good': 5,
  'great visit': 5,
  'great experience': 5,
  good: 4,
  nice: 4,
  fine: 4,
  pleasant: 4,
  satisfied: 4,
  'pretty good': 4,
  'not bad': 4,
};

const NEUTRAL_KEYWORDS: Record<string, number> = {
  ok: 3,
  okay: 3,
  alright: 3,
  meh: 3,
  average: 3,
  'it was ok': 3,
  'it was okay': 3,
  'so so': 3,
  'so-so': 3,
};

const NEGATIVE_KEYWORDS: Record<string, number> = {
  bad: 2,
  poor: 2,
  'not good': 2,
  'not great': 2,
  disappointing: 2,
  disappointed: 2,
  'could be better': 2,
  'needs improvement': 2,
  terrible: 1,
  awful: 1,
  horrible: 1,
  worst: 1,
  'hated it': 1,
  hate: 1,
  dreadful: 1,
};

export function parseScore(text: string): ScoreParseResult {
  const raw = text.trim();
  const lower = raw.toLowerCase().replace(/[!?.]+$/, '').trim();

  // 1. Try exact number match (e.g., "5", "5!", " 4 ")
  const numMatch = raw.match(NUMBER_PATTERN);
  if (numMatch) {
    return { score: parseInt(numMatch[1], 10), confidence: 'exact', rawText: raw };
  }

  // 2. Try word numbers (e.g., "five", "three")
  if (WORD_NUMBERS[lower] !== undefined) {
    return { score: WORD_NUMBERS[lower], confidence: 'exact', rawText: raw };
  }

  // 3. Try keyword matching (longest match first for multi-word phrases)
  const allKeywords = { ...POSITIVE_KEYWORDS, ...NEUTRAL_KEYWORDS, ...NEGATIVE_KEYWORDS };
  const sortedKeys = Object.keys(allKeywords).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeys) {
    if (lower.includes(keyword)) {
      return { score: allKeywords[keyword], confidence: 'keyword', rawText: raw };
    }
  }

  // 4. No match
  return { score: null, confidence: 'none', rawText: raw };
}

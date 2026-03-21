---
name: linkedin-content-agent
description: LinkedIn content drafting agent for dental practice automation thought leadership. Three modes -- research trending dental topics, draft posts from source material with voice/style enforcement, and track engagement performance. Outputs copy-paste-ready LinkedIn posts.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
---

# LinkedIn Content Agent -- Post Drafting for Dental Practice Owners

## What It Does

Helps Trevor draft LinkedIn posts targeting PPO dental practice owners. Three modes:

1. **Research** -- scan dental industry news, forums, and competitor content for trending topics and content angles
2. **Draft** -- generate copy-paste-ready LinkedIn posts from source material following strict voice and formatting rules
3. **Review** -- analyze engagement data to identify what's working and recommend content adjustments

All output is draft-only. Trevor reviews every post before manually publishing to LinkedIn.

## Quick Start

```
/linkedin-content-agent research
/linkedin-content-agent draft [post-type] [topic]
/linkedin-content-agent log-post [post-type] [topic]
/linkedin-content-agent log-engagement
/linkedin-content-agent review
```

---

## Mode 1: Research

**Command:** `/linkedin-content-agent research`

**What to do:**

1. Run 6-8 WebSearch queries targeting dental industry content:
   - `dental practice revenue leakage 2026`
   - `dental recall patient reactivation`
   - `dental practice management challenges site:reddit.com`
   - `dental office automation AI`
   - `PPO dental practice profitability`
   - `dental hygiene production optimization`
   - `"dental practice" site:linkedin.com [recent topic]`
   - `dentaltown forum [trending topic]`

2. For each search, extract:
   - Trending topics dentists are discussing
   - Pain points and complaints from practice owners
   - Common misconceptions or outdated beliefs
   - Specific numbers, stats, or data points referenced
   - Gaps in what others are posting (what no one is saying)

3. Output a structured research brief:

```markdown
# Research Brief -- [Date]

## Trending Topics
- [topic]: [why it's trending, what people are saying]

## Pain Points Surfaced
- [pain point]: [where found, how often mentioned]

## Content Gaps (What No One Is Posting About)
- [gap]: [why this matters for our audience]

## Data Points / Stats Found
- [stat]: [source]

## Recommended Post Topics
- [topic] → [suggested post type] → [suggested angle]
```

4. Save to `data/research-log.jsonl` as a JSON line with date, queries, findings.

---

## Mode 2: Draft

**Command:** `/linkedin-content-agent draft [post-type] [topic]`

**Post types:** `problem_awareness`, `framework`, `contrarian`, `playbook`, `story`, `build_in_public`, `actionable`, `myth_busting`

**Step-by-step workflow:**

### Step 1: Load context

Read these files before generating anything:
- `data/voice-rules.md` -- permanent style constraints (MUST follow all rules)
- `data/post-types.md` -- structural requirements for the requested post type
- Relevant source docs from `data/source-docs/` based on the topic

### Step 2: Generate hooks

Generate 5 hook options (first line of the post). Each hook must:
- Stop the scroll
- NOT start with "I"
- Use one of: surprising number, bold claim, provocative question, story loop, direct contradiction
- Stand alone as compelling without the rest of the post

Present all 5 hooks to Trevor for selection.

### Step 3: Draft the full post

Using Trevor's selected hook (or the best one if he says "pick the best"), draft the complete post:

- Follow ALL rules from `voice-rules.md` (no em dashes, no emojis, no hashtags, no CTAs, no fluff)
- Meet ALL structural requirements from `post-types.md` for the requested post type
- Stay within the length target for the post type
- Use real numbers, frameworks, or data from the source docs
- End with value, not a call to action

### Step 4: Self-evaluate

Before presenting the draft, check it against these 8 criteria:

1. **VOICE_AUTHENTICITY** -- Does it sound like Trevor, not a copywriter?
2. **ZERO_FLUFF** -- Can any sentence be deleted without losing meaning?
3. **NO_BANNED_PATTERNS** -- Zero em dashes, emojis, hashtags, engagement bait, corporate buzzwords?
4. **VALUE_DENSITY** -- Does it contain a specific number, framework, script, or counterintuitive insight?
5. **HOOK_STRENGTH** -- Does the first line stop the scroll? Does it NOT start with "I"?
6. **STRUCTURE_FORMAT** -- Short paragraphs, whitespace, appropriate length?
7. **POST_TYPE_ALIGNMENT** -- Does it meet the structural requirements for this post type?
8. **NO_CTA_NO_SELL** -- Zero calls to action anywhere?

If any criterion fails, fix it before presenting.

### Step 5: Present the draft

Show Trevor:
- The selected hook
- The full post (copy-paste ready, inside a code block for easy copying)
- Word count
- Which source docs were referenced
- Any criteria that were close to failing (transparency)

### Step 6: Save

Save the approved draft to `data/drafts/YYYY-MM-DD_[topic-slug].md` with metadata:

```markdown
---
date: YYYY-MM-DD
post_type: [type]
topic: [topic]
hook_style: [number/claim/question/story/contradiction]
word_count: [count]
source_docs: [list of doc numbers used]
status: draft
---

[Full post content]
```

---

## Mode 3: Log Post

**Command:** `/linkedin-content-agent log-post [post-type] [topic]`

When Trevor publishes a post, log it to `data/engagement/posts.jsonl`:

```json
{
  "id": "post_001",
  "date": "2026-03-16",
  "post_type": "problem_awareness",
  "topic": "empty chair costs",
  "hook_style": "number",
  "hook_text": "3 empty hygiene chairs per day...",
  "word_count": 245,
  "source_docs": [3, 12],
  "status": "published"
}
```

---

## Mode 4: Log Engagement

**Command:** `/linkedin-content-agent log-engagement`

Prompt Trevor to enter engagement numbers for recently published posts (48-72 hours after posting):

- Impressions
- Likes
- Comments
- Reposts
- Profile views (if notable change)

Save to `data/engagement/engagement.jsonl`:

```json
{
  "post_id": "post_001",
  "date_logged": "2026-03-19",
  "impressions": 1250,
  "likes": 34,
  "comments": 8,
  "reposts": 3,
  "engagement_rate": 0.036,
  "notes": "Got 2 DMs from practice owners asking about recall"
}
```

---

## Mode 5: Review

**Command:** `/linkedin-content-agent review`

Analyze all engagement data and produce a monthly content review:

1. Read `data/engagement/posts.jsonl` and `data/engagement/engagement.jsonl`
2. Calculate per-post-type averages (impressions, likes, comments, reposts, engagement rate)
3. Identify:
   - Top 3 performing posts (by engagement rate)
   - Bottom 3 performing posts
   - Best-performing post type
   - Best-performing hook style
   - Topics that drove the most comments (signal for resonance)
4. Recommend:
   - Which post types to increase/decrease in the mix
   - Which hook styles to use more
   - New topic angles based on high-engagement areas
   - Specific posts worth repurposing or expanding into longer content

Save the review to `data/engagement/monthly_reviews/YYYY-MM_review.md`

---

## File Structure

```
linkedin-content-agent/
  SKILL.md                          # This file
  data/
    voice-rules.md                  # Permanent voice/style constraints
    post-types.md                   # 8 post type definitions
    source-docs/                    # 16 source documents (frameworks, playbooks, data)
      01-mvp-agent-sops.md
      02-30-day-recall-sprint.md
      03-speed-to-lead-breakdown.md
      04-recall-reactivation-breakdown.md
      05-revenue-capture-breakdown.md
      06-intake-control-breakdown.md
      07-pre-visit-prep-breakdown.md
      08-retention-reentry-breakdown.md
      09-demand-creation-breakdown.md
      10-smart-booking-breakdown.md
      11-dental-revenue-os-master.md
      12-72-hour-recall-playbook.md
      13-money-model-notes.md
      14-sms-test-plan.md
      15-ai-consultant-system-prompt.md
      16-100m-money-model-blueprint.md
    drafts/                         # Generated post drafts
    research-log.jsonl              # Research findings
    engagement/
      posts.jsonl                   # Published post metadata
      engagement.jsonl              # Engagement data per post
      monthly_reviews/              # Monthly analysis reports
```

## Source Document Quick Reference

| # | Document | Best For |
|---|----------|----------|
| 3 | Speed-to-Lead | Problem awareness, framework, contrarian (response time) |
| 5 | Revenue Capture | Problem awareness (unscheduled treatment math) |
| 11 | Revenue OS Master | Framework, playbook (9-system map) |
| 12 | 72-Hour Playbook | Playbook, actionable (templates, scripts, rules) |
| 13 | Money Model | Framework, contrarian (offer design, CAC/GP) |
| 14 | SMS Test Plan | Build in public, actionable (A/B test data, copy psychology) |
| 15 | AI Consultant | Story/credibility (Trevor's background, positioning) |
| 16 | 100M Blueprint | Framework (offer stack, pricing ladder) |

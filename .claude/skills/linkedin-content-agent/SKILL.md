---
name: linkedin-content-agent
description: LinkedIn content drafting agent for AI revenue systems thought leadership targeting PPO dental practices. Five modes -- research trending dental topics, draft posts across 5 content pillars with voice/style enforcement, track engagement performance, and plan video content. Outputs copy-paste-ready LinkedIn posts and video scripts.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
---

# LinkedIn Content Agent -- AI Revenue Systems for PPO Dental Practices

## What It Does

Helps Trevor draft LinkedIn posts and video scripts positioning Dentiflow as the complete AI revenue system for PPO dental practices. Five modes:

1. **Research** -- scan dental industry news, forums, and competitor content for trending topics and content angles
2. **Draft** -- generate copy-paste-ready LinkedIn posts across 5 content pillars following strict voice and formatting rules
3. **Video** -- generate 60-90 second vertical video scripts for LinkedIn + YouTube Shorts
4. **Review** -- analyze engagement data to identify what's working and recommend content adjustments
5. **Log** -- record published posts and engagement data

All output is draft-only. Trevor reviews every post before manually publishing to LinkedIn.

## Positioning

Dentiflow is an AI revenue system for PPO dental practices. Not a recall tool. Not an SMS vendor. A complete system that plugs revenue leaks across the entire patient lifecycle.

**LinkedIn headline:** "Ex-Acquisition.com | AI Revenue Systems for PPO Dental | Founder @ Dentiflow.ai"

**The sellable bundle:**
1. SMS Recall Recovery (built, deploying)
2. Speed-to-Lead AI Pipeline (built)
3. Reviews + Referrals Automation (building now)
4. No-Show Recovery Sequences (building now)
5. AI Voice Receptionist (building next, upsell tier)
6. White-label Analytics Dashboard (built, deployed)

Content should reflect this full system positioning, not just recall.

## Strategy

### Phase 1: Volume (Current -- posts 1-100)

- **Cadence:** 5 posts per week (Mon-Fri). At least 2 should be video (posted to both LinkedIn and YouTube Shorts).
- **Goal:** Hit 100 published posts. No strategy pivots until then.
- **Post types:** Rotate through all 8 types evenly. Do not weight any type more heavily during this phase.
- **Pillar rotation:** Each week must touch at least 3 different pillars. No more than 2 consecutive posts on the same pillar.
- **No premature optimization.** Do not change post type ratios, hook styles, or topic mix based on early engagement data. The point is to generate enough signal to make data-driven decisions later.
- **Track everything:** Log every published post and its engagement data in `data/engagement/posts.jsonl` and `data/engagement/engagement.jsonl`.
- **Build-in-public posts:** Whenever a new module ships (reviews/referrals, no-show recovery, voice agent), create a build-in-public post documenting what was built, why it matters, and what it does for practices.
- **Results posts:** Whenever real metrics come in from clients or pilots, create a data-driven post sharing results.
- **Current count:** 7 of 100 (as of 2026-03-26)

### Phase 2: Optimize (starts after post 100)

- Run the **100-post milestone review** (see Review mode below)
- Identify the top 10% of posts (10 posts) by engagement rate
- Analyze what they have in common: post type, hook style, topic, length, day of week
- Refocus the post type rotation and topic mix based on what worked
- Identify and retire patterns from the bottom 10%

---

## Content Pillars

5 pillars rotated across the weekly content calendar. Each post must map to exactly one pillar. Weekly rotation must touch at least 3 pillars.

### Pillar 1: Recall + Reactivation

The core topic. Overdue patients, hygiene revenue leakage, why recall systems break down, what it costs to ignore your overdue list.

**Example topics:**
- Your practice is sitting on $200K in overdue hygiene revenue. Here's the math.
- Why your front desk will never fix your recall problem (and what will).
- The 3-day recall sequence that gets 8-12% response rates from cold patient lists.
- What "overdue" actually costs: the downstream treatment revenue you're losing.

**Primary source docs:** #2, #4, #12, #14

### Pillar 2: Reviews + Referrals

Why most practices get 2-3 reviews a month despite having 500 happy patients. What Google ranking has to do with review velocity. Why 91% of patients would give a referral but only 11% of businesses ask. What happens when you automate the ask.

**Example topics:**
- 91% of your patients would refer someone to your practice. You're just not asking.
- Your Google ranking is dying because you stopped getting reviews 4 months ago.
- The review-to-referral pipeline: how one happy patient turns into three new ones.
- Why asking "please leave us a review" is the worst way to get reviews.
- What your Google Business Profile says about you to every new patient who searches "dentist near me."

**Primary source docs:** #5, #9, #11, #13

### Pillar 3: Speed-to-Lead + No-Shows + Missed Calls

62% of calls to small businesses go unanswered. What happens when a new patient inquiry sits for 24 hours. Why no-shows are a system problem, not a patient problem. How speed-to-lead impacts conversion.

**Example topics:**
- 62% of calls to dental practices go unanswered. That's not a staffing problem. It's a systems problem.
- A patient who calls and gets voicemail calls the next practice on Google within 90 seconds.
- Your no-show rate isn't a patient problem. It's a confirmation and follow-up problem.
- The 5-minute rule: why responding to a lead in 5 minutes vs 5 hours changes everything.
- What happens between "patient books" and "patient shows up" is where most practices lose.

**Primary source docs:** #3, #6, #10, #14

### Pillar 4: System-Level Thinking / The Full Revenue OS

Why fixing one piece of the revenue cycle without fixing the others is like patching one hole in a boat with five leaks. The 9-stage dental revenue operating system. Why bundled solutions beat single services.

**Example topics:**
- Running ads without fixing your follow-up is like pouring water into a bucket with no bottom.
- The 9 stages where dental revenue leaks (and most practices only plug 1-2 of them).
- Why your marketing agency is getting you leads but you're not getting patients.
- You don't have a marketing problem. You have a revenue system problem.
- The difference between a practice that spends $5K/month on ads and makes money vs one that doesn't.

**Primary source docs:** #11, #5, #9, #13, #16

### Pillar 5: Acquisition.com / Sales + Offer Architecture Lens

Lessons from selling $7M at Acquisition.com. Offer design. Guarantee structures. Discovery-based selling. Why bundled offers beat commodity services. High-level sales and business methodology applied to dental.

**Example topics:**
- I sold $7M in 10 months on Alex Hormozi's sales team. Here's what I learned about offer design.
- Why "free consultation" is the worst offer a dental practice can run.
- The guarantee structure that eliminates risk and makes prospects say yes.
- What Acquisition.com taught me about building services that retain clients for years.
- Why most dental marketing fails: it solves one problem and ignores five others.

**Primary source docs:** #13, #15, #16

### Weekly Rotation Example

- Monday: Pillar 1 (Recall) -- problem_awareness
- Tuesday: Pillar 4 (System Thinking) -- framework
- Wednesday: Pillar 2 (Reviews/Referrals) -- contrarian
- Thursday: Pillar 5 (Acquisition.com lens) -- playbook
- Friday: Pillar 3 (Speed-to-Lead/No-Shows) -- build_in_public

---

## Quick Start

```
/linkedin-content-agent research
/linkedin-content-agent draft [post-type] [pillar] [topic]
/linkedin-content-agent video [pillar] [topic]
/linkedin-content-agent log-post [post-type] [topic]
/linkedin-content-agent log-engagement
/linkedin-content-agent review
```

---

## Mode 1: Research

**Command:** `/linkedin-content-agent research`

**What to do:**

1. Run 9-11 WebSearch queries targeting dental industry content across forums, social platforms, trade publications, and video channels:

   **Forums & social (existing):**
   - `dental practice management challenges site:reddit.com`
   - `"dental practice" site:linkedin.com [recent topic]`
   - `dentaltown forum [trending topic]`

   **General industry keywords:**
   - `dental practice revenue leakage 2026`
   - `dental recall patient reactivation`
   - `dental office automation AI`
   - `PPO dental practice profitability`
   - `dental hygiene production optimization`

   **Dental business channel blogs** (blog versions of top dental YouTube channels — MGE, Dentalpreneur, The Dental Marketer — since site:youtube.com doesn't index well for niche queries):
   - `dental practice [topic] site:mgeonline.com OR site:thedentalmarketer.site OR site:truedentalsuccess.com`

   **Trade publications** (Dental Economics is ~90% business content; DentistryIQ covers staffing, marketing, HR — both are credibility sources with benchmark data):
   - `dental practice owner challenges site:dentaleconomics.com OR site:dentistryiq.com`

   **Student Doctor Network** (candid practice ownership discussions with real financial breakdowns, DSO vs. private debates, first-time buyer retrospectives):
   - `dental practice ownership site:forums.studentdoctor.net`

2. **YouTube comment scraper** (auto-triggered when data is >7 days stale):
   - Check `data/youtube-comments/analysis/` for the most recent insights file
   - If the most recent file is older than 7 days (or doesn't exist), run via Bash:
     ```
     node scripts/scrape_youtube_comments.mjs
     node scripts/analyze_youtube_comments.mjs
     ```
   - Read the latest `data/youtube-comments/analysis/[date]_insights.md`
   - Incorporate the top pain points, quotable comments, and topic trends into the research brief
   - This scrapes real YouTube comments from Dentalpreneur, The Dental Marketer, MGE Management Experts, and Dental Economics channels

3. For each search, extract:
   - Trending topics dentists are discussing
   - Pain points and complaints from practice owners
   - Common misconceptions or outdated beliefs
   - Specific numbers, stats, or data points referenced
   - Gaps in what others are posting (what no one is saying)

4. Output a structured research brief:

```markdown
# Research Brief -- [Date]

## Trending Topics
- [topic]: [why it's trending, what people are saying]

## Pain Points Surfaced
- [pain point]: [source platform: reddit/dentaltown/youtube/dental_economics/dentistryiq/sdn/linkedin] [how often mentioned]

## Content Gaps (What No One Is Posting About)
- [gap]: [why this matters for our audience]

## Data Points / Stats Found
- [stat]: [source]

## YouTube Comment Pain Points (from dental business channels)
- [pain point]: [source channel] [comment count mentioning this] [top quote]

## Recommended Post Topics
- [topic] → [suggested post type] → [suggested angle]
```

5. Save to `data/research-log.jsonl` as a JSON line with date, queries, findings.

---

## Mode 2: Draft

**Command:** `/linkedin-content-agent draft [post-type] [pillar] [topic]`

**Post types:** `problem_awareness`, `framework`, `contrarian`, `playbook`, `story`, `build_in_public`, `actionable`, `myth_busting`

**Pillars:** `recall`, `reviews_referrals`, `speed_to_lead`, `system_thinking`, `acquisition_sales`

**Cadence:** During Phase 1, generate drafts in weekly batches of 5 (Mon-Fri). Rotate through all 8 post types evenly across batches. Each weekly batch must touch at least 3 different pillars. No more than 2 consecutive posts on the same pillar.

**Step-by-step workflow:**

### Step 1: Load context

Read these files before generating anything:
- `data/voice-rules.md` -- permanent style constraints (MUST follow all rules)
- `data/post-types.md` -- structural requirements for the requested post type
- Content Pillars section above -- confirm the topic maps to the specified pillar
- Relevant source docs from `data/source-docs/` based on the pillar and topic
- Recent drafts in `data/drafts/` -- check recent pillar distribution to avoid clustering

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
pillar: [recall/reviews_referrals/speed_to_lead/system_thinking/acquisition_sales]
topic: [topic]
hook_style: [number/claim/question/story/contradiction]
word_count: [count]
source_docs: [list of doc numbers used]
format: [text/video]
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
  "pillar": "recall",
  "topic": "empty chair costs",
  "hook_style": "number",
  "hook_text": "3 empty hygiene chairs per day...",
  "word_count": 245,
  "source_docs": [3, 12],
  "format": "text",
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

## Mode 5: Video

**Command:** `/linkedin-content-agent video [pillar] [topic]`

Generate a 60-90 second vertical video script for LinkedIn + YouTube Shorts. Same content, both platforms. YouTube gives long-tail search discovery that LinkedIn cannot match.

**Script requirements:**
- One concept per video. Do not try to cover multiple ideas.
- Hook in the first 2 seconds with a specific number or contrarian statement.
- End with an open loop, not a CTA. No "DM me." No "link in bio." Pure value.
- Follow the same 5 pillar structure as text posts.
- All voice rules apply to spoken scripts (no buzzwords, no fluff, conversational).
- Format the script with clear sections: HOOK / BODY / CLOSE

**Filming notes (for Trevor, not AI):**
- Vertical (phone), 60-90 seconds max
- Film in batches: 3-4 clips per session, 30-45 minutes total
- Schedule across both platforms for the week

**Script template:**

```markdown
---
date: YYYY-MM-DD
format: video
pillar: [pillar]
topic: [topic]
target_length: [60-90 seconds]
status: draft
---

**HOOK (0-2 seconds):**
[Opening line -- specific number or contrarian statement]

**BODY (3-70 seconds):**
[Core concept, broken into 2-3 talking points]

**CLOSE (last 10-20 seconds):**
[Open loop or value statement -- NOT a CTA]
```

Save video scripts to `data/drafts/YYYY-MM-DD_video_[topic-slug].md`

---

## Mode 6: Review

**Command:** `/linkedin-content-agent review`

Analyze all engagement data and produce a monthly content review:

1. Read `data/engagement/posts.jsonl` and `data/engagement/engagement.jsonl`
2. Calculate per-post-type AND per-pillar averages (impressions, likes, comments, reposts, engagement rate)
3. Identify:
   - Top 3 performing posts (by engagement rate)
   - Bottom 3 performing posts
   - Best-performing post type
   - Best-performing pillar
   - Best-performing hook style
   - Best-performing format (text vs video)
   - Topics that drove the most comments (signal for resonance)
4. Recommend:
   - Which post types to increase/decrease in the mix
   - Which pillars are resonating most
   - Which hook styles to use more
   - New topic angles based on high-engagement areas
   - Specific posts worth repurposing or expanding into longer content or video

**Important:** During Phase 1 (posts 1-100), monthly reviews are for tracking progress only. Do NOT recommend strategy changes until the 100-post milestone is reached.

Save the review to `data/engagement/monthly_reviews/YYYY-MM_review.md`

### 100-Post Milestone Review

When post count in `data/engagement/posts.jsonl` reaches 100, run this special analysis:

1. Rank all 100 posts by engagement rate
2. **Top 10% analysis (top 10 posts):**
   - What post types appear most? Least?
   - What pillars appear most? Least?
   - What hook styles appear most?
   - What topics/themes cluster together?
   - Average word count vs overall average?
   - Which days of the week performed best?
   - Text vs video performance comparison?
3. **Bottom 10% analysis (bottom 10 posts):**
   - What patterns should be retired or reduced?
4. **Recommendations for Phase 2:**
   - New weighted post type rotation (e.g., 30% contrarian, 25% framework, etc.)
   - New weighted pillar rotation based on what resonated
   - Hook styles to prioritize
   - Topics to double down on
   - Topics/approaches to drop
   - Text vs video split recommendation
5. Save to `data/engagement/monthly_reviews/100-post-milestone-review.md`

---

## File Structure

```
linkedin-content-agent/
  SKILL.md                          # This file
  data/
    voice-rules.md                  # Permanent voice/style constraints
    post-types.md                   # 8 post type definitions
    humor-bank.md                   # Pre-approved humor lines and running bits
    source-docs/                    # Source documents (frameworks, playbooks, data)
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
      17-reviews-referrals-breakdown.md       # NEW -- Reviews + referrals system
      18-noshow-recovery-breakdown.md         # NEW -- No-show recovery sequences
      19-jp-roadmap-positioning.md            # NEW -- JP Middleton roadmap + market positioning
      20-dentiflow-system-summary.md          # NEW -- Full architecture covering all modules
    drafts/                         # Generated post drafts (text + video)
    research-log.jsonl              # Research findings
    engagement/
      posts.jsonl                   # Published post metadata (includes pillar + format)
      engagement.jsonl              # Engagement data per post
      monthly_reviews/              # Monthly analysis reports
```

## Source Document Quick Reference

| # | Document | Best For | Primary Pillar |
|---|----------|----------|----------------|
| 2 | 30-Day Sprint | Framework (recall launch sequencing) | Recall |
| 3 | Speed-to-Lead | Problem awareness, framework, contrarian (response time) | Speed-to-Lead |
| 4 | Recall Reactivation | Framework, myth busting (patient reactivation) | Recall |
| 5 | Revenue Capture | Problem awareness (unscheduled treatment math) | System Thinking |
| 6 | Intake Control | Framework (appointment intake qualification) | Speed-to-Lead |
| 9 | Demand Creation | Framework (inbound demand generation) | System Thinking |
| 10 | Smart Booking | Framework (booking optimization) | Speed-to-Lead |
| 11 | Revenue OS Master | Framework, playbook (9-system map) | System Thinking |
| 12 | 72-Hour Playbook | Playbook, actionable (templates, scripts, rules) | Recall |
| 13 | Money Model | Framework, contrarian (offer design, CAC/GP) | Acquisition/Sales |
| 14 | SMS Test Plan | Build in public, actionable (A/B test data) | Recall |
| 15 | AI Consultant | Story/credibility (Trevor's background) | Acquisition/Sales |
| 16 | 100M Blueprint | Framework (offer stack, pricing ladder) | Acquisition/Sales |
| 17 | Reviews + Referrals | Problem awareness, framework, actionable | Reviews/Referrals |
| 18 | No-Show Recovery | Framework, actionable (confirmation sequences) | Speed-to-Lead |
| 19 | JP Roadmap | Framework, system thinking (market positioning) | System Thinking |
| 20 | System Summary | Build in public, framework (full architecture) | System Thinking |

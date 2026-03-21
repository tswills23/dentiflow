---
name: dentiflow-sms-autoresearch
description: Self-improving SMS recall copy optimization using the Karpathy autoresearch pattern. Generates batches of recall SMS variants across all message types (Day 0/1/3 + reply handling), evaluates via Claude against 7 dental-specific criteria, mutates the copy instructions, keeps winners. Includes a live web dashboard.
allowed-tools: Read, Bash, Glob, Grep
---

# Dentiflow SMS Autoresearch -- Self-Improving Recall Copy Optimization

## What It Does
Applies the Karpathy autoresearch pattern to dental recall SMS copy. Every 2 minutes:
1. Generates 10 SMS variants from current copy instructions (Claude Sonnet)
2. Evaluates each against 7 recall-specific criteria via Claude Sonnet (score out of 70)
3. Keeps the instructions if they beat the best score, discards otherwise
4. Mutates the best instructions to try to improve further
5. Logs everything to JSONL for tracking

## Why This Exists
Recall SMS copy has very specific constraints that are hard to maintain consistently:
- Voice authority must match the patient's overdue window
- Clinical jargon must be completely absent
- CTAs must escalate correctly across the 3-day sequence
- Tone must read human, not like a marketing blast
- No pressure or guilt, even when creating clinical urgency
- Must fit in SMS character limits
- Must open a conversational loop

Manual copy iteration is slow and subjective. This system runs 10 variants every 2 minutes and converges on copy instructions that produce consistently high-quality messages across ALL scenario types.

## Eval Criteria (7 per message, 70 max per batch)
1. **Voice authority match** -- correct sender voice for overdue window
2. **No clinical jargon** -- zero banned clinical terms
3. **Binary CTA structure** -- correct CTA type for message day (none/soft/direct)
4. **Human tone** -- reads like a real text, not marketing
5. **No pressure/guilt** -- no shame about the gap
6. **Under SMS length** -- 320 chars or fewer
7. **Opens a loop** -- ends with something that makes replying easy

## Scenario Coverage
The system tests across 20 diverse scenarios including:
- Day 0 openers (5 different patient profiles)
- Day 1 follow-ups (3 scenarios)
- Day 3 offers (3 scenarios)
- Reply handling: yes, not now, cost question, why texting, STOP, reschedule, vague interest
- Edge cases: periodontal concerns, varying overdue windows

## Quick Start

```bash
# Install dependency
pip install anthropic python-dotenv

# Set up environment
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Run continuous loop (every 2 min)
python3 autoresearch_sms.py

# Single cycle (test)
python3 autoresearch_sms.py --once

# Run N cycles
python3 autoresearch_sms.py --cycles 10

# Start the live dashboard
python3 dashboard_sms.py --port 8502
# Then open http://localhost:8502
```

## File Structure

```
dentiflow-sms-autoresearch/
  SKILL.md                    # This file
  autoresearch_sms.py         # Main generate -> eval -> mutate loop
  dashboard_sms.py            # Live web dashboard (Chart.js)
  data/
    copy_instructions.txt     # Current copy instructions being optimized
    best_copy_instructions.txt # Best instructions found so far
    state.json                # Loop state (run number, best score)
    results.jsonl             # Append-only experiment log
    variants/
      run_001/                # 10 SMS variants per run (JSON files)
      run_002/
      ...
```

## Phase 2: Real Campaign Data Validation
Once the LLM-optimized copy is deployed via Twilio/GHL, the system can be extended to:
1. Pull actual reply rates per template variant from Twilio webhook logs
2. Score variants by real-world reply rate instead of (or in addition to) LLM eval
3. Use booking conversion rate as the ultimate metric
4. A/B test winning LLM-optimized copy against control copy from the 500-patient test plan

This creates a two-stage optimization:
- Stage 1 (current): LLM eval to get copy instructions to 90%+ eval pass rate
- Stage 2 (post-launch): Real patient data to validate and refine what actually drives bookings

## Models
- **Generation**: `claude-sonnet-4-6` (SMS copy from instructions)
- **Evaluation**: `claude-sonnet-4-6` (criteria scoring)
- **Mutation**: `claude-sonnet-4-6` (instruction rewriting based on failure analysis)

## Cost
- ~$0.01-0.02 per variant generation (Sonnet, short output)
- ~$0.01 per eval (Sonnet, structured JSON output)
- ~$0.02 per mutation (Sonnet, longer output)
- **Total: ~$0.15-0.25 per cycle (10 variants)**
- At 2-min intervals: ~$5-8/hour
- 50 cycles to optimize: ~$8-12 total

## Dashboard
Serves at `http://localhost:8502` with:
- 4 stat cards (current best, baseline, improvement %, runs/kept)
- Score-over-time chart with keep/discard dot coloring
- 7 per-criterion breakdown charts
- Run history table with all criteria visible
- Current best copy instructions display
- Auto-refreshes every 15s

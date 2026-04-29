#!/usr/bin/env python3
"""
Dentiflow SMS Autoresearch -- Self-improving recall copy optimization.

Karpathy autoresearch pattern applied to dental recall SMS copy:
1. Generate 10 SMS copy variants from current prompt instructions
2. Evaluate each against 10 recall-specific criteria via Claude -> score out of 100
3. Compare against best score -- keep winner
4. Mutate the winner instructions for next cycle
5. Repeat every 2 minutes

Usage:
    python3 autoresearch_sms.py              # Continuous loop
    python3 autoresearch_sms.py --once       # Single cycle
    python3 autoresearch_sms.py --cycles 10  # Run N cycles
"""

import argparse
import json
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# --- Config ---

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")

GEN_MODEL = "claude-sonnet-4-6"       # generates SMS copy variants
EVAL_MODEL = "claude-opus-4-6"         # evaluates copy against criteria (more nuanced judgment)
MUTATE_MODEL = "claude-opus-4-6"       # mutates the copy instructions (more nuanced judgment)

BASE_DIR = Path(__file__).resolve().parent / "data"
INSTRUCTIONS_FILE = BASE_DIR / "copy_instructions.txt"
BEST_INSTRUCTIONS_FILE = BASE_DIR / "best_copy_instructions.txt"
STATE_FILE = BASE_DIR / "state.json"
RESULTS_FILE = BASE_DIR / "results.jsonl"
VARIANTS_DIR = BASE_DIR / "variants"

BATCH_SIZE = 10
CYCLE_SECONDS = 120
MAX_GEN_WORKERS = 5
MAX_EVAL_WORKERS = 5

# --- Copy Generation Scenarios ---
# Each scenario is a (message_type, patient_context) tuple
# This forces the copy instructions to handle ALL real-world situations

SCENARIOS = [
    # Day 0 openers -- doctor voice, 12+ months overdue
    ("day_0_opener", "Patient: Maria, 14 months overdue, last saw Dr. Thompson, general hygiene patient, no known issues"),
    ("day_0_opener", "Patient: James, 18 months overdue, last saw Dr. Patel, had a crown done on last visit, hasn't been back since"),
    ("day_0_opener", "Patient: Linda, 24 months overdue, last saw Dr. Kim, long-time patient of 8 years, just fell off schedule"),
    ("day_0_opener", "Patient: Robert, 13 months overdue, last saw Dr. Garcia, new-ish patient with only 2 prior visits"),
    ("day_0_opener", "Patient: Sarah, 36 months overdue, last saw Dr. Johnson, was a regular quarterly patient before gap"),

    # Day 1 follow-ups -- consequence frame + soft CTA
    ("day_1_followup", "Patient: Maria, 14 months overdue, did not reply to Day 0, message was delivered and opened"),
    ("day_1_followup", "Patient: James, 18 months overdue, did not reply to Day 0, message was delivered but not opened"),
    ("day_1_followup", "Patient: Linda, 24 months overdue, did not reply to Day 0, message was delivered and opened"),

    # Day 3 offers -- non-responders who opened
    ("day_3_offer", "Patient: Maria, 14 months overdue, opened Day 0 and Day 1 but did not reply to either, needs barrier removal"),
    ("day_3_offer", "Patient: James, 18 months overdue, opened Day 1 only, did not reply, needs barrier removal"),
    ("day_3_offer", "Patient: Sarah, 36 months overdue, opened both messages, no reply, longest gap in batch"),

    # Reply handling scripts
    ("reply_yes", "Patient replied: 'Yeah I can come in next week, what times do you have?'"),
    ("reply_not_now", "Patient replied: 'Not right now, maybe in a few months'"),
    ("reply_cost_question", "Patient replied: 'How much is this going to cost? I dont have insurance anymore'"),
    ("reply_why_texting", "Patient replied: 'Who is this? Why are you texting me?'"),
    ("reply_stop", "Patient replied: 'STOP'"),

    # Edge cases the copy instructions MUST handle
    ("day_0_opener", "Patient: David, 15 months overdue, last saw Dr. Rivera, patient had periodontal concerns flagged on last visit"),
    ("reply_reschedule", "Patient replied: 'I booked for Tuesday but something came up, can I move it?'"),
    ("reply_vague_interest", "Patient replied: 'Maybe... when are you open?'"),

    # Real patient responses from April 8 recall blast -- must handle these gracefully
    ("reply_moved_away", "Patient replied: 'Hey I moved out of state.' or 'I live in TN now' or 'He is in Arizona at college'"),
    ("reply_who_is_this", "Patient replied: 'No. I don't know who you are' or 'Who?' or 'What'"),
    ("reply_complaint", "Patient replied: 'your pushy sales tactics are really annoying. No thank you!' or 'I was hoping someone wanted to talk about my horrible experience with your dentist last year'"),
]

# --- Eval Criteria ---
# 7 binary criteria, 10 variants per batch = max score 70

EVAL_PROMPT = """You are evaluating a dental recall SMS message against 7 strict criteria. Read the message carefully and evaluate EACH criterion independently.

The message being evaluated:
---
{message}
---

Context for this message:
- Message type: {message_type}
- Patient scenario: {scenario}

Criteria:

1. VOICE_AUTHORITY_MATCH: Does the message use the correct sender voice? Day 0/1/3 messages from 12+ month overdue patients MUST come from the doctor (Dr. [Last Name]). Reply handling can come from the doctor or office. The voice must be consistent and never switch mid-message.

2. NO_CLINICAL_JARGON: The message contains ZERO clinical terms that trigger avoidance in overdue patients. Banned words: "exam", "examination", "baseline", "comprehensive", "prophylaxis", "prophy", "scaling", "periodontal", "radiographs", "x-rays", "treatment plan", "diagnosis". Clinical concepts can be referenced indirectly (e.g., "take a look at things" instead of "exam").

3. BINARY_CTA_STRUCTURE: If the message contains a call-to-action, it MUST offer exactly two simple options (e.g., "this week or next week?", "mornings or afternoons?"). Day 0 messages should have NO CTA (just earn the reply). Day 1 should have a SOFT CTA (asking about schedule). Day 3 should have a DIRECT binary CTA. Reply handling CTAs should be natural and frictionless. If the message type doesn't warrant a CTA (like Day 0 or a STOP acknowledgment), having no CTA is a PASS.

4. HUMAN_TONE: Does it read like a real text from a real person? NOT like a marketing blast, not like a corporate email, not like a chatbot. Should feel like the doctor actually typed this on their phone. No ALL CAPS for emphasis, no exclamation marks overuse, no emoji, no "Dear [Name]" formality.

5. NO_PRESSURE_OR_GUILT: The message is completely free of language that creates pressure, guilt, or shame about the gap. No "you missed your appointment", no "you're overdue", no "it's been too long", no urgency manufactured through guilt. Clinical consequence (Day 1) is acceptable IF framed as "things can progress silently" NOT "you've been neglecting your health."

6. UNDER_SMS_LENGTH: The message is 320 characters or fewer (fits in 2 SMS segments max). Shorter is better. Messages over 320 characters FAIL.

7. OPENS_A_LOOP: The message ends in a way that makes replying the path of least resistance. For outreach messages: ends with a question. For reply handling: ends with a clear next step that requires minimal patient effort. STOP acknowledgments and "not now" responses are exempt (no loop needed, these close the loop).

Rate each criterion as PASS (true) or FAIL (false). Be strict but fair.

Respond in this exact JSON format:
{{"voice_authority": true, "no_jargon": true, "binary_cta": true, "human_tone": true, "no_pressure": true, "under_length": true, "opens_loop": true, "failures": []}}

If any criterion fails, set it to false and add a brief failure description. Example:
{{"voice_authority": false, "no_jargon": true, "binary_cta": false, "human_tone": true, "no_pressure": true, "under_length": true, "opens_loop": true, "failures": ["Message says 'Hi [Name], this is Sarah from...' but patient is 14 months overdue so should be doctor voice", "CTA offers 3 options instead of binary choice"]}}"""

# --- Copy Generation Prompt ---

GENERATION_PROMPT = """You are generating a single dental recall SMS message. Follow the copy instructions below EXACTLY.

COPY INSTRUCTIONS:
---
{instructions}
---

SCENARIO:
- Message type: {message_type}
- Patient context: {scenario}

Generate ONLY the SMS message text. No explanation, no markdown, no quotes around it. Just the raw message as it would appear on the patient's phone. Use [Name], [Practice Name], Dr. [Last Name], [Hygienist Name] as placeholders where appropriate."""

# --- Mutation Prompt ---

MUTATION_TEMPLATE = """You are optimizing SMS copy instructions for a dental recall system. These instructions tell an AI how to write recall SMS messages for overdue hygiene patients.

The goal: every generated message must pass ALL 7 evaluation criteria consistently across diverse patient scenarios and message types (Day 0 openers, Day 1 follow-ups, Day 3 offers, and reply handling).

CURRENT COPY INSTRUCTIONS:
---
{current_instructions}
---

LAST BATCH RESULTS ({score}/70):
- Voice authority match: {voice_rate}/10
- No clinical jargon: {jargon_rate}/10
- Binary CTA structure: {cta_rate}/10
- Human tone: {tone_rate}/10
- No pressure/guilt: {pressure_rate}/10
- Under SMS length: {length_rate}/10
- Opens a loop: {loop_rate}/10

COMMON FAILURES:
{failures}

BEST SCORE SO FAR: {best_score}/70

RULES FOR YOUR MODIFICATION:
- Keep the core philosophy: messages should sound like they came from a real doctor's phone
- For any criterion below 7/10, add VERY explicit constraints and examples
- If voice authority keeps failing: add explicit rules about which voice maps to which overdue window
- If jargon appears: add a BANNED WORDS list with explicit alternatives
- If CTAs aren't structured correctly: add explicit rules for each message type (Day 0 = no CTA, Day 1 = soft, Day 3 = direct binary)
- If tone feels robotic: add examples of what "sounds human" vs "sounds like marketing"
- If pressure/guilt creeps in: add explicit banned phrases and reframing examples
- If messages are too long: add a hard character limit rule with examples of trimming
- If loops aren't opening: add rules for how each message type should end
- Include reply handling rules (yes, not now, cost question, why texting, STOP, reschedule, vague interest)
- Be specific and imperative
- Keep instructions under 2000 words
- Return ONLY the new instructions text -- no explanation, no markdown fences"""

# --- Helpers ---


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"best_score": -1, "run_number": 0}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def load_instructions() -> str:
    return INSTRUCTIONS_FILE.read_text().strip()


def save_instructions(instructions: str):
    INSTRUCTIONS_FILE.write_text(instructions)


# --- Generation (Claude) ---


def generate_one(anthropic_client, instructions: str, message_type: str, scenario: str) -> str | None:
    """Generate a single SMS copy variant."""
    prompt = GENERATION_PROMPT.format(
        instructions=instructions,
        message_type=message_type,
        scenario=scenario,
    )
    try:
        response = anthropic_client.messages.create(
            model=GEN_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"    GEN ERROR: {e}")
        return None


# --- Evaluation (Claude) ---


def evaluate_one(anthropic_client, message: str, message_type: str, scenario: str) -> dict | None:
    """Evaluate a single SMS message against 7 criteria."""
    prompt = EVAL_PROMPT.format(
        message=message,
        message_type=message_type,
        scenario=scenario,
    )
    try:
        response = anthropic_client.messages.create(
            model=EVAL_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        return json.loads(text)
    except Exception as e:
        print(f"    EVAL ERROR: {e}")
        return None


# --- Mutation (Claude) ---


def mutate_instructions(
    anthropic_client,
    current_instructions: str,
    eval_results: list[dict],
    best_score: int,
) -> str:
    """Use Claude to improve the copy instructions based on failure analysis."""
    n = len(eval_results)
    voice = sum(1 for r in eval_results if r.get("voice_authority"))
    jargon = sum(1 for r in eval_results if r.get("no_jargon"))
    cta = sum(1 for r in eval_results if r.get("binary_cta"))
    tone = sum(1 for r in eval_results if r.get("human_tone"))
    pressure = sum(1 for r in eval_results if r.get("no_pressure"))
    length = sum(1 for r in eval_results if r.get("under_length"))
    loop = sum(1 for r in eval_results if r.get("opens_loop"))
    score = voice + jargon + cta + tone + pressure + length + loop

    all_failures = []
    for r in eval_results:
        for f in r.get("failures", []):
            all_failures.append(f)

    unique_failures = list(dict.fromkeys(all_failures))[:25]
    failures_text = "\n".join(f"- {f}" for f in unique_failures) if unique_failures else "- None"

    mutation_prompt = MUTATION_TEMPLATE.format(
        current_instructions=current_instructions,
        score=score,
        voice_rate=voice,
        jargon_rate=jargon,
        cta_rate=cta,
        tone_rate=tone,
        pressure_rate=pressure,
        length_rate=length,
        loop_rate=loop,
        best_score=best_score,
        failures=failures_text,
    )

    response = anthropic_client.messages.create(
        model=MUTATE_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": mutation_prompt}],
    )
    return response.content[0].text.strip()


# --- Main Cycle ---


def run_cycle(anthropic_client, state: dict) -> dict:
    """Run one autoresearch optimization cycle."""
    import random

    run_num = state["run_number"] + 1
    state["run_number"] = run_num
    run_dir = VARIANTS_DIR / f"run_{run_num:03d}"
    run_dir.mkdir(parents=True, exist_ok=True)

    instructions = load_instructions()
    scenarios = random.sample(SCENARIOS, min(BATCH_SIZE, len(SCENARIOS)))

    print(f"\n{'='*60}")
    print(f"RUN {run_num} | {datetime.now().strftime('%H:%M:%S')} | Best: {state['best_score']}/70")
    print(f"{'='*60}")

    # -- Generate --
    print(f"\n  Generating {BATCH_SIZE} SMS variants...")
    generated: list[tuple[int, str, str, str]] = []  # (idx, msg_type, scenario, message)

    with ThreadPoolExecutor(max_workers=MAX_GEN_WORKERS) as pool:
        futures = {}
        for i, (msg_type, scenario) in enumerate(scenarios):
            f = pool.submit(generate_one, anthropic_client, instructions, msg_type, scenario)
            futures[f] = (i, msg_type, scenario)

        for f in as_completed(futures):
            i, msg_type, scenario = futures[f]
            try:
                message = f.result()
            except Exception as e:
                message = None
                print(f"    [{i+1}/{BATCH_SIZE}] ERROR: {e}")
            if message:
                generated.append((i, msg_type, scenario, message))
                # Save variant to file
                variant_file = run_dir / f"variant_{i:02d}.json"
                variant_file.write_text(json.dumps({
                    "message_type": msg_type,
                    "scenario": scenario,
                    "message": message,
                }, indent=2))
                preview = message[:80].replace("\n", " ")
                print(f"    [{i+1}/{BATCH_SIZE}] {msg_type}: {preview}...")
            else:
                print(f"    [{i+1}/{BATCH_SIZE}] FAILED: {msg_type}")

    if not generated:
        print("  ERROR: No variants generated. Skipping cycle.")
        save_state(state)
        return state

    # -- Evaluate --
    print(f"\n  Evaluating {len(generated)} variants...")
    eval_results: list[dict] = []

    with ThreadPoolExecutor(max_workers=MAX_EVAL_WORKERS) as pool:
        futures = {}
        for i, msg_type, scenario, message in generated:
            f = pool.submit(evaluate_one, anthropic_client, message, msg_type, scenario)
            futures[f] = (i, msg_type, message)

        for f in as_completed(futures):
            i, msg_type, message = futures[f]
            try:
                result = f.result()
            except Exception as e:
                result = None
                print(f"    [{i+1}] EVAL ERROR: {e}")

            if result:
                eval_results.append(result)
                criteria_pass = sum([
                    result.get("voice_authority", False),
                    result.get("no_jargon", False),
                    result.get("binary_cta", False),
                    result.get("human_tone", False),
                    result.get("no_pressure", False),
                    result.get("under_length", False),
                    result.get("opens_loop", False),
                ])
                fails = result.get("failures", [])
                print(f"    [{i+1}] {criteria_pass}/7 | {'; '.join(fails[:2]) if fails else 'all pass'}")
            else:
                eval_results.append({
                    "voice_authority": False, "no_jargon": False, "binary_cta": False,
                    "human_tone": False, "no_pressure": False, "under_length": False,
                    "opens_loop": False, "failures": ["eval_error"],
                })
                print(f"    [{i+1}] 0/7 | eval failed")

    # -- Score --
    voice = sum(1 for r in eval_results if r.get("voice_authority"))
    jargon = sum(1 for r in eval_results if r.get("no_jargon"))
    cta = sum(1 for r in eval_results if r.get("binary_cta"))
    tone = sum(1 for r in eval_results if r.get("human_tone"))
    pressure = sum(1 for r in eval_results if r.get("no_pressure"))
    length = sum(1 for r in eval_results if r.get("under_length"))
    loop = sum(1 for r in eval_results if r.get("opens_loop"))
    score = voice + jargon + cta + tone + pressure + length + loop

    print(f"\n  SCORE: {score}/70")
    print(f"    Voice authority: {voice}/10")
    print(f"    No jargon:      {jargon}/10")
    print(f"    Binary CTA:     {cta}/10")
    print(f"    Human tone:     {tone}/10")
    print(f"    No pressure:    {pressure}/10")
    print(f"    Under length:   {length}/10")
    print(f"    Opens loop:     {loop}/10")

    # -- Log --
    log_entry = {
        "run": run_num,
        "timestamp": datetime.now().isoformat(),
        "score": score,
        "max": 70,
        "criteria": {
            "voice_authority": voice,
            "no_jargon": jargon,
            "binary_cta": cta,
            "human_tone": tone,
            "no_pressure": pressure,
            "under_length": length,
            "opens_loop": loop,
        },
        "instructions_len": len(instructions),
        "generated": len(generated),
    }
    with open(RESULTS_FILE, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    # -- Keep or discard --
    if score > state["best_score"]:
        old_best = state["best_score"]
        state["best_score"] = score
        BEST_INSTRUCTIONS_FILE.write_text(instructions)
        print(f"\n  NEW BEST! {score}/70 (was {old_best})")
        print(f"  Saved to: {BEST_INSTRUCTIONS_FILE}")
    else:
        print(f"\n  No improvement ({score} vs best {state['best_score']})")
        if BEST_INSTRUCTIONS_FILE.exists():
            print("  Reverting to best instructions for next mutation")

    # -- Mutate --
    if score < 70:
        print("\n  Mutating instructions...")
        base = BEST_INSTRUCTIONS_FILE.read_text().strip() if BEST_INSTRUCTIONS_FILE.exists() else instructions
        new_instructions = mutate_instructions(anthropic_client, base, eval_results, state["best_score"])
        save_instructions(new_instructions)
        preview = new_instructions[:200].replace("\n", " ")
        print(f"  New instructions ({len(new_instructions)} chars):")
        print(f"    {preview}...")
    else:
        print("\n  PERFECT 70/70! Copy instructions fully optimized.")

    save_state(state)
    return state


# --- Entry Point ---


def main():
    parser = argparse.ArgumentParser(description="Dentiflow SMS autoresearch loop")
    parser.add_argument("--once", action="store_true", help="Run a single cycle")
    parser.add_argument("--cycles", type=int, default=0, help="Run N cycles (0=infinite)")
    args = parser.parse_args()

    if not ANTHROPIC_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    import anthropic

    BASE_DIR.mkdir(parents=True, exist_ok=True)
    VARIANTS_DIR.mkdir(parents=True, exist_ok=True)

    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    state = load_state()

    print("Dentiflow SMS Autoresearch")
    print(f"  Gen model:    {GEN_MODEL}")
    print(f"  Eval model:   {EVAL_MODEL}")
    print(f"  Mutate model: {MUTATE_MODEL}")
    print(f"  Batch size:   {BATCH_SIZE}")
    print(f"  Cycle:        {CYCLE_SECONDS}s")
    print(f"  Scenarios:    {len(SCENARIOS)} total")
    print(f"  State:        run {state['run_number']}, best {state['best_score']}/70")

    if args.once:
        run_cycle(anthropic_client, state)
        return

    max_cycles = args.cycles or float("inf")
    i = 0
    while i < max_cycles:
        start = time.time()
        try:
            state = run_cycle(anthropic_client, state)
        except Exception as e:
            print(f"\n  CYCLE ERROR: {e}")
            traceback.print_exc()
        elapsed = time.time() - start
        i += 1

        if i < max_cycles:
            wait = max(0, CYCLE_SECONDS - elapsed)
            if wait > 0:
                print(f"\n  Waiting {wait:.0f}s until next cycle...")
                time.sleep(wait)
            else:
                print(f"\n  Cycle took {elapsed:.0f}s (>{CYCLE_SECONDS}s budget)")

    print(f"\nDone. Best score: {state['best_score']}/70")
    if BEST_INSTRUCTIONS_FILE.exists():
        print(f"Best instructions: {BEST_INSTRUCTIONS_FILE}")


if __name__ == "__main__":
    main()

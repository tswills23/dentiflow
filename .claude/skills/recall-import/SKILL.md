---
name: recall-import
description: Process a patient recall CSV through the new segmented pipeline. Segments by location/overdue, no DB writes until explicitly approved. NEVER reads CSV content into conversation context.
allowed-tools: Bash, Glob
---

# Recall CSV Import

## When to Use
User says any of: "run recall ingest", "process recall CSV", "import patient list", "/recall-import", or similar.

## Workflow

### Step 1: Get the file path
If the user provided a file path, use it. Otherwise, find recent CSVs:
```bash
ls -lt ~/Downloads/*.csv 2>/dev/null | head -5
```
Ask the user which file to process.

### Step 2: Segment (dry run — no DB writes)
```bash
npx tsx scripts/recall-segment.ts --file "<path>"
```
Show the summary output to the user. This shows total eligible, by location, by voice tier. Nothing is written to the database.

### Step 3: Ask next step
Ask: **Google Sheet** (for review), **export CSV**, or **launch per location**?

- Google Sheet: `npx tsx scripts/recall-segment.ts --file "<path>" --sheet`
- Export CSV: `npx tsx scripts/recall-segment.ts --file "<path>" --export "<output-path>"`
- Preview a specific location: `npx tsx scripts/recall-segment.ts --file "<path>" --location "32 Cottage"`

### Step 4: Launch (when user is ready to send)
```bash
# Preview count for a location — still no DB writes
npx tsx scripts/recall-launch.ts --file "<path>" --location "<location name>"

# Load DB + interactive send confirmation
npx tsx scripts/recall-launch.ts --file "<path>" --location "<location name>" --confirm
```
The `--confirm` flag upserts patients, creates paused sequences, then prompts:
`"N sequences ready. Send SMS now? (y/N)"`
- `y` → activates sequences, sends at 1 message/second
- `N` → exits, sequences stay paused for later

**Always do one location at a time.**

## Critical Rules
- **NEVER use the Read tool on the CSV file** — the entire point is keeping CSV out of context
- **NEVER paste or display CSV rows** — only show the summary output from the CLI
- **NEVER run recall-launch without first showing the user the segment summary**
- Default practice ID is Village Dental: `a3f04cf9-54aa-4bd6-939a-d0417c42d941`
- SMS sends at 1 msg/sec enforced in code — do not attempt to speed this up

## Agent Pipeline (for reference)
1. **segmentAgent** — CSV → eligible list, no DB. `recall_eligible` means overdue + no upcoming appt.
2. **patientAgent** — upserts patients into DB
3. **sequenceAgent** — creates `paused` sequences
4. **outreachEngine** — sends Day 0 at 1/sec after sequences activated

## Eligibility Rules (codified in csvParser.ts)
- Must have phone number and first name
- Must have NO next appointment date (empty = eligible)
- Test patients (name = "Test") are filtered out
- Duplicate phone numbers are deduplicated

## Voice Tiers (codified in voiceAssignment.ts)
- < 6 months since last visit → **office** voice
- 6–12 months → **hygienist** voice
- 12+ months or no visit date → **doctor** voice

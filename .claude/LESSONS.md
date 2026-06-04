# LESSONS — what doesn't work (distilled)

This is the curated "don't repeat this" log. Claude loads it at the start of every
session (via the `session-recall` hook), so anything written here actually changes
future behavior.

**Raw command failures** are auto-captured to `.claude/failures.jsonl` and the last
15 are shown each session. This file is the *human-distilled* layer: when a real
pattern emerges ("approach X never works for Y, do Z instead"), write it here as a
short bullet so it survives and stays signal, not noise.

## Format

- **<short title>** — what was tried, why it failed, what to do instead. (date)

## Lessons

<!-- Add entries below. Newest at top. -->

- **Don't use PowerShell here-strings (`@'...'@`) in the Bash tool** — bash treats the leading `@` as a literal char, so it leaked into a git commit subject (`@ feat(...)`). For multi-line commit messages in the Bash tool, use a real heredoc: `git commit -F - <<'EOF' ... EOF`. (2026-06-04)

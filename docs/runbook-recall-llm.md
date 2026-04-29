# Runbook — Recall Reply LLM Path

> **Use this when something looks wrong, before it gets worse.** Three escalating kill switches, listed fastest first.

---

## How do I disable the LLM right now?

### Fastest (<1 second, no restart) — DB flag per practice
```sql
UPDATE practices SET recall_llm_enabled = false WHERE id = '<practice_id>';
```
This is the **primary** kill switch and what the monitor cron flips automatically. Effective on the next inbound. No deploy, no redeploy, no env var change.

### Backup — in-memory nuclear option
```bash
railway variable set RECALL_LLM_FORCE_OFF=true --service dentiflow
```
Container restarts (~45s). Once running, every reply path short-circuits to keyword/template before any DB read.

### Nuclear — global env disable
```bash
railway variable set RECALL_LLM_ENABLED=false --service dentiflow
```
Disables the LLM path for all practices regardless of their DB flag.

---

## Re-enable

Flip the DB flag back to true. Verify deploy is on the latest commit first.
```sql
UPDATE practices SET recall_llm_enabled = true WHERE id = '<practice_id>';
```
Also confirm `RECALL_LLM_FORCE_OFF` and `RECALL_LLM_ENABLED` env vars are set as expected on Railway.

---

## What does each `fallback_reason` mean?

| Reason | What it means | What to do |
|---|---|---|
| `kill_switch_db` | `practices.recall_llm_enabled = false` | Flip if it shouldn't be off, or investigate why monitor disabled |
| `kill_switch_env_disabled` | `RECALL_LLM_ENABLED != true` | Set in Railway env if you meant to enable |
| `kill_switch_force_off` | `RECALL_LLM_FORCE_OFF = true` | Clear the env var |
| `hourly_cap_exceeded` | >50 LLM replies/practice/hour | Investigate why. Bot? Loop? Real burst of traffic? |
| `api_failure` | Anthropic API error | Likely Anthropic outage. Check status.anthropic.com |
| `timeout` | Claude took >8s | Anthropic latency spike. May resolve on its own |
| `json_parse` | Claude returned non-JSON | Edit `directives/recall_reply_examples.md` if recurring |
| `schema_invalid` | JSON didn't match schema | Same as above. Check `raw_claude_content` in audit |
| `low_confidence` | Claude returned `confidence < 0.7` | Inbound was ambiguous. Working as intended |
| `reply_shape_invalid` | Failed capitalization/punctuation/URL check | Look at `raw_claude_content` for the offending reply |
| `validator_blocked` | Existing responseValidator caught a banned phrase | Check `validator_block_reason` — may indicate a prompt regression |

---

## Common audit table queries

### Last 24h overview
```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE used_llm) AS llm_used,
  COUNT(*) FILTER (WHERE fallback_reason IS NOT NULL) AS fallbacks,
  COUNT(*) FILTER (WHERE validator_block_reason IS NOT NULL) AS validator_blocks,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY llm_latency_ms) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY llm_latency_ms) AS p95
FROM recall_reply_audit
WHERE created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC;
```

### All validator blocks (these are why monitor auto-disables)
```sql
SELECT created_at, inbound_message, reply_text, validator_block_reason, raw_claude_content
FROM recall_reply_audit
WHERE validator_block_reason IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;
```

### Fallback breakdown by reason (last 24h)
```sql
SELECT fallback_reason, COUNT(*) FROM recall_reply_audit
WHERE fallback_reason IS NOT NULL AND created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC;
```

### Replies where Claude suggested an illegal state transition
```sql
SELECT inbound_message, intent, state_before, state_after, llm_suggested_state, reply_text
FROM recall_reply_audit
WHERE transition_overridden = true
ORDER BY created_at DESC LIMIT 50;
```

### Cost by day (last 7 days)
```sql
-- Sonnet 4.5 pricing as of 2026: $3/M input, $15/M output
SELECT
  DATE(created_at) AS day,
  COUNT(*) FILTER (WHERE used_llm) AS llm_replies,
  SUM(input_tokens)::numeric * 0.000003 AS input_cost_usd,
  SUM(output_tokens)::numeric * 0.000015 AS output_cost_usd,
  ROUND((SUM(input_tokens)::numeric * 0.000003 + SUM(output_tokens)::numeric * 0.000015)::numeric, 4) AS total_usd
FROM recall_reply_audit
WHERE used_llm AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

---

## Common failure modes

### Anthropic API outage
**Symptoms:** `fallback_reason = api_failure` or `timeout` spiking. Monitor warns at >25% fallback rate.
**Action:** None — fallback chain handles it. Replies still go out via keyword/template path. Check status.anthropic.com to estimate recovery.

### Prompt drift (Claude misbehavior after Anthropic model patch)
**Symptoms:** `validator_blocked` rows increasing, monitor auto-disables. Look at the `raw_claude_content` to see what Claude wrote.
**Action:**
1. Confirm the model is pinned: `claude-sonnet-4-5-20250929` in `aiClientJSON.ts`. Anthropic does not change pinned versions, so this is unlikely.
2. Check `directives/recall_reply_examples.md` for any recently added examples that may have drifted the voice.
3. Run `npx tsx scripts/test-recall-replies.ts` — does the eval suite still pass? If yes, the prompt is fine and this is a one-off.

### Validator false positive
**Symptoms:** `validator_block_reason` is firing on perfectly fine replies. E.g., the new `address_leak` regex blocks legitimate references.
**Action:** Review `src/services/execution/responseValidator.ts`. Tighten the regex. Add a unit test fixture for the false positive.

### Cost spike
**Symptoms:** Cost-by-day query shows anomalous spend. Hourly cap should bound this at ~$2-3/practice/day worst case.
**Action:** Check audit table for any one practice with abnormal volume. If a single patient is in a loop, set `recall_eligible=false` on that patient and investigate why.

### Twilio retry storm
**Symptoms:** Two replies sent for one inbound (rare).
**Action:** Verify `processed_inbound_sms` table is being written — should reject retries with code 23505. If not, check that migration 010 ran.

---

## Adding a few-shot example

Edit `directives/recall_reply_examples.md`. Format:

```markdown
## Example N — Short title

**Patient:** "the inbound text"

**Response:**
\`\`\`json
{
  "intent": "...",
  "next_state": "...",
  "action": "...",
  "reply_text": "...",
  "confidence": 0.X,
  "reasoning": "..."
}
\`\`\`
```

**RULES:**
- Examples MUST be synthetic. Never copy from `conversations` table or any real patient interaction.
- After adding, run `npx tsx scripts/test-recall-replies.ts` to confirm no regressions.
- Restart the server (in-memory directive cache picks up changes on reload).

---

## Pre-deploy verification

```bash
# 1. Build
npm run build

# 2. Eval suite (~$0.05 in API calls)
npx tsx scripts/test-recall-replies.ts

# 3. Verify Railway deploy succeeded with new commit
railway status --json | grep -E 'commitHash|status'

# 4. Confirm DB flag default
psql ... -c "SELECT id, name, recall_llm_enabled FROM practices;"
```

---

## Replay a past audit row

If a customer reports a bad reply, find it in audit and re-run:

```bash
npx tsx scripts/replay-recall-reply.ts <audit_id>
```

Output shows whether the current code produces the same reply. Useful for verifying prompt changes don't break past good outputs.

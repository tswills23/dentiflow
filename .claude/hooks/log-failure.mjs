#!/usr/bin/env node
// Auto-capture hook: logs failed Bash commands to .claude/failures.jsonl
// Fires on PostToolUse + PostToolUseFailure. Silent + non-blocking by design:
// any error here must never affect the tool run, so everything is wrapped and
// we always exit 0 with no stdout on the success path.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOG = join(HERE, '..', 'failures.jsonl'); // .claude/failures.jsonl

function readStdin() {
  try {
    return require('node:fs').readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

async function main() {
  let raw = '';
  try {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = readStdin();
  }

  let p;
  try {
    p = JSON.parse(raw);
  } catch {
    return; // no parseable payload — nothing to log
  }

  if (p.tool_name !== 'Bash') return;

  const resp = p.tool_response ?? {};
  const respObj = typeof resp === 'object' && resp !== null ? resp : {};

  // Detect a failure signal across the shapes the harness might use.
  const exit =
    respObj.exitCode ?? respObj.exit_code ?? respObj.code ?? respObj.returnCode;
  const event = p.hook_event_name ?? p.hookEventName ?? '';
  const failed =
    event === 'PostToolUseFailure' ||
    p.is_error === true ||
    respObj.isError === true ||
    respObj.is_error === true ||
    respObj.interrupted === true ||
    (typeof exit === 'number' && exit !== 0);

  if (!failed) return; // success — log nothing

  const cmd = p.tool_input?.command ?? '';
  let stderr =
    respObj.stderr ??
    (typeof resp === 'string' ? resp : '') ??
    '';
  if (typeof stderr !== 'string') stderr = JSON.stringify(stderr);
  const stderrTail = stderr.replace(/\s+$/, '').slice(-600);

  const record = {
    time: new Date().toISOString(),
    cmd: typeof cmd === 'string' ? cmd.slice(0, 800) : String(cmd),
    exitCode: typeof exit === 'number' ? exit : null,
    stderrTail,
  };

  try {
    appendFileSync(LOG, JSON.stringify(record) + '\n');
  } catch {
    // swallow — never disrupt the tool
  }
}

main().finally(() => process.exit(0));

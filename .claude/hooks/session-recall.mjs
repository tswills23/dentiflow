#!/usr/bin/env node
// Auto-recall hook (SessionStart): prints distilled LESSONS.md + recent
// auto-logged command failures so they land in Claude's starting context.
// Stdout from a SessionStart hook is injected into context.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LESSONS = join(HERE, '..', 'LESSONS.md');
const FAILURES = join(HERE, '..', 'failures.jsonl');
const TAIL = 15;

const out = [];

try {
  if (existsSync(LESSONS)) {
    const txt = readFileSync(LESSONS, 'utf8').trim();
    if (txt) out.push(txt);
  }
} catch {}

try {
  if (existsSync(FAILURES)) {
    const lines = readFileSync(FAILURES, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    const recent = lines.slice(-TAIL);
    if (recent.length) {
      const rows = recent.map((l) => {
        try {
          const r = JSON.parse(l);
          const when = (r.time || '').replace('T', ' ').replace(/\.\d+Z$/, 'Z');
          const code = r.exitCode == null ? '' : ` (exit ${r.exitCode})`;
          const err = r.stderrTail ? ` — ${r.stderrTail.replace(/\s+/g, ' ').slice(-160)}` : '';
          return `- \`${(r.cmd || '').slice(0, 160)}\`${code}${err}  [${when}]`;
        } catch {
          return null;
        }
      }).filter(Boolean);
      if (rows.length) {
        out.push('## Recent failed commands (auto-logged)\n' + rows.join('\n'));
      }
    }
  }
} catch {}

if (out.length) process.stdout.write(out.join('\n\n') + '\n');
process.exit(0);

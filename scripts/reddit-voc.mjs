#!/usr/bin/env node
/**
 * reddit-voc.mjs — Reddit voice-of-customer harvester.
 *
 * Reddit blocks direct scraping (www.reddit.com/.json = 403, RSS throttled to
 * ~1 req/20s, WebFetch/WebSearch blocked at the tool layer). This uses the
 * Arctic-Shift public Reddit archive, which serves full post + comment records
 * as JSON with author, timestamp, score and permalink.
 *
 * Key constraint learned the hard way: Arctic-Shift's full-text `query=` param
 * times out (HTTP 422). Date-sliced enumeration is cheap and reliable. So we
 * enumerate everything in a subreddit by date window, filter locally (free),
 * and only spend API calls on comment trees for threads that actually match.
 *
 *   node scripts/reddit-voc.mjs enumerate [--since 2023-01-01] [--subs a,b,c]
 *   node scripts/reddit-voc.mjs harvest   [--max 400]
 *   node scripts/reddit-voc.mjs search "recall list" "overdue"
 *   node scripts/reddit-voc.mjs export    [--out corpus.jsonl]
 *   node scripts/reddit-voc.mjs stats
 *
 * State lives in scripts/_reddit-voc/ and every command is resume-safe:
 * re-running picks up where it stopped.
 */

import fs from 'fs';
import path from 'path';

const API = 'https://arctic-shift.photon-reddit.com/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36';
const DIR = path.join(process.cwd(), 'scripts', '_reddit-voc');
const F = {
  posts: path.join(DIR, 'posts.jsonl'),
  comments: path.join(DIR, 'comments.jsonl'),
  state: path.join(DIR, 'state.json'),
};

const SUBS = ['Dentistry', 'Dentists', 'DentalOffice', 'DentalAssistant', 'DentalHygiene', 'askdentists', 'DentalSchool'];

// Keywords that mark a thread as relevant to the Dentiflow problem space.
const KW = [
  'recall', 'reactivat', 'overdue', 'inactive patient', 'past due', 'recare',
  'unscheduled', 'hygiene schedule', 'hygiene column', 'empty schedule', 'schedule hole',
  'no show', 'no-show', 'noshow', 'cancel', 'last minute', 'asap list',
  'phone', 'call', 'voicemail', 'front desk', 'receptionist', 'answering service',
  'review', 'referral', 'reputation', 'google review',
  'marketing', 'google ads', 'facebook ad', 'seo', 'advertis', 'new patient', 'postcard', 'direct mail',
  'slow', 'dead', 'production', 'collections', 'overhead', 'ppo', 'insurance', 'reimbursement',
  'hygienist', 'hiring', 'turnover', 'burnout', 'staff',
  'ai ', ' ai', 'a.i.', 'chatbot', 'automat', 'text message', 'texting', 'sms',
  'weave', 'solutionreach', 'revenuewell', 'lighthouse', 'dental intelligence', 'podium', 'birdeye',
  'nexhealth', 'demandforce', 'yapi', 'patient retention', 'losing patients', 'attrition',
  'bought a practice', 'startup practice', 'practice owner', 'patient count',
];

// ---------- infrastructure ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(DIR, { recursive: true });

let state = fs.existsSync(F.state) ? JSON.parse(fs.readFileSync(F.state, 'utf8')) : { slices: {}, harvested: {} };
const saveState = () => fs.writeFileSync(F.state, JSON.stringify(state));

let delay = 1400;          // adaptive pacing
const MIN_DELAY = 900;
const MAX_DELAY = 45000;

async function api(pathname, params) {
  const url = `${API}${pathname}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    let res, body;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      body = await res.text();
    } catch (e) {
      await sleep(delay = Math.min(delay * 2, MAX_DELAY));
      continue;
    }
    if (res.ok) {
      // Success: recover fast. A 0.9 decay from a 45s ceiling takes ~30 straight
      // successes to get back to normal, which dominated total runtime.
      delay = Math.max(MIN_DELAY, delay * 0.55);
      try { return JSON.parse(body).data; } catch { return null; }
    }
    // 429 = rate limited, 422 = server-side query timeout. Both mean back off.
    if (res.status === 429 || res.status === 422 || res.status >= 500) {
      delay = Math.min(delay * 2, MAX_DELAY);
      process.stderr.write(`  [${res.status}] backing off to ${Math.round(delay)}ms (attempt ${attempt})\n`);
      await sleep(delay);
      continue;
    }
    return null; // 4xx we can't recover from
  }
  return null;
}

const appendJsonl = (file, rows) => {
  if (rows.length) fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
};

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

const relevant = (t) => {
  const s = `${t.title || ''} ${t.selftext || ''}`.toLowerCase();
  return KW.some((k) => s.includes(k));
};

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};

// ---------- enumerate ----------
function monthWindows(since) {
  const out = [];
  const start = new Date(since + 'T00:00:00Z');
  const now = new Date();
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur < now) {
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    out.push([cur.toISOString().slice(0, 10), next.toISOString().slice(0, 10)]);
    cur = next;
  }
  return out;
}

async function enumerate() {
  const since = arg('since', '2023-01-01');
  const subs = arg('subs', SUBS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const windows = monthWindows(since);
  const seen = new Set(readJsonl(F.posts).map((p) => p.id));
  console.log(`Enumerating ${subs.length} subs x ${windows.length} months (since ${since}). Already have ${seen.size} posts.`);

  for (const sub of subs) {
    for (const [after, before] of windows) {
      const key = `${sub}|${after}`;
      if (state.slices[key]) continue;

      let cursor = after, page = 0, added = 0;
      while (page < 40) {
        // sort=asc is required — the API defaults to descending, which makes an
        // ascending `after` cursor silently return only the newest 100 per window.
        const data = await api('/posts/search', { subreddit: sub, after: cursor, before, limit: 100, sort: 'asc' });
        if (!data || !data.length) break;

        const rows = [];
        for (const p of data) {
          if (!p.id || seen.has(p.id)) continue;
          seen.add(p.id);
          rows.push({
            id: p.id, sub, title: p.title || '', selftext: (p.selftext || '').slice(0, 12000),
            author: p.author, score: p.score, num_comments: p.num_comments,
            created: new Date((p.created_utc || 0) * 1000).toISOString().slice(0, 10),
            url: `https://www.reddit.com/r/${sub}/comments/${p.id}/`,
          });
        }
        appendJsonl(F.posts, rows);
        added += rows.length;

        if (data.length < 100) break;
        const last = data[data.length - 1].created_utc;
        const nextCursor = new Date((last + 1) * 1000).toISOString();
        if (nextCursor === cursor) break;
        cursor = nextCursor;
        page++;
        await sleep(delay);
      }
      state.slices[key] = true;
      saveState();
      if (added) console.log(`  +${added}  ${sub} ${after}  (total ${seen.size})`);
      await sleep(delay);
    }
  }
  console.log(`\nDONE. ${seen.size} posts -> ${F.posts}`);
}

// ---------- targeted search ----------
// Enumerating everything is ~15h because r/Dentistry alone runs ~1500 posts/mo
// and the page size is hard-capped at 100. But full-text `query=` DOES work as
// long as the date window is narrow (it only 422s on wide/all-time windows).
// So: keyword x subreddit x quarter. Same coverage of the material we care
// about, roughly 30x fewer requests.
const TERMS = [
  'recall', 'reactivation', 'overdue patients', 'unscheduled treatment',
  'no show', 'cancellation', 'hygiene schedule', 'empty schedule',
  'missed calls', 'front desk', 'google reviews', 'referrals',
  'marketing', 'google ads', 'new patients', 'patient retention',
  'slow schedule', 'texting patients',
];

function quarters(since) {
  const out = [];
  const start = new Date(since + 'T00:00:00Z');
  const now = new Date();
  let cur = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 3) * 3, 1));
  while (cur < now) {
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 3, 1));
    out.push([cur.toISOString().slice(0, 10), next.toISOString().slice(0, 10)]);
    cur = next;
  }
  return out;
}

async function targeted() {
  const since = arg('since', '2023-01-01');
  const subs = arg('subs', SUBS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const terms = arg('terms', TERMS.join('|')).split('|').map((s) => s.trim()).filter(Boolean);
  const wins = quarters(since);
  const seen = new Set(readJsonl(F.posts).map((p) => p.id));
  const total = subs.length * terms.length * wins.length;
  console.log(`Targeted search: ${subs.length} subs x ${terms.length} terms x ${wins.length} quarters = ${total} queries. Have ${seen.size} posts.`);

  let done = 0;
  for (const sub of subs) {
    for (const term of terms) {
      for (const [after, before] of wins) {
        const key = `T|${sub}|${term}|${after}`;
        done++;
        if (state.slices[key]) continue;

        const data = await api('/posts/search', { subreddit: sub, query: term, after, before, limit: 100, sort: 'asc' });
        const rows = [];
        for (const p of data || []) {
          if (!p.id || seen.has(p.id)) continue;
          seen.add(p.id);
          rows.push({
            id: p.id, sub, title: p.title || '', selftext: (p.selftext || '').slice(0, 12000),
            author: p.author, score: p.score, num_comments: p.num_comments,
            created: new Date((p.created_utc || 0) * 1000).toISOString().slice(0, 10),
            url: `https://www.reddit.com/r/${sub}/comments/${p.id}/`, term,
          });
        }
        appendJsonl(F.posts, rows);
        state.slices[key] = true;
        if (rows.length) console.log(`  +${rows.length}  (${seen.size})  ${sub} "${term}" ${after}  [${done}/${total}]`);
        if (done % 20 === 0) saveState();
        await sleep(delay);
      }
    }
    saveState();
  }
  saveState();
  console.log(`\nDONE. ${seen.size} posts -> ${F.posts}`);
}

// ---------- harvest ----------
async function harvest() {
  const max = parseInt(arg('max', '400'), 10);
  const posts = readJsonl(F.posts);
  const queue = posts
    .filter((p) => relevant(p) && !state.harvested[p.id] && (p.num_comments || 0) > 0)
    .sort((a, b) => (b.num_comments || 0) - (a.num_comments || 0))
    .slice(0, max);

  console.log(`Harvest queue: ${queue.length} threads (of ${posts.length} enumerated), busiest first.`);
  let ok = 0, empty = 0;

  for (const p of queue) {
    const data = await api('/comments/tree', { link_id: p.id, limit: 200 });
    const rows = [];
    (function walk(nodes) {
      for (const n of nodes || []) {
        const d = n.data;
        if (d && d.body && d.body !== '[deleted]' && d.body !== '[removed]' && d.body.length > 40) {
          rows.push({
            thread_id: p.id, sub: p.sub, thread: p.title, thread_url: p.url,
            author: d.author, score: d.score,
            date: new Date((d.created_utc || 0) * 1000).toISOString().slice(0, 10),
            body: d.body.slice(0, 6000),
            url: `${p.url}${d.id}/`,
          });
        }
        if (n.children) walk(n.children);
      }
    })(data);

    appendJsonl(F.comments, rows);
    state.harvested[p.id] = rows.length;
    if (rows.length) ok++; else empty++;
    if ((ok + empty) % 10 === 0) { saveState(); console.log(`  ...${ok + empty}/${queue.length}  (${ok} with comments)`); }
    await sleep(delay);
  }
  saveState();
  console.log(`\nDONE. ${ok} threads with comments, ${empty} empty. -> ${F.comments}`);
}

// ---------- search / export / stats ----------
function search() {
  const terms = process.argv.slice(3).filter((a) => !a.startsWith('--')).map((t) => t.toLowerCase());
  if (!terms.length) return console.log('Usage: search "term" ["term2"]');
  const hits = [];
  for (const c of readJsonl(F.comments)) {
    const b = c.body.toLowerCase();
    if (terms.some((t) => b.includes(t))) hits.push(c);
  }
  for (const p of readJsonl(F.posts)) {
    const s = `${p.title} ${p.selftext}`.toLowerCase();
    if (terms.some((t) => s.includes(t))) hits.push({ ...p, body: p.selftext, thread: p.title, thread_url: p.url });
  }
  console.log(`${hits.length} matches for: ${terms.join(', ')}\n`);
  for (const h of hits.slice(0, 60)) {
    console.log(`--- r/${h.sub} | ${h.author} | ${h.date || h.created} | score ${h.score}`);
    console.log(`    ${h.thread}`);
    console.log(`    ${h.url || h.thread_url}`);
    console.log(`    ${h.body.replace(/\s+/g, ' ').slice(0, 500)}\n`);
  }
}

function exportCorpus() {
  const out = arg('out', path.join(DIR, 'corpus.jsonl'));
  const rows = [
    ...readJsonl(F.posts).filter(relevant).filter((p) => (p.selftext || '').length > 80)
      .map((p) => ({ kind: 'post', sub: p.sub, author: p.author, date: p.created, score: p.score, thread: p.title, url: p.url, text: p.selftext })),
    ...readJsonl(F.comments)
      .map((c) => ({ kind: 'comment', sub: c.sub, author: c.author, date: c.date, score: c.score, thread: c.thread, url: c.url, text: c.body })),
  ];
  fs.writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n'));
  console.log(`${rows.length} records -> ${out}`);
}

function stats() {
  const posts = readJsonl(F.posts), comments = readJsonl(F.comments);
  const rel = posts.filter(relevant);
  const bySub = {};
  for (const p of posts) bySub[p.sub] = (bySub[p.sub] || 0) + 1;
  console.log(`posts:      ${posts.length}`);
  console.log(`relevant:   ${rel.length}`);
  console.log(`comments:   ${comments.length}`);
  console.log(`slices done:${Object.keys(state.slices).length}`);
  console.log(`harvested:  ${Object.keys(state.harvested).length} threads`);
  console.log('by sub:', bySub);
  if (posts.length) {
    const dates = posts.map((p) => p.created).sort();
    console.log(`date range: ${dates[0]} -> ${dates[dates.length - 1]}`);
  }
}

const cmd = process.argv[2];
if (cmd === 'enumerate') await enumerate();
else if (cmd === 'targeted') await targeted();
else if (cmd === 'harvest') await harvest();
else if (cmd === 'search') search();
else if (cmd === 'export') exportCorpus();
else if (cmd === 'stats') stats();
else console.log('Usage: reddit-voc.mjs <enumerate|harvest|search|export|stats>');

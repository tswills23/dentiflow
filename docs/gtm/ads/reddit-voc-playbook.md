# Reddit voice-of-customer harvesting — agent playbook

How [scripts/reddit-voc.mjs](../../../scripts/reddit-voc.mjs) works, and how to build the
same thing for another niche. Written 2026-07-31 after every direct route failed.

---

## Why the obvious routes don't work

| Route | What happens |
|---|---|
| `www.reddit.com/*.json` | 403 |
| Reddit RSS | Throttled to roughly 1 request / 20s — useless at corpus scale |
| WebFetch / WebSearch tools | Blocked at the tool layer for reddit.com |
| Official Reddit API | Needs OAuth app + approval, and search is weak |
| Redlib / Libreddit mirrors | Mostly dead; the surviving ones sit behind proof-of-work |

**Hard rule: do not defeat anti-bot proof-of-work.** During this build a subagent
wrote a solver for a Redlib mirror's Anubis PoW challenge and mass-crawled 185
threads through it. That tool was deleted and the route abandoned. The quotes were
public and correctly attributed — the retrieval method was the problem. If a site
puts a computational gate in front of you, that is a "no". Use an archive instead.

## What does work

**Arctic-Shift**, a public Reddit archive that serves full post and comment records
as JSON, including author, timestamp, score and permalink.

```
https://arctic-shift.photon-reddit.com/api/posts/search
https://arctic-shift.photon-reddit.com/api/comments/tree
```

No key, no auth. Be polite with pacing.

---

## The three things that make or break it

### 1. `sort=asc` is mandatory

The API defaults to **descending**. With an ascending `after` cursor and a default
descending sort, you silently get only the newest 100 posts per window and the
paging loop exits thinking it's done. No error, no warning.

The first enumeration run returned **200 posts** for a two-month window. Adding
`sort=asc` returned **1,508**. This would have been invisible without checking the
date range of what came back.

### 2. Full-text `query=` times out — slice by date instead

`query=` returns HTTP 422 (server-side timeout) on any corpus worth having.

Invert it: **enumerate everything in the subreddit by month window, filter locally
against a keyword list, and only spend API calls on comment trees for the threads
that matched.** Local filtering is free. This turns an impossible search problem
into a cheap bulk-download problem.

### 3. Back off exponentially, but recover fast

```js
if (res.ok)  delay = Math.max(900,  delay * 0.55);   // fast recovery
else         delay = Math.min(delay * 2, 45000);     // 429 / 422 / 5xx
```

The recovery multiplier matters more than it looks. At `0.9`, climbing back down
from the 45s ceiling takes ~30 consecutive successes — that decay dominated total
runtime on the first build. `0.55` gets back to normal in about 7.

---

## Architecture

```
enumerate  → month-window every subreddit, page with an ascending cursor,
             append posts to posts.jsonl, mark each (sub, month) slice done
harvest    → local keyword filter over posts.jsonl, sort by comment count,
             fetch /comments/tree only for matches, append to comments.jsonl
search     → grep the local corpus, no network
export     → flatten to JSONL for analysis
stats      → corpus size, per-sub counts, date coverage
```

**Everything is resume-safe.** `state.json` records which `(sub, month)` slices are
complete and which post ids have been harvested. Re-running any command picks up
where it stopped — which matters, because a full enumeration takes hours and will
hit rate limits.

### The paging loop

```js
let cursor = windowStart, page = 0;
while (page < 40) {
  const data = await api('/posts/search', {
    subreddit: sub, after: cursor, before: windowEnd, limit: 100, sort: 'asc',
  });
  if (!data || !data.length) break;
  // ...append new rows, dedupe by post id against an in-memory Set...
  if (data.length < 100) break;                       // last page
  const last = data[data.length - 1].created_utc;
  const next = new Date((last + 1) * 1000).toISOString();
  if (next === cursor) break;                         // guard against a stuck cursor
  cursor = next;
  page++;
  await sleep(delay);
}
```

The `next === cursor` check is the guard against an infinite loop when many posts
share a timestamp.

---

## Reporting the findings honestly

- **Reddit selects for complaint.** People post when something is wrong. A pain
  point appearing 40 times is evidence it exists and how it's described — not
  evidence of how common it is. Say that when you report.
- **Quote verbatim, attribute to the subreddit, keep the permalink.** Don't
  paraphrase a quote into something stronger than what was written.
- **Read what the quote actually says.** In this corpus, several posts that read as
  "recall is beneath me" were, on a careful read, objecting to *the dentist
  personally* making the calls — two explicitly said the front desk should do it.
  That inverts the conclusion.
- **Don't fabricate usernames, practice names or numbers.** If you don't have it,
  say you don't have it.

---

## Paste-ready prompt

```
Build a Reddit voice-of-customer corpus for <NICHE>, covering these subreddits:
<r/sub1, r/sub2, ...>

Model it on scripts/reddit-voc.mjs and docs/gtm/ads/reddit-voc-playbook.md. The
non-obvious parts:

- Reddit direct is blocked (.json = 403, RSS throttled, WebFetch blocked). Use
  the Arctic-Shift archive: https://arctic-shift.photon-reddit.com/api
  Endpoints: /posts/search and /comments/tree. No auth needed.
- DO NOT defeat proof-of-work or other anti-bot challenges on Redlib/Libreddit
  mirrors. If a site gates you computationally, that's a no — use the archive.
- sort=asc is MANDATORY on /posts/search. The API defaults to descending, which
  makes an ascending `after` cursor silently return only the newest 100 per
  window with no error. Verify by checking the date range of what comes back.
- Do NOT use the full-text `query=` param — it returns HTTP 422 (server-side
  timeout). Instead: enumerate by month window, filter locally against a keyword
  list, and spend API calls on comment trees only for threads that matched.
- Adaptive pacing: on success delay = max(900, delay*0.55); on 429/422/5xx
  delay = min(delay*2, 45000). The fast recovery multiplier matters — 0.9 takes
  ~30 successes to climb down from the ceiling and will dominate your runtime.
- Page with cursor = ISO(last created_utc + 1s), break when a page returns <100
  or the cursor stops advancing.
- Write posts and comments to JSONL, keep a state.json of completed (sub, month)
  slices and harvested post ids, and make every command resume-safe. A full
  enumeration takes hours and will hit limits.

Then report the recurring pain points with verbatim quotes, subreddit and
permalink for each.

State plainly that Reddit selects for complaint: frequency in this corpus shows
that a problem exists and how people describe it, not how common it is. Read each
quote carefully before categorising it — check whether the person is objecting to
the thing itself or to some specific detail of it. Never invent usernames,
business names or figures.
```

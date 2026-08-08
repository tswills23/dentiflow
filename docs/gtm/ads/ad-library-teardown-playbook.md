# Meta Ad Library teardown — agent playbook

Hand this file (or the prompt block at the bottom) to any agent that needs to pull a
competitor's live static ads off the Meta Ad Library and analyse them.

Written after doing this for the Alex Hormozi page (2026-08-04). Every gotcha below
cost a failed run.

---

## What works

**Only a real browser.** Plain `curl` returns HTTP 403 with a JS challenge
(`__rd_verify_...`) that POSTs and reloads. `chrome --headless --dump-dom` also fails
because it captures the DOM before the challenge's reload completes. Driving Chrome
with puppeteer-core and *waiting* gets through — the challenge resolves itself.

**You need the advertiser's page ID, not a keyword.** Keyword search returns garbage:
searching `acquisition.com` returned 440 ads, zero of them Hormozi's. Get the ID by
opening the Ad Library in a browser, searching the advertiser by name, clicking them,
and copying `view_all_page_id=` out of the URL.

**Dedupe by image content hash, never by ad copy.** The single most important lesson.
Hormozi's account ran 132 ads with *byte-identical body copy* and 132 *different*
images. Deduping by ad text collapsed the whole campaign into one row and hid the
entire finding. Download the images and `md5sum` them.

---

## URL parameters that break it

| Parameter | Result |
|---|---|
| `media_type=image` | Page never loads. Use `media_type=all` and filter later. |
| `sort_data[mode]=...&sort_data[direction]=...` | Page never loads. Drop the bracket params. |
| `q=<keyword>&search_type=keyword_unordered` | Loads, but returns unrelated advertisers. |

The form that works:

```
https://www.facebook.com/ads/library/?active_status=active&ad_type=all
  &country=US&is_targeted_country=false&media_type=all
  &search_type=page&view_all_page_id=<PAGE_ID>
```

---

## The script

```js
// npm install puppeteer-core   (uses the Chrome already on the machine)
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE_ID = process.argv[2];
const TAG = process.argv[3] || 'out';
const SCROLLS = +(process.argv[4] || 18);

const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all`
  + `&country=US&is_targeted_country=false&media_type=all&search_type=page`
  + `&view_all_page_id=${PAGE_ID}`;

const b = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  defaultViewport: { width: 1500, height: 1100 },
});
const p = await b.newPage();
await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

// The anti-bot challenge POSTs then reloads. Wait it out; reload if the body is empty.
let ok = false;
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const t = await p.evaluate(() => document.body.innerText).catch(() => '');
  if (/Library ID/i.test(t)) { ok = true; break; }
  if (t.length < 200) await p.reload({ waitUntil: 'domcontentloaded' });
}
if (!ok) { console.error('never loaded'); process.exit(1); }

// Cards lazy-load on scroll.
for (let i = 0; i < SCROLLS; i++) {
  await p.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
  await new Promise(r => setTimeout(r, 2000));
}

const data = await p.evaluate(() => {
  const out = [], seen = new Set();
  for (const im of document.querySelectorAll('img')) {
    if (im.naturalWidth < 280 || im.naturalHeight < 280) continue;  // skips avatars
    if (!/scontent|fbcdn/.test(im.src) || seen.has(im.src)) continue;
    seen.add(im.src);
    let n = im, card = null;
    for (let d = 0; d < 15 && n; d++, n = n.parentElement) {
      if (n.innerText && /Library ID/i.test(n.innerText)) { card = n; break; }
    }
    out.push({ src: im.src, w: im.naturalWidth, h: im.naturalHeight,
               text: card ? card.innerText.slice(0, 1200) : '' });
  }
  return out;
});
fs.writeFileSync(`${TAG}_ads.json`, JSON.stringify(data, null, 2));
console.log(TAG, 'creatives:', data.length);
await b.close();
```

Then download and dedupe by content, **not** by copy:

```bash
mkdir -p imgs
node -e "require('./out_ads.json').forEach((x,i)=>console.log(i,x.src))" \
  | while read i u; do curl -s --max-time 25 -o "imgs/$(printf %03d $i).jpg" "$u" </dev/null; done
md5sum imgs/*.jpg | sort | uniq -w32 | awk '{print $2}'   # one file per unique creative
```

`curl` inside a `while read` loop eats stdin — the `</dev/null` is required or you
only get the first image.

---

## Then actually look at them

Read the deduped images. The pattern is visual and will not show up in the JSON.

Sample the exact background colour so the spec is reproducible:

```powershell
Add-Type -AssemblyName System.Drawing
$b=[System.Drawing.Bitmap]::FromFile("imgs\000.jpg")
$c=$b.GetPixel(20,20); "#{0:X2}{1:X2}{2:X2}" -f $c.R,$c.G,$c.B
```

---

## What to report

1. **Campaign mix** — group the card text and count. "N of M active ads are one
   campaign" is usually the headline finding.
2. **Unique creatives per campaign** — deduped count. High count + identical copy
   means they're scaling the creative variable, not the offer.
3. **The swapped variable** — what actually changes between creatives (industry,
   audience, claim, format).
4. **Exact spec** — dimensions, background hex, typeface family, what's bold,
   how much negative space, presence/absence of logo, photo, CTA button.
5. **Format census** — every distinct layout and roughly what share of ads uses it.
6. **Start dates** — `Started running on <date>` in the card text. Long-running =
   survived a cull. All-recent = an unproven push.

---

## State honestly

- **The Ad Library shows no spend and no results for commercial ads.** Volume and
  longevity are the only signals. 132 variants means commitment, not proven ROAS.
  Never present it as "what's working."
- **Say what fraction you sampled.** 30 of 132 creatives is a sample, not a census.
  Do not claim an advertiser is or isn't targeting a niche you didn't see.
- **Only the EU/DSA-covered ads are in the official API.** For US commercial ads,
  `graph.facebook.com/ads_archive` returns political/issue ads only, so it can't
  replace this.

---

## Paste-ready prompt

```
Pull and analyse the live static ads for <ADVERTISER> from the Meta Ad Library.

Their Ad Library page ID is <PAGE_ID>.
(If unknown: open facebook.com/ads/library, search the advertiser by name, click
them, and take view_all_page_id from the URL.)

Follow docs/gtm/ads/ad-library-teardown-playbook.md exactly. The critical points:

- Plain HTTP gets a 403 anti-bot challenge. Use puppeteer-core against local
  Chrome, headless, and wait through the reload before reading the DOM.
- Use media_type=all. media_type=image and sort_data[...] params break the page.
- Scroll repeatedly; cards lazy-load.
- DEDUPE BY IMAGE CONTENT HASH, NOT BY AD COPY. Advertisers run many unique
  creatives under identical body text, and deduping by text hides the whole
  pattern.
- Download the deduped images and actually view them.

Report: campaign mix (X of Y active ads are one campaign), unique creatives per
campaign, what variable changes between them, exact reproducible spec
(dimensions, background hex, typeface, what's bold, negative space, logo/photo/
button present or not), a census of every distinct format, and the start-date
range.

State what fraction of creatives you sampled. The Ad Library exposes no spend or
performance data for commercial ads, so describe volume and longevity as signals
of commitment, never as proof that something works.
```

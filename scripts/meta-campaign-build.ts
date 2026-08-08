// Build the reactivation campaign through the Marketing API.
//
//   npx tsx scripts/meta-campaign-build.ts             → dry run, creates nothing
//   npx tsx scripts/meta-campaign-build.ts --confirm   → creates everything PAUSED
//
// Everything is created with status PAUSED. Nothing delivers and nothing
// spends until a human flips it to ACTIVE in Ads Manager. This script never
// activates anything — same gate as recall-launch.
//
// Settings mirror docs/meta-campaign-build.md. Ad bodies are parsed out of
// docs/meta-ads-launch-set.md so the copy has one source of truth.

import 'dotenv/config';
import fs from 'fs';

const V = process.env.META_API_VERSION || 'v23.0';
const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACT = process.env.META_AD_ACCOUNT_ID!;
const PAGE = process.env.META_PAGE_ID!;
const PIXEL = process.env.META_PIXEL_ID!;
const LANDING = process.env.META_LANDING_URL!;

const CONFIRM = process.argv.includes('--confirm');

const CAMPAIGN_NAME = 'RX | Leads | Reactivation | Sprint';
const ADSET_NAME = 'Broad | US | 25-65';
const DAILY_BUDGET_CENTS = 5000; // $50/day

const UTM =
  'utm_source=facebook&utm_medium=paid&utm_campaign=reactivation' +
  '&utm_content={{ad.name}}&utm_term={{placement}}';

// image_hash → the ad it belongs to. Ad 6 is omitted: its plate is landscape
// and carries a typo ("32 boked back"). Add it once a 4:5 replacement exists.
const ADS = [
  {
    name: 'RX | A | embarrassed',
    adNumber: 3,
    imageHash: 'fcf3bcbeb485f19cbbeeeaa476343f1d',
    headline: "They aren't gone. They're embarrassed.",
    description: 'A blast can’t answer "will they judge me?"',
  },
  {
    name: 'RX | C | sends',
    adNumber: 4,
    imageHash: '1a544b1685fcb02ded96b2238956be33',
    headline: "Sends don't fill hygiene chairs",
    description: 'A named list of who booked. Verified.',
  },
];

// ── Graph helpers ────────────────────────────────────────────────────
async function get(path: string, params: Record<string, string> = {}) {
  const u = new URL(`https://graph.facebook.com/${V}/${path}`);
  Object.entries({ ...params, access_token: TOKEN }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  const j: any = await r.json();
  if (j.error) throw new Error(`GET ${path}: ${j.error.message}`);
  return j;
}

async function post(path: string, body: Record<string, unknown>) {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const j: any = await r.json();
  if (j.error) {
    const e = j.error;
    throw new Error(`POST ${path}: ${e.message}${e.error_user_msg ? ` — ${e.error_user_msg}` : ''}`);
  }
  return j;
}

// ── Pull ad body copy from the launch file ───────────────────────────
function adBody(n: number): string {
  const md = fs.readFileSync('docs/meta-ads-launch-set.md', 'utf8');
  const start = md.indexOf(`## Ad ${n} —`);
  if (start === -1) throw new Error(`Ad ${n} not found in launch set`);
  const section = md.slice(start, md.indexOf('\n## ', start + 5));
  const pt = section.indexOf('**Primary text**');
  if (pt === -1) throw new Error(`Ad ${n} has no Primary text block`);
  const lines = section.slice(pt).split('\n').slice(1);
  const out: string[] = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    if (!l.trim().startsWith('>')) break;
    out.push(l.trim().replace(/^>\s?/, ''));
  }
  return out.join('\n').trim();
}

async function main() {
  for (const [k, v] of Object.entries({ TOKEN, ACT, PAGE, PIXEL, LANDING })) {
    if (!v) throw new Error(`Missing env: META_${k === 'ACT' ? 'AD_ACCOUNT_ID' : k}`);
  }

  const targeting = {
    geo_locations: { countries: ['US'] },
    age_min: 25,
    age_max: 65,
    targeting_automation: { advantage_audience: 1 },
    publisher_platforms: ['facebook', 'instagram'],
    // Feed surfaces only. The creative has a CTA bar locked to the bottom
    // edge, which a 9:16 Stories/Reels crop would cut off.
    facebook_positions: ['feed', 'marketplace'],
    instagram_positions: ['stream'], // 'explore' is deprecated in v23+
    device_platforms: ['mobile', 'desktop'],
  };

  console.log('CAMPAIGN  ', CAMPAIGN_NAME, '| OUTCOME_LEADS | PAUSED');
  console.log('AD SET    ', ADSET_NAME, `| $${DAILY_BUDGET_CENTS / 100}/day | Schedule | PAUSED`);
  for (const a of ADS) {
    const body = adBody(a.adNumber);
    console.log(`\nAD        ${a.name}  (Ad ${a.adNumber} copy, ${body.split(/\s+/).length} words)`);
    console.log(`  headline    ${a.headline}`);
    console.log(`  description ${a.description}`);
    console.log(`  image       ${a.imageHash}`);
    console.log(`  first line  ${body.split('\n')[0].slice(0, 80)}…`);
  }

  if (!CONFIRM) {
    console.log('\n── DRY RUN. Nothing created. Re-run with --confirm ──');
    return;
  }

  // Reuse a campaign of the same name if one exists, so a failed run partway
  // through does not leave a second copy behind on retry.
  const existing = await get(`${ACT}/campaigns`, { fields: 'id,name,status', limit: '50' });
  const prior = (existing.data || []).find(
    (c: any) => c.name === CAMPAIGN_NAME && c.status !== 'DELETED'
  );
  const campaign = prior
    ? (console.log(`\nreusing campaign ${prior.id}`), prior)
    : await post(`${ACT}/campaigns`, {
    name: CAMPAIGN_NAME,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: [],
    // Required when the budget lives on the ad set. False keeps the $50/day
    // exactly where it is instead of letting Meta reallocate 20% of it.
    is_adset_budget_sharing_enabled: false,
  });
  console.log(`\ncampaign ${campaign.id}`);

  const adset = await post(`${ACT}/adsets`, {
    name: ADSET_NAME,
    campaign_id: campaign.id,
    daily_budget: DAILY_BUDGET_CENTS,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL, custom_event_type: 'SCHEDULE' },
    targeting,
    status: 'PAUSED',
  });
  console.log(`ad set   ${adset.id}`);

  for (const a of ADS) {
    const creative = await post(`${ACT}/adcreatives`, {
      name: `${a.name} | creative`,
      object_story_spec: {
        page_id: PAGE,
        link_data: {
          image_hash: a.imageHash,
          message: adBody(a.adNumber),
          name: a.headline,
          description: a.description,
          link: LANDING,
          call_to_action: { type: 'LEARN_MORE', value: { link: LANDING } },
        },
      },
      url_tags: UTM,
      // Advantage+ creative rewrites headlines and restyles images. Off.
      degrees_of_freedom_spec: {
        creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } },
      },
    });

    const ad = await post(`${ACT}/ads`, {
      name: a.name,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });
    console.log(`ad       ${ad.id}  ${a.name}`);
  }

  console.log('\nAll objects PAUSED. Nothing is delivering and nothing will spend.');
  console.log('Review in Ads Manager, then activate there yourself.');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});

/**
 * YouTube Comment Scraper for Dental Business Channels
 *
 * Uses YouTube Data API v3 for both video discovery AND comment fetching.
 * Sorts by viewCount to get videos with actual engagement/comments.
 *
 * Usage: node scripts/scrape_youtube_comments.mjs [--query keyword]
 *
 * Outputs raw comments to:
 *   .claude/skills/linkedin-content-agent/data/youtube-comments/raw/[date]_[channel].jsonl
 *
 * Quota budget per run:
 *   - 4 channel searches × 100 units = 400
 *   - ~80 videos × 1 unit (commentThreads) = 80
 *   - Total: ~480 units (4.8% of 10,000 daily free tier)
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) {
  console.error('ERROR: YOUTUBE_API_KEY not found in .env');
  console.error('Setup: Create API key in Google Cloud console, enable YouTube Data API v3');
  process.exit(1);
}

const API_BASE = 'https://www.googleapis.com/youtube/v3';

// Target dental business channels — resolved channel IDs
const TARGET_CHANNELS = [
  { channelId: 'UC7yDStHRbJcth9AqLTg2O4Q', slug: 'dentalpreneur', label: 'Dentalpreneur (Dr. Mark Costes)' },
  { channelId: 'UC7zftDZmIlZHYLPQq6ueQ9Q', slug: 'dental-marketer', label: 'The Dental Marketer' },
  { channelId: 'UCFxp8Fm0xDxzN3zn8RXERGQ', slug: 'mge', label: 'MGE Management Experts' },
];

const OUTPUT_DIR = resolve(__dirname, '..', '.claude', 'skills', 'linkedin-content-agent', 'data', 'youtube-comments', 'raw');
const TODAY = new Date().toISOString().split('T')[0];
const VIDEOS_PER_CHANNEL = 20;
const MAX_COMMENTS_PER_VIDEO = 50;

// --- YouTube Data API helpers ---

async function apiGet(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set('key', YOUTUBE_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${endpoint} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function getTopVideos(channelId, maxResults = VIDEOS_PER_CHANNEL) {
  // search.list costs 100 quota units — order by viewCount to get videos with engagement
  const data = await apiGet('search', {
    part: 'id,snippet',
    channelId,
    order: 'viewCount',
    type: 'video',
    maxResults: String(maxResults),
  });
  return (data.items || []).map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
  }));
}

async function fetchComments(videoId, maxResults = MAX_COMMENTS_PER_VIDEO) {
  // commentThreads.list costs 1 quota unit per request
  try {
    const data = await apiGet('commentThreads', {
      part: 'snippet',
      videoId,
      maxResults: String(maxResults),
      textFormat: 'plainText',
      order: 'relevance',
    });

    if (!data.items || data.items.length === 0) return [];

    return data.items.map(item => {
      const snippet = item.snippet.topLevelComment.snippet;
      return {
        videoId,
        commentId: item.id,
        author: snippet.authorDisplayName || 'Unknown',
        text: snippet.textDisplay || '',
        likes: snippet.likeCount || 0,
        publishedAt: snippet.publishedAt || '',
        replyCount: item.snippet.totalReplyCount || 0,
      };
    });
  } catch (e) {
    // Comments might be disabled on some videos
    if (e.message.includes('403') || e.message.includes('commentsDisabled')) {
      return [];
    }
    console.warn(`  Comment fetch failed for ${videoId}: ${e.message}`);
    return [];
  }
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);

  // Optional: search for dental-related videos across all of YouTube
  const querySearch = args.includes('--query') ? args[args.indexOf('--query') + 1] : null;

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalComments = 0;
  let totalVideos = 0;
  let quotaUsed = 0;

  // If --query is passed, search across all of YouTube instead of specific channels
  if (querySearch) {
    console.log(`\n=== KEYWORD SEARCH: "${querySearch}" ===`);
    const data = await apiGet('search', {
      part: 'id,snippet',
      q: querySearch,
      type: 'video',
      order: 'viewCount',
      maxResults: '20',
    });
    quotaUsed += 100;

    const videos = (data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    console.log(`  Found ${videos.length} videos`);
    const outputFile = resolve(OUTPUT_DIR, `${TODAY}_search-${querySearch.replace(/\s+/g, '-').toLowerCase()}.jsonl`);

    for (const video of videos) {
      console.log(`  Fetching comments: "${video.title}" (${video.videoId})`);
      const comments = await fetchComments(video.videoId);
      quotaUsed += 1;

      const lines = comments.map(c => JSON.stringify({
        ...c,
        videoTitle: video.title,
        channel: 'search',
        channelLabel: video.channelTitle,
        scrapedAt: new Date().toISOString(),
      }));

      if (lines.length > 0) {
        const prefix = existsSync(outputFile) ? '\n' : '';
        writeFileSync(outputFile, prefix + lines.join('\n'), { flag: 'a' });
      }

      console.log(`    → ${comments.length} comments`);
      totalComments += comments.length;
      totalVideos++;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Scrape target channels
  for (const channel of TARGET_CHANNELS) {
    console.log(`\n=== ${channel.label} ===`);

    const videos = await getTopVideos(channel.channelId);
    quotaUsed += 100;
    console.log(`  Found ${videos.length} top videos (by view count)`);

    const outputFile = resolve(OUTPUT_DIR, `${TODAY}_${channel.slug}.jsonl`);
    let channelComments = 0;

    for (const video of videos) {
      const comments = await fetchComments(video.videoId);
      quotaUsed += 1;
      channelComments += comments.length;

      const lines = comments.map(c => JSON.stringify({
        ...c,
        videoTitle: video.title,
        channel: channel.slug,
        channelLabel: channel.label,
        scrapedAt: new Date().toISOString(),
      }));

      if (lines.length > 0) {
        const prefix = existsSync(outputFile) ? '\n' : '';
        writeFileSync(outputFile, prefix + lines.join('\n'), { flag: 'a' });
      }

      if (comments.length > 0) {
        console.log(`  "${video.title}" → ${comments.length} comments`);
      }
      totalVideos++;
      await new Promise(r => setTimeout(r, 200));
    }

    totalComments += channelComments;
    console.log(`  Total for ${channel.label}: ${channelComments} comments from ${videos.length} videos`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total videos checked: ${totalVideos}`);
  console.log(`Total comments collected: ${totalComments}`);
  console.log(`Quota used: ~${quotaUsed} units`);
  console.log(`Output: ${OUTPUT_DIR}/${TODAY}_*.jsonl`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

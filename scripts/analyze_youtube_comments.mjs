/**
 * YouTube Comment Analyzer — Claude-powered classification
 *
 * Reads raw comment JSONL files, batches them through Claude for classification
 * (intent, topic, sentiment, quotability), then generates an insights summary.
 *
 * Usage: node scripts/analyze_youtube_comments.mjs [--date YYYY-MM-DD]
 *
 * Outputs:
 *   data/youtube-comments/analysis/[date]_tagged.jsonl    — classified comments
 *   data/youtube-comments/analysis/[date]_insights.md     — research brief
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenv = await import('dotenv');
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const RAW_DIR = resolve(__dirname, '..', '.claude', 'skills', 'linkedin-content-agent', 'data', 'youtube-comments', 'raw');
const ANALYSIS_DIR = resolve(__dirname, '..', '.claude', 'skills', 'linkedin-content-agent', 'data', 'youtube-comments', 'analysis');
const BATCH_SIZE = 20; // Comments per Claude call (keep small to avoid token truncation)
const MODEL = 'claude-sonnet-4-5-20250929';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CLASSIFICATION_PROMPT = `You are analyzing YouTube comments from dental business channels (Dentalpreneur, The Dental Marketer, MGE Management Experts, Dental Economics).

These comments are from practice owners, associates, office managers, and dental professionals discussing the BUSINESS side of dentistry.

For each comment, classify:

1. **intent**: question | complaint | pain_point | testimonial | advice_seeking | agreement | off_topic
2. **topic**: recall | no_shows | ppo_insurance | staffing | marketing | overhead | scheduling | patient_retention | reviews | speed_to_lead | ai_automation | case_acceptance | production | collections | practice_acquisition | work_life_balance | other
3. **sentiment**: frustrated | curious | neutral | satisfied | hopeful
4. **quotable**: true | false — Would this comment make a compelling, relatable quote in a LinkedIn post targeting dental practice owners? Must be specific, emotionally resonant, and reflect a real pain point or insight.
5. **cleaned_quote**: If quotable=true, provide a lightly edited version suitable for quoting (fix typos, trim filler, keep the voice authentic). If quotable=false, set to null.

IMPORTANT:
- Skip comments that are pure spam, self-promotion, or completely off-topic (set intent to "off_topic")
- Focus on comments that reveal real business challenges, frustrations, or insights
- A "quotable" comment should feel like something a real dentist said that would make another dentist nod in recognition

Return a JSON array (no markdown fencing). Each element must have: commentId, intent, topic, sentiment, quotable, cleaned_quote.`;

// --- Load raw comments ---

function loadRawComments(date) {
  const files = readdirSync(RAW_DIR).filter(f => f.startsWith(date) && f.endsWith('.jsonl'));
  if (files.length === 0) {
    console.error(`No raw comment files found for date ${date} in ${RAW_DIR}`);
    process.exit(1);
  }

  const comments = [];
  for (const file of files) {
    const content = readFileSync(resolve(RAW_DIR, file), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        comments.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
  return comments;
}

// --- Classify comments via Claude ---

async function classifyBatch(comments) {
  const stripped = comments.map(c => ({
    commentId: c.commentId,
    author: c.author,
    text: c.text,
    likes: c.likes,
    videoTitle: c.videoTitle,
    channel: c.channelLabel || c.channel,
  }));

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: CLASSIFICATION_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Classify these ${stripped.length} YouTube comments:\n\n${JSON.stringify(stripped, null, 2)}`,
      },
    ],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  try {
    // Strip markdown code fences — handle ```json\n...\n``` format
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
    }
    return JSON.parse(cleaned.trim());
  } catch (e) {
    console.warn(`  Failed to parse Claude response for batch: ${e.message}`);
    console.warn(`  Response preview: ${text.substring(0, 200)}`);
    // Try to extract JSON array from the response as fallback
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.warn(`  Fallback parse also failed: ${e2.message}`);
      }
    }
    return [];
  }
}

// --- Generate insights summary ---

function generateInsights(comments, classifications, date) {
  // Merge raw comments with their classifications
  const classMap = new Map();
  for (const c of classifications) {
    classMap.set(c.commentId, c);
  }

  const merged = comments.map(c => ({
    ...c,
    ...(classMap.get(c.commentId) || {}),
  })).filter(c => c.intent && c.intent !== 'off_topic');

  // Aggregate by topic
  const topicCounts = {};
  const topicQuotes = {};
  const intentCounts = {};
  const sentimentCounts = {};
  const channelCounts = {};

  for (const c of merged) {
    topicCounts[c.topic] = (topicCounts[c.topic] || 0) + 1;
    intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1;
    sentimentCounts[c.sentiment] = (sentimentCounts[c.sentiment] || 0) + 1;
    const ch = c.channelLabel || c.channel;
    channelCounts[ch] = (channelCounts[ch] || 0) + 1;

    if (c.quotable && c.cleaned_quote) {
      if (!topicQuotes[c.topic]) topicQuotes[c.topic] = [];
      topicQuotes[c.topic].push({
        quote: c.cleaned_quote,
        author: c.author,
        channel: ch,
        videoTitle: c.videoTitle,
        likes: c.likes,
      });
    }
  }

  // Sort topics by count
  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  const sortedIntents = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);
  const sortedSentiments = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1]);

  // Build markdown report
  let md = `# YouTube Comment Insights -- ${date}\n\n`;
  md += `**Source:** ${Object.keys(channelCounts).length} dental business channels\n`;
  md += `**Comments analyzed:** ${merged.length} (after filtering off-topic/spam)\n`;
  md += `**Quotable comments found:** ${merged.filter(c => c.quotable).length}\n\n`;

  md += `## Top Pain Point Topics\n\n`;
  md += `| Topic | Count | % of Total |\n`;
  md += `|-------|-------|------------|\n`;
  for (const [topic, count] of sortedTopics) {
    md += `| ${topic} | ${count} | ${((count / merged.length) * 100).toFixed(1)}% |\n`;
  }

  md += `\n## Comment Intents\n\n`;
  md += `| Intent | Count |\n`;
  md += `|--------|-------|\n`;
  for (const [intent, count] of sortedIntents) {
    md += `| ${intent} | ${count} |\n`;
  }

  md += `\n## Sentiment Distribution\n\n`;
  md += `| Sentiment | Count |\n`;
  md += `|-----------|-------|\n`;
  for (const [sentiment, count] of sortedSentiments) {
    md += `| ${sentiment} | ${count} |\n`;
  }

  md += `\n## Best Quotable Comments by Topic\n\n`;
  for (const [topic, quotes] of Object.entries(topicQuotes)) {
    // Sort by likes, take top 3
    const top = quotes.sort((a, b) => b.likes - a.likes).slice(0, 3);
    if (top.length === 0) continue;
    md += `### ${topic}\n\n`;
    for (const q of top) {
      md += `> "${q.quote}"\n`;
      md += `> -- ${q.author} (${q.channel}, ${q.likes} likes)\n`;
      md += `> Video: ${q.videoTitle}\n\n`;
    }
  }

  md += `## Channel Breakdown\n\n`;
  md += `| Channel | Comments |\n`;
  md += `|---------|----------|\n`;
  for (const [ch, count] of Object.entries(channelCounts).sort((a, b) => b[1] - a[1])) {
    md += `| ${ch} | ${count} |\n`;
  }

  md += `\n## Recommended Content Angles (from comment themes)\n\n`;
  // Auto-generate suggestions from top topics
  for (const [topic, count] of sortedTopics.slice(0, 5)) {
    const quotes = topicQuotes[topic] || [];
    const topQuote = quotes[0]?.quote || 'No quotable comments';
    md += `- **${topic}** (${count} mentions): "${topQuote}"\n`;
  }

  return md;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : null;
  const date = dateArg || new Date().toISOString().split('T')[0];

  mkdirSync(ANALYSIS_DIR, { recursive: true });

  console.log(`Loading raw comments for ${date}...`);
  const comments = loadRawComments(date);
  console.log(`Loaded ${comments.length} raw comments`);

  if (comments.length === 0) {
    console.log('No comments to analyze.');
    process.exit(0);
  }

  // Filter out very short / useless comments before sending to Claude
  const meaningful = comments.filter(c => c.text && c.text.length > 15);
  console.log(`${meaningful.length} meaningful comments (>15 chars) to classify`);

  // Batch through Claude
  const allClassifications = [];
  const batches = Math.ceil(meaningful.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batch = meaningful.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    console.log(`  Classifying batch ${i + 1}/${batches} (${batch.length} comments)...`);

    const classifications = await classifyBatch(batch);
    allClassifications.push(...classifications);

    // Respect rate limits
    if (i < batches - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`Classified ${allClassifications.length} comments total`);

  // Save tagged JSONL
  const taggedFile = resolve(ANALYSIS_DIR, `${date}_tagged.jsonl`);
  const taggedLines = allClassifications.map(c => JSON.stringify(c)).join('\n');
  writeFileSync(taggedFile, taggedLines);
  console.log(`Saved tagged classifications to ${taggedFile}`);

  // Generate insights markdown
  const insights = generateInsights(meaningful, allClassifications, date);
  const insightsFile = resolve(ANALYSIS_DIR, `${date}_insights.md`);
  writeFileSync(insightsFile, insights);
  console.log(`Saved insights report to ${insightsFile}`);

  // Print summary
  const topicCounts = {};
  for (const c of allClassifications) {
    if (c.topic && c.intent !== 'off_topic') {
      topicCounts[c.topic] = (topicCounts[c.topic] || 0) + 1;
    }
  }
  console.log('\n=== TOP PAIN POINT TOPICS ===');
  Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([topic, count]) => console.log(`  ${topic}: ${count}`));

  const quotable = allClassifications.filter(c => c.quotable);
  console.log(`\nQuotable comments found: ${quotable.length}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

// Claude wrapper for structured JSON responses.
// Used by recall reply AI; mirrors aiClient.ts but with:
//  - Temperature 0 (deterministic across runs)
//  - 8s timeout (leaves headroom under Twilio 15s)
//  - Token usage telemetry returned to caller
//  - Pinned model, never `latest`

import Anthropic from '@anthropic-ai/sdk';

let _anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const MODEL = 'claude-sonnet-4-5-20250929';
const TIMEOUT_MS = 8000;

export interface AIJSONResponse {
  content: string;
  success: boolean;
  error?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

export async function generateStructuredJSON(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  maxTokens = 400
): Promise<AIJSONResponse> {
  const start = Date.now();

  try {
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await getClient().messages.create(
        {
          model: MODEL,
          max_tokens: maxTokens,
          temperature: 0,
          system: systemPrompt,
          messages,
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const usage = response.usage as Anthropic.Usage & { cache_read_input_tokens?: number };
      const latencyMs = Date.now() - start;
      console.log(`[aiClientJSON] tokens in=${usage.input_tokens} out=${usage.output_tokens} cache=${usage.cache_read_input_tokens || 0} latency=${latencyMs}ms`);

      return {
        content: text,
        success: true,
        latencyMs,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    const isTimeout = message.includes('aborted') || message.includes('AbortError');
    console.error('[aiClientJSON] error:', message);

    return {
      content: '',
      success: false,
      error: isTimeout ? 'timeout' : message,
      latencyMs: Date.now() - start,
    };
  }
}

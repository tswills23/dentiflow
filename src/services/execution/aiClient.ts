import Anthropic from '@anthropic-ai/sdk';

let _anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 300;
const TIMEOUT_MS = 12000; // Must respond within Twilio's 15s window

export interface AIResponse {
  content: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export async function generateResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<AIResponse> {
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
          max_tokens: MAX_TOKENS,
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

      return {
        content: text,
        success: true,
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    console.error('[aiClient] Error generating response:', message);

    return {
      content: '',
      success: false,
      error: message,
      latencyMs: Date.now() - start,
    };
  }
}

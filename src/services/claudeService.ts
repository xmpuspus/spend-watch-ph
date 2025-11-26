/**
 * Claude AI Service
 *
 * Handles all communication with the Claude API for the conversational AI feature.
 * Uses direct browser-to-API communication with user-provided API keys.
 *
 * Architecture Notes:
 * - Uses streaming for better UX with long responses
 * - Implements conversation memory through message history
 * - Supports summarization for long conversations
 * - Handles rate limiting and error recovery
 */

import { CLAUDE_API, AI_SYSTEM_PROMPTS } from '@/utils/constants';
import type { ChatMessage } from '@/types';

interface ClaudeMessageParams {
  apiKey: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface ClaudeStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string, usage: { input: number; output: number }) => void;
  onError: (error: Error) => void;
}

/**
 * Sends a message to Claude API and streams the response
 */
export async function streamClaudeMessage(
  params: ClaudeMessageParams,
  callbacks: ClaudeStreamCallbacks
): Promise<void> {
  const {
    apiKey,
    messages,
    systemPrompt,
    maxTokens = CLAUDE_API.MAX_TOKENS,
    temperature = CLAUDE_API.TEMPERATURE,
  } = params;

  try {
    const response = await fetch(`${CLAUDE_API.BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        stream: true,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `API error: ${response.status}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta') {
              const text = parsed.delta?.text || '';
              fullResponse += text;
              callbacks.onToken(text);
            }

            if (parsed.type === 'message_delta') {
              outputTokens = parsed.usage?.output_tokens || outputTokens;
            }

            if (parsed.type === 'message_start') {
              inputTokens = parsed.message?.usage?.input_tokens || 0;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }

    callbacks.onComplete(fullResponse, { input: inputTokens, output: outputTokens });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Sends a non-streaming message to Claude API
 */
export async function sendClaudeMessage(
  params: ClaudeMessageParams
): Promise<{ content: string; usage: { input: number; output: number } }> {
  const {
    apiKey,
    messages,
    systemPrompt,
    maxTokens = CLAUDE_API.MAX_TOKENS,
    temperature = CLAUDE_API.TEMPERATURE,
  } = params;

  const response = await fetch(`${CLAUDE_API.BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `API error: ${response.status}`
    );
  }

  const data = await response.json();

  return {
    content: data.content?.[0]?.text || '',
    usage: {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0,
    },
  };
}

/**
 * Generates a summary of the conversation for memory management
 */
export async function summarizeConversation(
  apiKey: string,
  messages: ChatMessage[]
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  const result = await sendClaudeMessage({
    apiKey,
    messages: [
      {
        role: 'user',
        content: `Please summarize the following conversation about Philippine government procurement data. Focus on:\n1. Key topics discussed\n2. Specific contracts or organizations mentioned\n3. Important insights or findings\n4. Any follow-up questions or areas of interest\n\nConversation:\n${conversationText}`,
      },
    ],
    systemPrompt: AI_SYSTEM_PROMPTS.SUMMARY_GENERATOR,
    maxTokens: 500,
    temperature: 0.3,
  });

  return result.content;
}

/**
 * Builds a data context string for the AI assistant
 */
export function buildDataContext(stats: {
  totalContracts: number;
  totalValue: number;
  topCategories: Array<{ category: string; totalValue: number; contractCount: number }>;
  topAreas: Array<{ area: string; totalValue: number; contractCount: number }>;
  dateRange: { earliest: string; latest: string };
}): string {
  const { totalContracts, totalValue, topCategories, topAreas, dateRange } = stats;

  const formatValue = (v: number) => {
    if (v >= 1_000_000_000) return `₱${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
    return `₱${v.toLocaleString()}`;
  };

  return `Dataset Overview:
- Total Contracts: ${totalContracts.toLocaleString()}
- Total Value: ${formatValue(totalValue)}
- Date Range: ${dateRange.earliest} to ${dateRange.latest}

Top Categories by Value:
${topCategories
  .slice(0, 5)
  .map((c, i) => `${i + 1}. ${c.category}: ${formatValue(c.totalValue)} (${c.contractCount} contracts)`)
  .join('\n')}

Top Areas by Value:
${topAreas
  .slice(0, 5)
  .map((a, i) => `${i + 1}. ${a.area}: ${formatValue(a.totalValue)} (${a.contractCount} contracts)`)
  .join('\n')}`;
}

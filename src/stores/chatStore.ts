/**
 * Chat Store - Manages conversational AI state with memory
 *
 * Memory Architecture:
 * - Maintains full conversation history for context
 * - Implements sliding window with summarization for long conversations
 * - Preserves key facts and insights across sessions
 * - Tracks token usage to stay within limits
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ConversationContext } from '@/types';
import { generateId } from '@/utils/helpers';
import { STORAGE_KEYS, UI_CONFIG, CLAUDE_API, AI_SYSTEM_PROMPTS } from '@/utils/constants';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationSummary: string | null;
  totalTokensUsed: number;
  sessionStarted: Date | null;

  // Actions
  addMessage: (role: 'user' | 'assistant', content: string, metadata?: ChatMessage['metadata']) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateSummary: (summary: string) => void;
  addTokenUsage: (tokens: number) => void;
  getConversationContext: () => ConversationContext;
  getMessagesForAPI: () => Array<{ role: 'user' | 'assistant'; content: string }>;
  shouldSummarize: () => boolean;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [
        {
          id: generateId(),
          role: 'assistant',
          content: `Magandang araw! I'm SpendWatch AI, your intelligent assistant for exploring Philippine government procurement data.

I can help you with:
- **Spending Analysis**: Understanding procurement patterns and trends
- **Contract Search**: Finding specific contracts, agencies, or suppliers
- **Data Insights**: Identifying anomalies or notable patterns
- **Regulatory Context**: Explaining procurement thresholds and processes

What would you like to explore today?`,
          timestamp: new Date(),
        },
      ],
      isLoading: false,
      error: null,
      conversationSummary: null,
      totalTokensUsed: 0,
      sessionStarted: new Date(),

      addMessage: (role, content, metadata) => {
        const newMessage: ChatMessage = {
          id: generateId(),
          role,
          content,
          timestamp: new Date(),
          metadata,
        };

        set((state) => {
          const updatedMessages = [...state.messages, newMessage];

          // Trim old messages if exceeding limit
          if (updatedMessages.length > UI_CONFIG.MAX_CHAT_HISTORY) {
            return {
              messages: updatedMessages.slice(-UI_CONFIG.MAX_CHAT_HISTORY),
            };
          }

          return { messages: updatedMessages };
        });
      },

      clearMessages: () => {
        set({
          messages: [
            {
              id: generateId(),
              role: 'assistant',
              content: `Conversation cleared. I'm ready to help you explore Philippine government procurement data again!

What would you like to know?`,
              timestamp: new Date(),
            },
          ],
          conversationSummary: null,
          totalTokensUsed: 0,
          error: null,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      updateSummary: (summary) => set({ conversationSummary: summary }),

      addTokenUsage: (tokens) =>
        set((state) => ({
          totalTokensUsed: state.totalTokensUsed + tokens,
        })),

      getConversationContext: () => {
        const state = get();
        return {
          messages: state.messages,
          summary: state.conversationSummary ?? undefined,
          lastUpdated: new Date(),
          tokenCount: state.totalTokensUsed,
        };
      },

      getMessagesForAPI: () => {
        const state = get();
        const messages = state.messages.filter(
          (m) => m.role === 'user' || m.role === 'assistant'
        );

        // If we have a summary and many messages, use summary + recent messages
        if (state.conversationSummary && messages.length > 10) {
          const recentMessages = messages.slice(-6);
          return [
            {
              role: 'user' as const,
              content: `[Previous conversation summary: ${state.conversationSummary}]`,
            },
            ...recentMessages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ];
        }

        // Otherwise, use all messages (up to a reasonable limit)
        return messages.slice(-20).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      },

      shouldSummarize: () => {
        const state = get();
        // Summarize when we have many messages and haven't summarized recently
        return (
          state.messages.length > 15 &&
          (!state.conversationSummary ||
            state.totalTokensUsed > CLAUDE_API.MAX_CONTEXT_TOKENS * 0.7)
        );
      },
    }),
    {
      name: STORAGE_KEYS.CHAT_HISTORY,
      partialize: (state) => ({
        messages: state.messages.slice(-20), // Only persist recent messages
        conversationSummary: state.conversationSummary,
        totalTokensUsed: state.totalTokensUsed,
      }),
    }
  )
);

// Helper function to build the system prompt with data context
export function buildSystemPrompt(dataContext: string): string {
  return `${AI_SYSTEM_PROMPTS.PROCUREMENT_ANALYST}

Current Data Context:
${dataContext}

Remember to be helpful, accurate, and support transparency in government procurement.`;
}

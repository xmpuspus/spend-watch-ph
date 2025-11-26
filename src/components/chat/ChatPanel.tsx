/**
 * Chat Panel Component
 *
 * Provides conversational AI interface with memory support.
 * Based on the original philgeps-explorer.jsx chat design but enhanced with:
 * - Streaming responses
 * - Conversation memory
 * - Quick action buttons
 * - Better UX animations
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Sparkles, AlertCircle, Key } from 'lucide-react';
import { useChatStore, useApiKeyStore, useDataStore, buildSystemPrompt } from '@/stores';
import { streamClaudeMessage, buildDataContext, summarizeConversation } from '@/services';
import { Button } from '../ui';

interface ChatPanelProps {
  onOpenApiKeyModal: () => void;
}

export function ChatPanel({ onOpenApiKeyModal }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [streamingContent, setStreamingContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    error,
    addMessage,
    clearMessages,
    setLoading,
    setError,
    getMessagesForAPI,
    updateSummary,
    addTokenUsage,
    shouldSummarize,
  } = useChatStore();

  const { apiKey, isValidated } = useApiKeyStore();
  const { summary, categoryStats, areaStats } = useDataStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Build data context for the AI
  const getDataContext = useCallback(() => {
    if (!summary) return 'No data loaded yet.';

    return buildDataContext({
      totalContracts: summary.totalContracts,
      totalValue: summary.totalValue,
      topCategories: categoryStats.slice(0, 5).map((c) => ({
        category: c.category,
        totalValue: c.totalValue,
        contractCount: c.contractCount,
      })),
      topAreas: areaStats.slice(0, 5).map((a) => ({
        area: a.area,
        totalValue: a.totalValue,
        contractCount: a.contractCount,
      })),
      dateRange: summary.dateRange,
    });
  }, [summary, categoryStats, areaStats]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!apiKey || !isValidated) {
      onOpenApiKeyModal();
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);
    setLoading(true);
    setError(null);
    setStreamingContent('');

    try {
      const apiMessages = getMessagesForAPI();
      apiMessages.push({ role: 'user', content: userMessage });

      const systemPrompt = buildSystemPrompt(getDataContext());

      await streamClaudeMessage(
        {
          apiKey,
          messages: apiMessages,
          systemPrompt,
          maxTokens: 1024,
        },
        {
          onToken: (token) => {
            setStreamingContent((prev) => prev + token);
          },
          onComplete: async (fullResponse, usage) => {
            setStreamingContent('');
            addMessage('assistant', fullResponse, {
              tokensUsed: usage.input + usage.output,
            });
            addTokenUsage(usage.input + usage.output);
            setLoading(false);

            // Check if we should summarize the conversation
            if (shouldSummarize() && apiKey) {
              try {
                const newSummary = await summarizeConversation(apiKey, messages);
                updateSummary(newSummary);
              } catch (e) {
                console.error('Failed to summarize conversation:', e);
              }
            }
          },
          onError: (err) => {
            setStreamingContent('');
            setError(err.message);
            setLoading(false);
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    'What are the largest contracts?',
    'Show COVID-related spending',
    'Top suppliers by value?',
    'Construction spending trends',
  ];

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 mb-1.5">
                    <Sparkles size={12} />
                    SpendWatch AI
                  </div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming response */}
        {streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 mb-1.5">
                <Sparkles size={12} className="animate-pulse" />
                SpendWatch AI
              </div>
              <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-brand-500 animate-pulse ml-0.5" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <div
                  className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
          >
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="pt-4 border-t border-gray-100 mt-4">
        {!apiKey || !isValidated ? (
          <button
            onClick={onOpenApiKeyModal}
            className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-brand-50 to-brand-100 border-2 border-dashed border-brand-300 rounded-xl text-brand-700 font-medium hover:border-brand-400 transition-colors"
          >
            <Key size={18} />
            Connect your Claude API key to chat
          </button>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about procurement data..."
                className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="px-4"
              >
                <Send size={18} />
              </Button>
            </div>

            {/* Quick Questions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => setInputValue(question)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-brand-100 border border-gray-200 hover:border-brand-300 rounded-full text-xs text-gray-600 hover:text-brand-700 transition-all"
                >
                  {question}
                </button>
              ))}
            </div>

            {/* Clear Chat */}
            {messages.length > 1 && (
              <button
                onClick={clearMessages}
                className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
                Clear conversation
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * API Key Store - Manages Claude API key storage and validation
 *
 * Security Architecture:
 * - API key is stored in localStorage (client-side only)
 * - Key is validated before being set
 * - Key is never transmitted to our servers
 * - Direct API calls are made from browser to Anthropic
 *
 * Note: For production deployments, consider using a backend proxy
 * to avoid exposing the API key in browser network requests.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/utils/constants';

interface ApiKeyState {
  apiKey: string | null;
  isValidated: boolean;
  isValidating: boolean;
  validationError: string | null;
  lastValidated: Date | null;

  // Actions
  setApiKey: (key: string) => Promise<boolean>;
  clearApiKey: () => void;
  validateApiKey: (key: string) => Promise<boolean>;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      isValidated: false,
      isValidating: false,
      validationError: null,
      lastValidated: null,

      setApiKey: async (key: string) => {
        const trimmedKey = key.trim();

        if (!trimmedKey) {
          set({ validationError: 'API key cannot be empty' });
          return false;
        }

        // Basic format validation (Claude API keys start with 'sk-ant-')
        if (!trimmedKey.startsWith('sk-ant-')) {
          set({
            validationError:
              'Invalid API key format. Claude API keys start with "sk-ant-"',
          });
          return false;
        }

        set({ isValidating: true, validationError: null });

        try {
          const isValid = await get().validateApiKey(trimmedKey);

          if (isValid) {
            set({
              apiKey: trimmedKey,
              isValidated: true,
              isValidating: false,
              validationError: null,
              lastValidated: new Date(),
            });
            return true;
          } else {
            set({
              isValidating: false,
              validationError: 'API key validation failed. Please check your key.',
            });
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred';
          set({
            isValidating: false,
            validationError: errorMessage,
          });
          return false;
        }
      },

      clearApiKey: () => {
        set({
          apiKey: null,
          isValidated: false,
          validationError: null,
          lastValidated: null,
        });
      },

      validateApiKey: async (key: string) => {
        // We'll validate by making a minimal API call
        // Using the official SDK approach would require initializing it
        // For browser validation, we'll make a simple test request
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5-20250929',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
          });

          if (response.ok) {
            return true;
          }

          const errorData = await response.json();

          if (response.status === 401) {
            throw new Error('Invalid API key. Please check and try again.');
          }

          if (response.status === 429) {
            // Rate limited but key is valid
            return true;
          }

          throw new Error(
            errorData?.error?.message || `API error: ${response.status}`
          );
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
              'Network error. Please check your internet connection.'
            );
          }
          throw error;
        }
      },
    }),
    {
      name: STORAGE_KEYS.API_KEY,
      partialize: (state) => ({
        apiKey: state.apiKey,
        isValidated: state.isValidated,
        lastValidated: state.lastValidated,
      }),
    }
  )
);

// Selector hooks for common use cases
export const useHasApiKey = () => useApiKeyStore((state) => !!state.apiKey);
export const useIsApiKeyValidated = () =>
  useApiKeyStore((state) => state.isValidated);

/**
 * API Key Modal Component
 *
 * Prompts users to enter their Claude API key before using the AI features.
 * The key is validated and stored securely in localStorage.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Eye, EyeOff, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useApiKeyStore } from '@/stores';
import { Button, Input } from './ui';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const { setApiKey, isValidating, validationError, isValidated } =
    useApiKeyStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await setApiKey(inputKey);
    if (success) {
      setInputKey('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-8 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Key size={24} />
                </div>
                <h2 className="text-xl font-bold">Connect to Claude AI</h2>
              </div>
              <p className="text-brand-100 text-sm">
                Enter your Claude API key to enable AI-powered procurement analysis.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Claude API Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="sk-ant-api..."
                      className="pr-10 font-mono text-sm"
                      disabled={isValidating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {validationError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
                  >
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span>{validationError}</span>
                  </motion.div>
                )}

                {/* Success Message */}
                {isValidated && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700"
                  >
                    <CheckCircle size={18} />
                    <span>API key validated successfully!</span>
                  </motion.div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    How to get your API key:
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>Go to the Anthropic Console</li>
                    <li>Sign in or create an account</li>
                    <li>Navigate to API Keys section</li>
                    <li>Create a new API key</li>
                  </ol>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Get API Key <ExternalLink size={14} />
                  </a>
                </div>

                {/* Security Notice */}
                <p className="text-xs text-gray-500">
                  Your API key is stored locally in your browser and never sent to our
                  servers. All AI requests are made directly to Anthropic's API.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isValidating}
                  disabled={!inputKey.trim()}
                  className="flex-1"
                >
                  {isValidating ? 'Validating...' : 'Connect'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

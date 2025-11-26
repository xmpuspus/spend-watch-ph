/**
 * Application constants for SpendWatch PH
 */

// =============================================================================
// API Configuration
// =============================================================================

export const CLAUDE_API = {
  BASE_URL: 'https://api.anthropic.com/v1',
  DEFAULT_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 1024,
  TEMPERATURE: 0.7,
  MAX_CONTEXT_TOKENS: 8000,
} as const;

export const DUCKDUCKGO_API = {
  SEARCH_URL: 'https://api.duckduckgo.com/',
  HTML_SEARCH_URL: 'https://html.duckduckgo.com/html/',
} as const;

// =============================================================================
// Data Configuration
// =============================================================================

export const DATA_CONFIG = {
  PARQUET_PATH: '/data/philgeps.parquet',
  SAMPLE_PATH: '/data/philgeps_sample.csv',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

// =============================================================================
// UI Configuration
// =============================================================================

export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  MAX_CHAT_HISTORY: 50,
  MAX_RECENT_SEARCHES: 10,
} as const;

// =============================================================================
// Philippine Regions and Provinces
// =============================================================================

export const PH_REGIONS = {
  NCR: {
    name: 'National Capital Region',
    provinces: ['Metro Manila'],
  },
  CAR: {
    name: 'Cordillera Administrative Region',
    provinces: ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  },
  REGION_I: {
    name: 'Ilocos Region',
    provinces: ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  },
  REGION_II: {
    name: 'Cagayan Valley',
    provinces: ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  },
  REGION_III: {
    name: 'Central Luzon',
    provinces: ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
  },
  REGION_IV_A: {
    name: 'CALABARZON',
    provinces: ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  },
  REGION_IV_B: {
    name: 'MIMAROPA',
    provinces: ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  },
  REGION_V: {
    name: 'Bicol Region',
    provinces: ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
  },
  REGION_VI: {
    name: 'Western Visayas',
    provinces: ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
  },
  REGION_VII: {
    name: 'Central Visayas',
    provinces: ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
  },
  REGION_VIII: {
    name: 'Eastern Visayas',
    provinces: ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
  },
  REGION_IX: {
    name: 'Zamboanga Peninsula',
    provinces: ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  },
  REGION_X: {
    name: 'Northern Mindanao',
    provinces: ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
  },
  REGION_XI: {
    name: 'Davao Region',
    provinces: ['Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
  },
  REGION_XII: {
    name: 'SOCCSKSARGEN',
    provinces: ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  },
  REGION_XIII: {
    name: 'Caraga',
    provinces: ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
  },
  BARMM: {
    name: 'Bangsamoro Autonomous Region',
    provinces: ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
  },
} as const;

// =============================================================================
// Category Colors
// =============================================================================

export const CATEGORY_COLORS: Record<string, string> = {
  Construction: '#3b82f6',
  'Medical Supplies': '#ef4444',
  'Food Stuff': '#22c55e',
  'IT Equipment': '#8b5cf6',
  'Agricultural Products': '#84cc16',
  'Hospital Equipment': '#ec4899',
  'Laboratory Supplies': '#14b8a6',
  'Hotel and Lodging': '#f97316',
  Hardware: '#6366f1',
  'Fire Fighting & Rescue': '#dc2626',
  'General Merchandise': '#64748b',
  Furniture: '#a855f7',
  'Medical Services': '#0ea5e9',
  Other: '#94a3b8',
};

// =============================================================================
// AI System Prompts
// =============================================================================

export const AI_SYSTEM_PROMPTS = {
  PROCUREMENT_ANALYST: `You are SpendWatch AI, an expert analyst for Philippine government procurement data from PhilGEPS (Philippine Government Electronic Procurement System).

Your role is to:
1. Provide clear, accurate insights about government spending patterns
2. Help users understand procurement data and identify trends
3. Answer questions about specific contracts, agencies, or suppliers
4. Support transparency and accountability in government procurement
5. Explain procurement processes and regulations when relevant

Guidelines:
- Be concise but thorough in your responses
- Use Filipino terms when appropriate (e.g., "Magandang araw")
- Always cite specific data when making claims
- If you're unsure about something, say so clearly
- Focus on facts and data-driven insights
- Support transparency and anti-corruption efforts

When analyzing data:
- Highlight significant patterns or anomalies
- Compare values to provide context (e.g., average contract sizes)
- Note any relevant regulatory thresholds
- Consider the timeline and economic context`,

  SUMMARY_GENERATOR: `Summarize the following conversation concisely, preserving key facts, questions asked, and insights provided. Focus on procurement-related topics and any specific contracts or organizations discussed.`,
} as const;

// =============================================================================
// Error Messages
// =============================================================================

export const ERROR_MESSAGES = {
  API_KEY_REQUIRED: 'Please enter your Claude API key to use the AI assistant.',
  API_KEY_INVALID: 'Invalid API key. Please check your key and try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  DATA_LOAD_ERROR: 'Failed to load procurement data. Please refresh the page.',
  SEARCH_ERROR: 'Search failed. Please try again with different terms.',
  RATE_LIMIT: 'Rate limit exceeded. Please wait a moment before trying again.',
} as const;

// =============================================================================
// Local Storage Keys
// =============================================================================

export const STORAGE_KEYS = {
  API_KEY: 'spendwatch_claude_api_key',
  CHAT_HISTORY: 'spendwatch_chat_history',
  USER_PREFERENCES: 'spendwatch_preferences',
  RECENT_SEARCHES: 'spendwatch_recent_searches',
  THEME: 'spendwatch_theme',
} as const;

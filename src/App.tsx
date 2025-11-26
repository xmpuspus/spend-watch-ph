/**
 * SpendWatch PH - Philippine Government Procurement Intelligence Platform
 *
 * Built upon the excellent foundation of philgeps-explorer.jsx
 * Enhanced with TypeScript, conversational AI memory, news search, and parquet support
 *
 * @author SpendWatch PH Contributors
 * @license MIT
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as duckdb from '@duckdb/duckdb-wasm';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  X,
  FileText,
  BarChart3,
  MapPin,
  Building2,
  Users,
  Banknote,
  Send,
  Trash2,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Newspaper,
  Loader2,
  Tag,
  Database,
  Upload,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Contract {
  id: string;
  referenceId: string;
  contractNo: string;
  title: string;
  noticeTitle: string;
  awardee: string;
  organization: string;
  area: string;
  category: string;
  amount: number;
  date: string;
  status: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}



interface DataStats {
  totalContracts: number;
  totalValue: number;
  avgValue: number;
  uniqueOrgs: number;
  uniqueAwardees: number;
  uniqueAreas: number;
  uniqueCategories: number;
  dateRange: { earliest: string; latest: string };
}

interface ConversationMemory {
  recentMessages: ChatMessage[];  // Last N messages (buffer window)
  summary: string;                // AI-generated summary of older context
  keyFacts: string[];             // Important facts extracted from conversation
  userPreferences: string[];      // User preferences learned over time
  lastSummarizedAt: number;       // Timestamp of last summary
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatCurrency = (amount: number, compact = true): string => {
  if (compact) {
    if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
  }
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ============================================================================
// Local Storage Utilities
// ============================================================================

const STORAGE_KEYS = {
  API_KEY: 'spendwatch_api_key',
  CHAT_HISTORY: 'spendwatch_chat_history',
  CONVERSATION_MEMORY: 'spendwatch_conversation_memory',
} as const;

// Memory configuration
const MEMORY_CONFIG = {
  BUFFER_WINDOW_SIZE: 8,          // Keep last 8 messages in immediate context
  SUMMARIZE_THRESHOLD: 12,        // Summarize when total messages exceed this
  MAX_STORED_MESSAGES: 50,        // Max messages to persist
  KEY_FACTS_LIMIT: 10,            // Max key facts to track
} as const;

const DEFAULT_MEMORY: ConversationMemory = {
  recentMessages: [],
  summary: '',
  keyFacts: [],
  userPreferences: [],
  lastSummarizedAt: 0,
};

const storage = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set: <T,>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to remove from localStorage:', e);
    }
  },
};

// ============================================================================
// DuckDB-WASM Service
// ============================================================================

class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

    this.db = new duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    this.conn = await this.db.connect();
    this.initialized = true;
  }

  async loadParquetFromFile(file: File): Promise<number> {
    if (!this.db || !this.conn) await this.initialize();

    await this.db!.registerFileHandle('data.parquet', file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    await this.conn!.query(`
      CREATE OR REPLACE TABLE contracts AS
      SELECT * FROM read_parquet('data.parquet')
    `);

    const countResult = await this.conn!.query('SELECT COUNT(*) as cnt FROM contracts');
    const count = countResult.toArray()[0]?.cnt;
    return typeof count === 'bigint' ? Number(count) : (count ?? 0);
  }

  async loadParquetFromUrl(url: string): Promise<number> {
    if (!this.db || !this.conn) await this.initialize();

    // Fetch the file and register it
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    return this.loadParquetFromBuffer(uint8Array);
  }

  async loadParquetFromBuffer(buffer: Uint8Array): Promise<number> {
    if (!this.db || !this.conn) await this.initialize();

    await this.db!.registerFileBuffer('data.parquet', buffer);

    try {
      await this.conn!.query(`
        CREATE OR REPLACE TABLE contracts AS
        SELECT * FROM read_parquet('data.parquet')
      `);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.toLowerCase().includes('snappy')) {
        throw new Error(
          'This parquet file uses Snappy compression, which is not supported in browsers. ' +
          'Please re-export your file with no compression: df.to_parquet("file.parquet", compression=None)'
        );
      }
      if (errorMsg.toLowerCase().includes('gzip')) {
        throw new Error(
          'This parquet file uses GZIP compression, which is not supported by DuckDB-WASM. ' +
          'Please re-export your file with no compression: df.to_parquet("file.parquet", compression=None)'
        );
      }
      throw error;
    }

    const countResult = await this.conn!.query('SELECT COUNT(*) as cnt FROM contracts');
    const count = countResult.toArray()[0]?.cnt;
    return typeof count === 'bigint' ? Number(count) : (count ?? 0);
  }

  async getStats(): Promise<DataStats> {
    if (!this.conn) throw new Error('Not connected');

    const result = await this.conn.query(`
      SELECT
        COUNT(*) as total_contracts,
        COALESCE(SUM(contract_amount), 0) as total_value,
        COALESCE(AVG(contract_amount), 0) as avg_value,
        COUNT(DISTINCT organization_name) as unique_orgs,
        COUNT(DISTINCT awardee_name) as unique_awardees,
        COUNT(DISTINCT area_of_delivery) as unique_areas,
        COUNT(DISTINCT business_category) as unique_categories,
        CAST(MIN(award_date) AS VARCHAR) as earliest_date,
        CAST(MAX(award_date) AS VARCHAR) as latest_date
      FROM contracts
      WHERE contract_amount IS NOT NULL
    `);

    const row = result.toArray()[0];

    // Parse dates properly - handle various formats
    const parseDate = (val: unknown): string => {
      if (!val) return '';
      const str = String(val);
      // If it's already a date string like "2020-01-15", return as is
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str;
      // If it's a timestamp number, convert it
      const num = Number(str);
      if (!isNaN(num) && num > 0) {
        const date = new Date(num);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
      return str;
    };

    return {
      totalContracts: Number(row.total_contracts),
      totalValue: Number(row.total_value),
      avgValue: Number(row.avg_value),
      uniqueOrgs: Number(row.unique_orgs),
      uniqueAwardees: Number(row.unique_awardees),
      uniqueAreas: Number(row.unique_areas),
      uniqueCategories: Number(row.unique_categories),
      dateRange: {
        earliest: parseDate(row.earliest_date),
        latest: parseDate(row.latest_date),
      },
    };
  }

  async getAreaBreakdown(): Promise<Array<{ area: string; count: number; amount: number }>> {
    if (!this.conn) throw new Error('Not connected');

    const result = await this.conn.query(`
      SELECT
        COALESCE(area_of_delivery, 'Unknown') as area,
        COUNT(*) as count,
        COALESCE(SUM(contract_amount), 0) as amount
      FROM contracts
      WHERE area_of_delivery IS NOT NULL AND area_of_delivery != ''
      GROUP BY area_of_delivery
      ORDER BY amount DESC
      LIMIT 50
    `);

    return result.toArray().map((row) => ({
      area: String(row.area),
      count: Number(row.count),
      amount: Number(row.amount),
    }));
  }

  async getCategoryBreakdown(): Promise<Array<{ category: string; count: number; amount: number }>> {
    if (!this.conn) throw new Error('Not connected');

    const result = await this.conn.query(`
      SELECT
        COALESCE(business_category, 'Unknown') as category,
        COUNT(*) as count,
        COALESCE(SUM(contract_amount), 0) as amount
      FROM contracts
      WHERE business_category IS NOT NULL AND business_category != ''
      GROUP BY business_category
      ORDER BY amount DESC
      LIMIT 20
    `);

    return result.toArray().map((row) => ({
      category: String(row.category),
      count: Number(row.count),
      amount: Number(row.amount),
    }));
  }

  async searchContracts(options: {
    query?: string;
    area?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<Contract[]> {
    if (!this.conn) throw new Error('Not connected');

    const { query, area, category, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];

    if (query) {
      const escaped = query.replace(/'/g, "''").toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(award_title, '')) LIKE '%${escaped}%' OR
        LOWER(COALESCE(awardee_name, '')) LIKE '%${escaped}%' OR
        LOWER(COALESCE(organization_name, '')) LIKE '%${escaped}%' OR
        LOWER(COALESCE(notice_title, '')) LIKE '%${escaped}%'
      )`);
    }

    if (area) {
      conditions.push(`area_of_delivery = '${area.replace(/'/g, "''")}'`);
    }

    if (category) {
      conditions.push(`business_category = '${category.replace(/'/g, "''")}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.conn.query(`
      SELECT
        COALESCE(CAST(id AS VARCHAR), CAST(ROW_NUMBER() OVER () AS VARCHAR)) as id,
        COALESCE(reference_id, '') as reference_id,
        COALESCE(contract_no, '') as contract_no,
        COALESCE(award_title, '') as award_title,
        COALESCE(notice_title, '') as notice_title,
        COALESCE(awardee_name, '') as awardee_name,
        COALESCE(organization_name, '') as organization_name,
        COALESCE(area_of_delivery, '') as area_of_delivery,
        COALESCE(business_category, '') as business_category,
        COALESCE(contract_amount, 0) as contract_amount,
        COALESCE(CAST(award_date AS VARCHAR), '') as award_date,
        COALESCE(award_status, 'active') as award_status
      FROM contracts
      ${whereClause}
      ORDER BY contract_amount DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return result.toArray().map((row) => ({
      id: String(row.id),
      referenceId: String(row.reference_id),
      contractNo: String(row.contract_no),
      title: String(row.award_title),
      noticeTitle: String(row.notice_title),
      awardee: String(row.awardee_name),
      organization: String(row.organization_name),
      area: String(row.area_of_delivery),
      category: String(row.business_category),
      amount: Number(row.contract_amount),
      date: String(row.award_date),
      status: String(row.award_status),
    }));
  }

  async getContractCount(options: { query?: string; area?: string; category?: string }): Promise<number> {
    if (!this.conn) throw new Error('Not connected');

    const { query, area, category } = options;
    const conditions: string[] = [];

    if (query) {
      const escaped = query.replace(/'/g, "''").toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(award_title, '')) LIKE '%${escaped}%' OR
        LOWER(COALESCE(awardee_name, '')) LIKE '%${escaped}%' OR
        LOWER(COALESCE(organization_name, '')) LIKE '%${escaped}%'
      )`);
    }

    if (area) {
      conditions.push(`area_of_delivery = '${area.replace(/'/g, "''")}'`);
    }

    if (category) {
      conditions.push(`business_category = '${category.replace(/'/g, "''")}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.conn.query(`SELECT COUNT(*) as cnt FROM contracts ${whereClause}`);
    const count = result.toArray()[0]?.cnt;
    return typeof count === 'bigint' ? Number(count) : (count ?? 0);
  }

  isReady(): boolean {
    return this.initialized && this.conn !== null;
  }
}

const duckDBService = new DuckDBService();

// ============================================================================
// Main Application Component
// ============================================================================

export default function App() {
  // Data State
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [areaBreakdown, setAreaBreakdown] = useState<Array<{ area: string; count: number; amount: number }>>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Array<{ category: string; count: number; amount: number }>>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState('');

  // UI State
  const [activeTab, setActiveTab] = useState<'insights' | 'contracts'>('insights');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showChatModal, setShowChatModal] = useState(false);
  const PAGE_SIZE = 50;

  // API Key State
  const [apiKey, setApiKey] = useState<string>(() => storage.get(STORAGE_KEYS.API_KEY, ''));
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Chat State with Memory
  const [conversationMemory, setConversationMemory] = useState<ConversationMemory>(() => {
    const saved = storage.get<ConversationMemory>(STORAGE_KEYS.CONVERSATION_MEMORY, DEFAULT_MEMORY);
    if (saved.recentMessages.length === 0) {
      return {
        ...DEFAULT_MEMORY,
        recentMessages: [{
          id: generateId(),
          role: 'assistant',
          content: `Magandang araw! I'm SpendWatch AI, your intelligent guide to Philippine government procurement data.

I can help you explore:
- **Spending patterns** across provinces and categories
- **Contract details** and supplier information
- **Trends and anomalies** in procurement data
- **Comparative analysis** between agencies

Ask me anything about government spending!`,
          timestamp: new Date(),
        }],
      };
    }
    return {
      ...saved,
      recentMessages: saved.recentMessages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    };
  });
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Derived: All chat messages for display
  const chatMessages = conversationMemory.recentMessages;

  // News Search State
  const [showNewsPanel, setShowNewsPanel] = useState(false);
  const [newsQuery, setNewsQuery] = useState('');

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Load parquet data - auto-loads demo file by default
  const loadData = useCallback(async (file?: File) => {
    if (isDataLoading) return;

    // Reset state to show loading UI
    setDataLoaded(false);
    setIsDataLoading(true);
    setDataError(null);
    setLoadingProgress(file ? `Preparing to load ${file.name}...` : 'Initializing data engine...');

    // Clear existing data while loading
    setContracts([]);
    setStats(null);
    setAreaBreakdown([]);
    setCategoryBreakdown([]);

    try {
      await duckDBService.initialize();

      let rowCount: number;

      if (file) {
        // Load from uploaded file
        setLoadingProgress(`Loading ${file.name}...`);
        const buffer = await file.arrayBuffer();
        rowCount = await duckDBService.loadParquetFromBuffer(new Uint8Array(buffer));
      } else {
        // Load demo data from public folder
        setLoadingProgress('Loading demo dataset (5,000 contracts)...');
        rowCount = await duckDBService.loadParquetFromUrl('/data/philgeps_demo.parquet');
      }

      setLoadingProgress(`Processing ${rowCount.toLocaleString()} contracts...`);

      // Load all the data in parallel
      const [statsData, areas, categories, initialContracts, count] = await Promise.all([
        duckDBService.getStats(),
        duckDBService.getAreaBreakdown(),
        duckDBService.getCategoryBreakdown(),
        duckDBService.searchContracts({ limit: PAGE_SIZE }),
        duckDBService.getContractCount({}),
      ]);

      setStats(statsData);
      setAreaBreakdown(areas);
      setCategoryBreakdown(categories);
      setContracts(initialContracts);
      setTotalFilteredCount(count);
      setDataLoaded(true);
      setLoadingProgress('');
    } catch (error) {
      console.error('Failed to load data:', error);
      setDataError(error instanceof Error ? error.message : 'Failed to load data.');
      setLoadingProgress('');
    } finally {
      setIsDataLoading(false);
    }
  }, [isDataLoading]);

  // File upload handler with validation
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.parquet', '.csv'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validTypes.includes(extension)) {
      setDataError('Invalid file type. Please upload a .parquet or .csv file.');
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setDataError('File too large. Maximum size is 500MB.');
      return;
    }

    // For CSV, we need to convert - but for now only support parquet
    if (extension === '.csv') {
      setDataError('CSV upload coming soon. Please use .parquet format for now.');
      return;
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Clear any previous errors before loading
    setDataError(null);

    // Load the file
    await loadData(file);
  }, [loadData]);

  // Auto-load data on mount
  useEffect(() => {
    if (!hasInitialized.current && !dataLoaded && !isDataLoading) {
      hasInitialized.current = true;
      loadData();
    }
  }, [loadData, dataLoaded, isDataLoading]);

  // Search and filter contracts
  const searchContractsHandler = useCallback(async () => {
    if (!duckDBService.isReady()) return;

    try {
      const [results, count] = await Promise.all([
        duckDBService.searchContracts({
          query: searchQuery || undefined,
          area: selectedProvince || undefined,
          limit: PAGE_SIZE,
          offset: currentPage * PAGE_SIZE,
        }),
        duckDBService.getContractCount({
          query: searchQuery || undefined,
          area: selectedProvince || undefined,
        }),
      ]);

      setContracts(results);
      setTotalFilteredCount(count);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [searchQuery, selectedProvince, currentPage]);

  // Effect: Search when filters change
  useEffect(() => {
    if (dataLoaded) {
      setCurrentPage(0);
      searchContractsHandler();
    }
  }, [searchQuery, selectedProvince, dataLoaded]);

  // Effect: Load more when page changes
  useEffect(() => {
    if (dataLoaded && currentPage > 0) {
      searchContractsHandler();
    }
  }, [currentPage, dataLoaded]);

  // Computed values for provinces
  const maxAmount = useMemo(() => {
    return Math.max(...areaBreakdown.map(a => a.amount), 1);
  }, [areaBreakdown]);

  const topCategories = useMemo(() => {
    return categoryBreakdown.slice(0, 5).map(c => [c.category, c.amount] as [string, number]);
  }, [categoryBreakdown]);

  // Persist conversation memory
  useEffect(() => {
    storage.set(STORAGE_KEYS.CONVERSATION_MEMORY, conversationMemory);
  }, [conversationMemory]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  // API Key Validation
  const validateApiKey = async (key: string): Promise<boolean> => {
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

      return response.ok || response.status === 429;
    } catch {
      return false;
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    if (!apiKeyInput.startsWith('sk-ant-')) {
      setKeyError('Invalid API key format. Keys start with "sk-ant-"');
      return;
    }

    setIsValidatingKey(true);
    setKeyError(null);

    const isValid = await validateApiKey(apiKeyInput);

    if (isValid) {
      setApiKey(apiKeyInput);
      storage.set(STORAGE_KEYS.API_KEY, apiKeyInput);
      setShowApiKeyModal(false);
      setApiKeyInput('');
    } else {
      setKeyError('Invalid API key. Please check and try again.');
    }

    setIsValidatingKey(false);
  };

  const handleClearApiKey = () => {
    setApiKey('');
    storage.remove(STORAGE_KEYS.API_KEY);
  };

  // Build context for AI with memory
  const buildDataContext = useCallback((): string => {
    if (!stats) return 'No data loaded yet. The PhilGEPS parquet file is being loaded.';

    let context = `=== PHILIPPINE GOVERNMENT PROCUREMENT DATA (PhilGEPS) ===

DATA SUMMARY:
- Total Contracts: ${stats.totalContracts.toLocaleString()}
- Total Value: ${formatCurrency(stats.totalValue)}
- Average Contract: ${formatCurrency(stats.avgValue)}
- Unique Agencies: ${stats.uniqueOrgs.toLocaleString()}
- Unique Suppliers: ${stats.uniqueAwardees.toLocaleString()}
- Date Range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}

TOP CATEGORIES BY VALUE:
${topCategories.map(([c, v]) => `• ${c}: ${formatCurrency(v)}`).join('\n')}

TOP PROVINCES BY VALUE:
${areaBreakdown.slice(0, 10).map(a => `• ${a.area}: ${formatCurrency(a.amount)} (${a.count.toLocaleString()} contracts)`).join('\n')}`;

    // Add memory context if available
    if (conversationMemory.summary) {
      context += `\n\n=== CONVERSATION HISTORY SUMMARY ===\n${conversationMemory.summary}`;
    }

    if (conversationMemory.keyFacts.length > 0) {
      context += `\n\n=== KEY FACTS FROM THIS CONVERSATION ===\n${conversationMemory.keyFacts.map(f => `• ${f}`).join('\n')}`;
    }

    if (conversationMemory.userPreferences.length > 0) {
      context += `\n\n=== USER PREFERENCES ===\n${conversationMemory.userPreferences.map(p => `• ${p}`).join('\n')}`;
    }

    return context;
  }, [stats, topCategories, areaBreakdown, conversationMemory]);

  // Generate conversation summary using AI
  const generateConversationSummary = useCallback(async (messages: ChatMessage[]): Promise<string> => {
    if (!apiKey || messages.length < 4) return '';

    try {
      const messagesToSummarize = messages.slice(0, -MEMORY_CONFIG.BUFFER_WINDOW_SIZE);
      if (messagesToSummarize.length < 2) return conversationMemory.summary;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Summarize this conversation about Philippine government procurement in 2-3 sentences. Focus on: topics discussed, any specific provinces/agencies/suppliers mentioned, and key insights shared.

Conversation:
${messagesToSummarize.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Summary:`,
          }],
        }),
      });

      if (!response.ok) return conversationMemory.summary;

      const data = await response.json();
      return data.content?.[0]?.text || conversationMemory.summary;
    } catch {
      return conversationMemory.summary;
    }
  }, [apiKey, conversationMemory.summary]);

  // Chat Handler with Streaming and Memory Management
  const handleChat = async () => {
    if (!chatInput.trim() || isLoading) return;

    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    // Add user message to memory
    const updatedMessages = [...conversationMemory.recentMessages, userMessage];
    setConversationMemory(prev => ({
      ...prev,
      recentMessages: updatedMessages,
    }));

    setChatInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Build message history for API (buffer window)
      const historyMessages = updatedMessages.slice(-MEMORY_CONFIG.BUFFER_WINDOW_SIZE).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1500,
          stream: true,
          system: `You are SpendWatch AI, an expert analyst for Philippine government procurement data from PhilGEPS.

PERSONALITY & STYLE:
- Be warm, helpful, and professional
- Use Filipino expressions naturally (e.g., "Magandang araw", "naman", "po")
- Provide actionable insights, not just data
- When appropriate, highlight potential red flags or notable patterns
- Format responses with markdown for clarity (headers, bullet points, bold for emphasis)

CAPABILITIES:
- Analyze spending patterns by province, agency, supplier, or category
- Identify largest contracts and top suppliers
- Compare procurement trends across regions
- Highlight anomalies or unusual patterns
- Provide context about Philippine government procurement

${buildDataContext()}

Remember: Be prescriptive and insightful. Don't just report numbers—explain what they mean and what actions the user might take.`,
          messages: historyMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';

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
                fullContent += text;
                setStreamingContent(fullContent);
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      };

      // Update memory with new message
      const allMessages = [...updatedMessages, assistantMessage];

      // Check if we need to summarize older messages
      let newSummary = conversationMemory.summary;
      if (allMessages.length > MEMORY_CONFIG.SUMMARIZE_THRESHOLD) {
        newSummary = await generateConversationSummary(allMessages);
      }

      // Trim messages if exceeding max stored
      const trimmedMessages = allMessages.slice(-MEMORY_CONFIG.MAX_STORED_MESSAGES);

      setConversationMemory(prev => ({
        ...prev,
        recentMessages: trimmedMessages,
        summary: newSummary,
        lastSummarizedAt: allMessages.length > MEMORY_CONFIG.SUMMARIZE_THRESHOLD ? Date.now() : prev.lastSummarizedAt,
      }));

      setStreamingContent('');
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setConversationMemory(prev => ({
        ...prev,
        recentMessages: [...prev.recentMessages, errorMessage],
      }));
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  const clearChat = () => {
    setConversationMemory({
      ...DEFAULT_MEMORY,
      recentMessages: [{
        id: generateId(),
        role: 'assistant',
        content: 'Conversation cleared. I\'m ready to help you explore Philippine government procurement data again! Ask me anything.',
        timestamp: new Date(),
      }],
    });
  };

  // News Search Handler
  const openNewsSearch = (contract: Contract) => {
    const query = `${contract.awardee} Philippines government procurement`;
    setNewsQuery(query);
    setSelectedContract(contract);
    setShowNewsPanel(true);
  };

  const searchDuckDuckGo = () => {
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(newsQuery)}&ia=news`, '_blank');
  };

  const searchGoogleNews = () => {
    window.open(`https://news.google.com/search?q=${encodeURIComponent(newsQuery)}`, '_blank');
  };

  // Quick Questions
  const quickQuestions = [
    'What are the largest contracts?',
    'Show COVID-related spending',
    'Who are the top suppliers?',
    'Analyze construction trends',
    'Any suspicious patterns?',
    'Compare spending by region',
  ];

  // Open chat modal handler
  const openChatModal = () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
    } else {
      setShowChatModal(true);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 font-sans text-slate-800">
      {/* Inline Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ================================================================== */}
        {/* Hero Section */}
        {/* ================================================================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-blue-900 via-blue-700 to-blue-800 rounded-3xl p-8 lg:p-10 mb-8 overflow-hidden shadow-2xl shadow-blue-900/30"
        >
          {/* Background Decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/2 -right-1/4 w-3/4 h-full bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-2xl" />
          </div>

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold text-white/90 mb-6">
              <span className="text-base">🇵🇭</span>
              Open Government Data Initiative
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-2 tracking-tight">
              SpendWatch PH
            </h1>
            <p className="text-blue-100/80 text-lg mb-8 max-w-xl">
              Explore Philippine government procurement data with transparency and AI-powered insights
            </p>

            {/* Stats Grid */}
            {stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Banknote, value: formatCurrency(stats.totalValue), label: 'Total Contract Value' },
                  { icon: FileText, value: stats.totalContracts.toLocaleString(), label: 'Awarded Contracts' },
                  { icon: Building2, value: stats.uniqueOrgs.toLocaleString(), label: 'Procuring Entities' },
                  { icon: Users, value: stats.uniqueAwardees.toLocaleString(), label: 'Registered Suppliers' },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 hover:bg-white/15 transition-all duration-300 group"
                  >
                    <stat.icon className="w-5 h-5 text-blue-200 mb-3 group-hover:scale-110 transition-transform" />
                    <div className="text-2xl lg:text-3xl font-bold text-white mb-1">{stat.value}</div>
                    <div className="text-sm text-blue-200/80">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
                    <div className="w-5 h-5 bg-white/20 rounded mb-3 animate-pulse" />
                    <div className="h-8 bg-white/20 rounded mb-2 animate-pulse" />
                    <div className="h-4 w-24 bg-white/20 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {/* API Key & Data Status */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {dataLoaded ? (
                <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 rounded-full">
                  <Database size={14} className="text-emerald-300" />
                  <span className="text-sm text-emerald-200">
                    {stats?.totalContracts.toLocaleString()} contracts loaded
                  </span>
                </div>
              ) : isDataLoading ? (
                <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 px-3 py-1.5 rounded-full">
                  <Loader2 size={14} className="text-blue-300 animate-spin" />
                  <span className="text-sm text-blue-200">Loading data...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 px-3 py-1.5 rounded-full">
                  <AlertCircle size={14} className="text-amber-300" />
                  <span className="text-sm text-amber-200">Preparing data</span>
                </div>
              )}

              {apiKey ? (
                <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 rounded-full">
                  <CheckCircle size={14} className="text-emerald-300" />
                  <span className="text-sm text-emerald-200">AI Connected</span>
                  <button
                    onClick={handleClearApiKey}
                    className="ml-2 text-emerald-300 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-full text-sm text-white font-medium transition-all"
                >
                  <Key size={14} />
                  Connect Claude AI
                </button>
              )}

              {/* Upload Custom Data Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".parquet"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isDataLoading}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-full text-sm text-white/80 hover:text-white transition-all disabled:opacity-50"
                title="Upload your own PhilGEPS parquet file"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">Load Data</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ================================================================== */}
        {/* Data Loading Indicator */}
        {/* ================================================================== */}
        {!dataLoaded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 mb-8"
          >
            <div className="text-center max-w-xl mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
                <Database className="w-8 h-8 text-white" />
              </div>

              {isDataLoading ? (
                <>
                  <h2 className="text-2xl font-bold text-slate-800 mb-3">Loading PhilGEPS Data</h2>
                  <p className="text-slate-600 mb-6">
                    Processing procurement data securely in your browser.
                    This may take a moment for large datasets.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 text-blue-600">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="font-medium">{loadingProgress || 'Initializing...'}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-shimmer" style={{ width: '70%' }} />
                    </div>
                  </div>
                </>
              ) : dataError ? (
                <>
                  <h2 className="text-2xl font-bold text-slate-800 mb-3">Unable to Load Data</h2>
                  <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span>{dataError}</span>
                  </div>
                  <div className="text-slate-500 text-sm mb-4 space-y-2">
                    <p className="font-medium text-slate-600">Troubleshooting tips:</p>
                    <ul className="list-disc list-inside space-y-1 text-left">
                      <li>Use the <strong>"Load Data"</strong> button in the header to upload your parquet file</li>
                      <li>Parquet files must use <strong>no compression</strong> (Snappy and GZIP are not supported in browsers)</li>
                      <li>Re-export with: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">df.to_parquet("file.parquet", compression=None)</code></li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      hasInitialized.current = false;
                      setDataError(null);
                      loadData();
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    Retry Loading
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-800 mb-3">Preparing Data</h2>
                  <p className="text-slate-600">Getting ready to load procurement data...</p>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ================================================================== */}
        {/* Main Content Grid (shown when data is loaded) */}
        {/* ================================================================== */}
        {dataLoaded && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Search & Province Grid */}
            <div className="lg:col-span-2 space-y-6">
              {/* Search Bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-3"
              >
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search contracts, agencies, or suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  />
                </div>
                {selectedProvince && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSelectedProvince(null)}
                    className="flex items-center gap-2 px-5 py-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-600 font-semibold hover:bg-red-100 transition-all"
                  >
                    <X size={18} />
                    {selectedProvince}
                  </motion.button>
                )}
              </motion.div>

              {/* Province Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Procurement by Area</h2>
                  </div>
                  <span className="text-sm text-slate-500">{areaBreakdown.length} areas</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                  {areaBreakdown.slice(0, 30).map(({ area, count, amount }, index) => (
                    <motion.button
                      key={area}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => setSelectedProvince(selectedProvince === area ? null : area)}
                      className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ${
                        selectedProvince === area
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/30'
                          : 'bg-slate-50 hover:bg-slate-100 hover:shadow-md'
                      }`}
                    >
                      {/* Background Bar */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${
                          selectedProvince === area ? 'bg-white/10' : 'bg-blue-500/10'
                        }`}
                        style={{ height: `${(amount / maxAmount) * 100}%` }}
                      />

                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-semibold truncate ${
                            selectedProvince === area ? 'text-white' : 'text-slate-700'
                          }`}>
                            {area}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            selectedProvince === area
                              ? 'bg-amber-400 text-slate-900'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {count.toLocaleString()}
                          </span>
                        </div>
                        <div className={`text-xl font-bold ${
                          selectedProvince === area ? 'text-white' : 'text-blue-600'
                        }`}>
                          {formatCurrency(amount)}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              </div>

            {/* Right Column - Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col"
              style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '600px' }}
            >
              {/* Tab Navigation */}
              <div className="flex p-2 gap-1 border-b border-slate-100">
                {[
                  { id: 'insights', icon: BarChart3, label: 'Insights' },
                  { id: 'contracts', icon: FileText, label: 'Contracts' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
                {/* Ask AI Button */}
                <button
                  onClick={openChatModal}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Sparkles size={16} />
                  Ask AI
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <AnimatePresence mode="wait">
                  {/* Insights Tab */}
                  {activeTab === 'insights' && stats && (
                    <motion.div
                      key="insights"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Average Contract Card */}
                      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
                        <div className="text-sm text-blue-200 mb-1">Average Contract Value</div>
                        <div className="text-3xl font-bold">{formatCurrency(stats.avgValue)}</div>
                      </div>

                      {/* Top Categories */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-600 mb-4">Top Categories by Value</h3>
                        <div className="space-y-4">
                          {topCategories.map(([category, value], index) => (
                            <div key={category} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 truncate pr-2">{category}</span>
                                <span className="text-sm font-bold text-blue-600">{formatCurrency(value)}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(value / topCategories[0][1]) * 100}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.1 }}
                                  className={`h-full rounded-full ${
                                    index === 0
                                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                  }`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 size={14} className="text-emerald-600" />
                            <span className="text-xs font-medium text-emerald-700">Agencies</span>
                          </div>
                          <div className="text-xl font-bold text-emerald-800">{stats.uniqueOrgs.toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Users size={14} className="text-violet-600" />
                            <span className="text-xs font-medium text-violet-700">Suppliers</span>
                          </div>
                          <div className="text-xl font-bold text-violet-800">{stats.uniqueAwardees.toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin size={14} className="text-amber-600" />
                            <span className="text-xs font-medium text-amber-700">Delivery Areas</span>
                          </div>
                          <div className="text-xl font-bold text-amber-800">{stats.uniqueAreas.toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Tag size={14} className="text-sky-600" />
                            <span className="text-xs font-medium text-sky-700">Categories</span>
                          </div>
                          <div className="text-xl font-bold text-sky-800">{stats.uniqueCategories.toLocaleString()}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Contracts Tab */}
                  {activeTab === 'contracts' && (
                    <motion.div
                      key="contracts"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="text-sm text-slate-500 mb-4">
                        Showing <strong className="text-blue-600">{contracts.length}</strong> of{' '}
                        <strong className="text-blue-600">{totalFilteredCount.toLocaleString()}</strong> contracts
                        {selectedProvince && <> in <strong className="text-blue-600">{selectedProvince}</strong></>}
                      </div>

                      {contracts.map((contract) => (
                        <motion.div
                          key={contract.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer group"
                          onClick={() => openNewsSearch(contract)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-800 leading-tight pr-4 line-clamp-2">
                              {contract.title || contract.noticeTitle || 'Untitled Contract'}
                            </h3>
                            <button
                              className="opacity-0 group-hover:opacity-100 p-1.5 bg-blue-100 rounded-lg text-blue-600 hover:bg-blue-200 transition-all flex-shrink-0"
                              title="Search related news"
                            >
                              <Newspaper size={14} />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {contract.category && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                                <Tag size={10} />
                                {contract.category.length > 25 ? contract.category.slice(0, 25) + '...' : contract.category}
                              </span>
                            )}
                            {contract.area && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                                <MapPin size={10} />
                                {contract.area}
                              </span>
                            )}
                            {contract.date && (
                              <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">
                                {formatDate(contract.date)}
                              </span>
                            )}
                          </div>

                          <div className="text-xl font-bold text-emerald-600 mb-3">
                            {formatCurrency(contract.amount, false)}
                          </div>

                          <div className="text-xs text-slate-500 space-y-1">
                            <div className="truncate"><strong className="text-slate-600">Awardee:</strong> {contract.awardee || 'N/A'}</div>
                            <div className="truncate"><strong className="text-slate-600">Agency:</strong> {contract.organization || 'N/A'}</div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Pagination */}
                      {totalFilteredCount > PAGE_SIZE && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                            disabled={currentPage === 0}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-slate-500">
                            Page {currentPage + 1} of {Math.ceil(totalFilteredCount / PAGE_SIZE)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={(currentPage + 1) * PAGE_SIZE >= totalFilteredCount}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* API Key Modal */}
      {/* ================================================================== */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              onClick={() => setShowApiKeyModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <Key size={24} />
                  </div>
                  <h2 className="text-xl font-bold">Connect to Claude AI</h2>
                </div>
                <p className="text-blue-100 text-sm">
                  Enter your Claude API key to enable AI-powered procurement analysis.
                </p>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Claude API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-ant-api..."
                      className="w-full px-4 py-3 pr-10 bg-white border-2 border-slate-200 rounded-xl font-mono text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                      disabled={isValidatingKey}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {keyError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
                  >
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span>{keyError}</span>
                  </motion.div>
                )}

                {/* Info */}
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">How to get your API key:</h4>
                  <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
                    <li>Go to the Anthropic Console</li>
                    <li>Sign in or create an account</li>
                    <li>Navigate to API Keys section</li>
                    <li>Create a new API key</li>
                  </ol>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Get API Key <ExternalLink size={14} />
                  </a>
                </div>

                <p className="text-xs text-slate-500">
                  Your API key is stored locally and never sent to our servers.
                </p>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowApiKeyModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || isValidatingKey}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isValidatingKey ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* Fullscreen Chat Modal */}
      {/* ================================================================== */}
      <AnimatePresence>
        {showChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
              onClick={() => setShowChatModal(false)}
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl h-[90vh] max-h-[900px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex-shrink-0 bg-slate-900 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-slate-800 rounded-2xl flex items-center justify-center">
                      <Sparkles size={22} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">SpendWatch AI</h2>
                      <p className="text-slate-400 text-sm">
                        Procurement analysis assistant
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChatModal(false)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Close chat"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Memory Indicator */}
                {conversationMemory.summary && (
                  <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg">
                    <Database size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-400">
                      Context maintained from previous conversations
                    </span>
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin bg-slate-50">
                {chatMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] lg:max-w-[75%] rounded-2xl px-5 py-4 ${
                        message.role === 'user'
                          ? 'bg-slate-900 text-white rounded-br-sm'
                          : 'bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-200'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
                          <Sparkles size={12} />
                          SpendWatch AI
                        </div>
                      )}
                      <div className={`text-sm leading-relaxed prose prose-sm max-w-none ${
                        message.role === 'user'
                          ? 'prose-invert prose-p:text-white prose-strong:text-white prose-li:text-white'
                          : 'prose-slate prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700'
                      } prose-p:my-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-headings:my-3 prose-headings:font-semibold prose-table:my-4`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-slate-100">{children}</thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {children}
                              </td>
                            ),
                            tr: ({ children }) => (
                              <tr className="border-b border-slate-100 hover:bg-slate-50">
                                {children}
                              </tr>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Streaming Content */}
                {streamingContent && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[85%] lg:max-w-[75%] rounded-2xl rounded-bl-sm bg-white px-5 py-4 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
                        <Sparkles size={12} className="animate-pulse" />
                        SpendWatch AI
                      </div>
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-slate prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700 prose-p:my-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-headings:my-3 prose-headings:font-semibold prose-table:my-4">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-slate-100">{children}</thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {children}
                              </td>
                            ),
                            tr: ({ children }) => (
                              <tr className="border-b border-slate-100 hover:bg-slate-50">
                                {children}
                              </tr>
                            ),
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                        <span className="inline-block w-1.5 h-5 bg-slate-900 animate-pulse ml-0.5 rounded-sm" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Loading Indicator */}
                {isLoading && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-slate-500">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Sticky Input Area */}
              <div className="flex-shrink-0 border-t border-slate-200 bg-white p-5">
                {/* Quick Questions */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setChatInput(q);
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-sm text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Input Row */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                    placeholder="Ask anything about Philippine government procurement..."
                    className="flex-1 px-4 py-3.5 bg-white border border-slate-300 rounded-xl text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    onClick={handleChat}
                    disabled={!chatInput.trim() || isLoading}
                    className="px-5 py-3.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>

                {/* Footer Actions */}
                {chatMessages.length > 1 && (
                  <div className="mt-4">
                    <button
                      onClick={clearChat}
                      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                      Clear conversation
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* News Search Panel */}
      {/* ================================================================== */}
      <AnimatePresence>
        {showNewsPanel && selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              onClick={() => setShowNewsPanel(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-6 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Newspaper size={20} />
                    </div>
                    <h2 className="text-lg font-bold">Search Related News</h2>
                  </div>
                  <button
                    onClick={() => setShowNewsPanel(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-slate-300 text-sm line-clamp-2">{selectedContract.title || selectedContract.noticeTitle}</p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Search Query
                  </label>
                  <input
                    type="text"
                    value={newsQuery}
                    onChange={(e) => setNewsQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Suggested Queries */}
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Suggested searches:</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      selectedContract.awardee,
                      selectedContract.organization?.split(',')[0],
                      selectedContract.category,
                    ].filter(Boolean).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setNewsQuery(`${suggestion} Philippines procurement`)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 border border-slate-200 hover:border-blue-300 rounded-lg text-xs text-slate-600 hover:text-blue-700 transition-all truncate max-w-[200px]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={searchDuckDuckGo}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
                  >
                    <ExternalLink size={16} />
                    DuckDuckGo
                  </button>
                  <button
                    onClick={searchGoogleNews}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
                  >
                    <ExternalLink size={16} />
                    Google News
                  </button>
                </div>

                <p className="text-xs text-slate-500 text-center">
                  Search opens in a new tab. Use this to research suppliers and agencies.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

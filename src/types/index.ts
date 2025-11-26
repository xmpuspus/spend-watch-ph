/**
 * Core type definitions for SpendWatch PH
 * Philippine Government Procurement Intelligence Platform
 */

// =============================================================================
// Procurement Data Types
// =============================================================================

export interface ProcurementContract {
  id: string;
  referenceId: string;
  contractNo: string;
  awardTitle: string;
  noticeTitle: string;
  awardeeName: string;
  organizationName: string;
  areaOfDelivery: string;
  businessCategory: string;
  contractAmount: number;
  awardDate: string;
  awardStatus: 'active' | 'completed' | 'cancelled' | 'pending';
}

export interface ContractSummary {
  totalValue: number;
  totalContracts: number;
  averageValue: number;
  uniqueOrganizations: number;
  uniqueAwardees: number;
  uniqueCategories: number;
  uniqueAreas: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
}

export interface CategoryStats {
  category: string;
  totalValue: number;
  contractCount: number;
  averageValue: number;
  percentage: number;
}

export interface AreaStats {
  area: string;
  totalValue: number;
  contractCount: number;
  averageValue: number;
  percentage: number;
}

export interface OrganizationStats {
  organization: string;
  totalValue: number;
  contractCount: number;
}

export interface AwardeeStats {
  awardee: string;
  totalValue: number;
  contractCount: number;
  organizations: string[];
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  count: number;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface FilterState {
  searchQuery: string;
  selectedAreas: string[];
  selectedCategories: string[];
  selectedOrganizations: string[];
  selectedAwardees: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
}

export type SortField =
  | 'contractAmount'
  | 'awardDate'
  | 'awardTitle'
  | 'awardeeName'
  | 'organizationName'
  | 'areaOfDelivery';

// =============================================================================
// AI Chat Types
// =============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokensUsed?: number;
    processingTime?: number;
    dataContext?: string;
  };
}

export interface ConversationContext {
  messages: ChatMessage[];
  summary?: string;
  lastUpdated: Date;
  tokenCount: number;
}

export interface AIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// =============================================================================
// News Search Types
// =============================================================================

export interface NewsArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

export interface NewsSearchResult {
  query: string;
  articles: NewsArticle[];
  searchedAt: Date;
  isLoading: boolean;
  error?: string;
}

// =============================================================================
// Application State Types
// =============================================================================

export interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  dataSource: 'parquet' | 'sample';
}

export interface UIState {
  activeTab: 'insights' | 'chat' | 'contracts' | 'trends';
  sidebarExpanded: boolean;
  selectedContractId: string | null;
  showApiKeyModal: boolean;
  showNewsPanel: boolean;
  theme: 'light' | 'dark' | 'system';
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ClaudeAPIResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeAPIError {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// =============================================================================
// Utility Types
// =============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface QueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

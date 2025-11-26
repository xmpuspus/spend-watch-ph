/**
 * Service exports for SpendWatch PH
 */

export {
  streamClaudeMessage,
  sendClaudeMessage,
  summarizeConversation,
  buildDataContext,
} from './claudeService';

export {
  searchNews,
  buildNewsSearchUrl,
  buildGoogleNewsUrl,
  generateSearchQueries,
  openNewsSearch,
} from './newsService';

export {
  initializeDuckDB,
  loadParquetFile,
  queryContracts,
  getAggregatedStats,
  getCategoryBreakdown,
  getAreaBreakdown,
  getTimeSeries,
  getDistinctValues,
  closeDuckDB,
} from './duckdbService';

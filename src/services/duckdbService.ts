/**
 * DuckDB-WASM Service
 *
 * Handles loading and querying the PhilGEPS parquet file using DuckDB-WASM.
 * This enables efficient client-side processing of large datasets without
 * needing a backend server.
 *
 * Architecture:
 * - DuckDB runs entirely in the browser using WebAssembly
 * - Parquet files are loaded directly for efficient columnar processing
 * - SQL queries enable complex filtering and aggregation
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import type { ProcurementContract } from '@/types';

let db: duckdb.AsyncDuckDB | null = null;
let connection: duckdb.AsyncDuckDBConnection | null = null;

/**
 * Initializes the DuckDB-WASM instance
 */
export async function initializeDuckDB(): Promise<void> {
  if (db) return;

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  // Select the best bundle for the current browser
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript',
    })
  );

  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  URL.revokeObjectURL(worker_url);

  connection = await db.connect();
}

/**
 * Loads the PhilGEPS parquet file into DuckDB
 */
export async function loadParquetFile(
  fileOrUrl: File | string
): Promise<number> {
  if (!db || !connection) {
    await initializeDuckDB();
  }

  if (!db || !connection) {
    throw new Error('DuckDB not initialized');
  }

  try {
    if (typeof fileOrUrl === 'string') {
      // Load from URL
      await connection.query(`
        CREATE OR REPLACE TABLE contracts AS
        SELECT * FROM read_parquet('${fileOrUrl}')
      `);
    } else {
      // Load from File object
      await db.registerFileHandle(
        'philgeps.parquet',
        fileOrUrl,
        duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
        true
      );

      await connection.query(`
        CREATE OR REPLACE TABLE contracts AS
        SELECT * FROM read_parquet('philgeps.parquet')
      `);
    }

    // Get row count
    const result = await connection.query('SELECT COUNT(*) as count FROM contracts');
    const count = result.toArray()[0]?.count;

    return typeof count === 'bigint' ? Number(count) : count;
  } catch (error) {
    console.error('Failed to load parquet file:', error);
    throw error;
  }
}

/**
 * Queries contracts from the loaded data
 */
export async function queryContracts(options?: {
  limit?: number;
  offset?: number;
  searchQuery?: string;
  area?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}): Promise<ProcurementContract[]> {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }

  const {
    limit = 1000,
    offset = 0,
    searchQuery,
    area,
    category,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    orderBy = 'contract_amount',
    orderDir = 'DESC',
  } = options || {};

  const conditions: string[] = [];

  if (searchQuery) {
    const escaped = searchQuery.replace(/'/g, "''");
    conditions.push(`(
      LOWER(award_title) LIKE '%${escaped.toLowerCase()}%' OR
      LOWER(awardee_name) LIKE '%${escaped.toLowerCase()}%' OR
      LOWER(organization_name) LIKE '%${escaped.toLowerCase()}%'
    )`);
  }

  if (area) {
    conditions.push(`area_of_delivery = '${area.replace(/'/g, "''")}'`);
  }

  if (category) {
    conditions.push(`business_category = '${category.replace(/'/g, "''")}'`);
  }

  if (minAmount !== undefined) {
    conditions.push(`contract_amount >= ${minAmount}`);
  }

  if (maxAmount !== undefined) {
    conditions.push(`contract_amount <= ${maxAmount}`);
  }

  if (startDate) {
    conditions.push(`award_date >= '${startDate}'`);
  }

  if (endDate) {
    conditions.push(`award_date <= '${endDate}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      reference_id as referenceId,
      contract_no as contractNo,
      award_title as awardTitle,
      notice_title as noticeTitle,
      awardee_name as awardeeName,
      organization_name as organizationName,
      area_of_delivery as areaOfDelivery,
      business_category as businessCategory,
      contract_amount as contractAmount,
      award_date as awardDate,
      award_status as awardStatus
    FROM contracts
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const result = await connection.query(query);
  return result.toArray().map((row) => ({
    id: String(row.id || row.referenceId || Math.random()),
    referenceId: String(row.referenceId || ''),
    contractNo: String(row.contractNo || ''),
    awardTitle: String(row.awardTitle || ''),
    noticeTitle: String(row.noticeTitle || ''),
    awardeeName: String(row.awardeeName || ''),
    organizationName: String(row.organizationName || ''),
    areaOfDelivery: String(row.areaOfDelivery || ''),
    businessCategory: String(row.businessCategory || ''),
    contractAmount: Number(row.contractAmount) || 0,
    awardDate: String(row.awardDate || ''),
    awardStatus: (row.awardStatus as ProcurementContract['awardStatus']) || 'active',
  }));
}

/**
 * Gets aggregated statistics from the data
 */
export async function getAggregatedStats(): Promise<{
  totalContracts: number;
  totalValue: number;
  avgValue: number;
  uniqueOrgs: number;
  uniqueAwardees: number;
  uniqueAreas: number;
  uniqueCategories: number;
  dateRange: { earliest: string; latest: string };
}> {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }

  const result = await connection.query(`
    SELECT
      COUNT(*) as total_contracts,
      SUM(contract_amount) as total_value,
      AVG(contract_amount) as avg_value,
      COUNT(DISTINCT organization_name) as unique_orgs,
      COUNT(DISTINCT awardee_name) as unique_awardees,
      COUNT(DISTINCT area_of_delivery) as unique_areas,
      COUNT(DISTINCT business_category) as unique_categories,
      MIN(award_date) as earliest_date,
      MAX(award_date) as latest_date
    FROM contracts
  `);

  const row = result.toArray()[0];

  return {
    totalContracts: Number(row.total_contracts),
    totalValue: Number(row.total_value),
    avgValue: Number(row.avg_value),
    uniqueOrgs: Number(row.unique_orgs),
    uniqueAwardees: Number(row.unique_awardees),
    uniqueAreas: Number(row.unique_areas),
    uniqueCategories: Number(row.unique_categories),
    dateRange: {
      earliest: String(row.earliest_date),
      latest: String(row.latest_date),
    },
  };
}

/**
 * Gets category breakdown
 */
export async function getCategoryBreakdown(): Promise<
  Array<{ category: string; totalValue: number; count: number }>
> {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }

  const result = await connection.query(`
    SELECT
      business_category as category,
      SUM(contract_amount) as total_value,
      COUNT(*) as count
    FROM contracts
    WHERE business_category IS NOT NULL AND business_category != ''
    GROUP BY business_category
    ORDER BY total_value DESC
    LIMIT 20
  `);

  return result.toArray().map((row) => ({
    category: String(row.category),
    totalValue: Number(row.total_value),
    count: Number(row.count),
  }));
}

/**
 * Gets area/province breakdown
 */
export async function getAreaBreakdown(): Promise<
  Array<{ area: string; totalValue: number; count: number }>
> {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }

  const result = await connection.query(`
    SELECT
      area_of_delivery as area,
      SUM(contract_amount) as total_value,
      COUNT(*) as count
    FROM contracts
    WHERE area_of_delivery IS NOT NULL AND area_of_delivery != ''
    GROUP BY area_of_delivery
    ORDER BY total_value DESC
    LIMIT 30
  `);

  return result.toArray().map((row) => ({
    area: String(row.area),
    totalValue: Number(row.total_value),
    count: Number(row.count),
  }));
}

/**
 * Gets time series data for trends
 */
export async function getTimeSeries(
  groupBy: 'year' | 'month' = 'month'
): Promise<Array<{ period: string; totalValue: number; count: number }>> {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }

  const dateFormat = groupBy === 'year' ? '%Y' : '%Y-%m';

  const result = await connection.query(`
    SELECT
      strftime(award_date::DATE, '${dateFormat}') as period,
      SUM(contract_amount) as total_value,
      COUNT(*) as count
    FROM contracts
    WHERE award_date IS NOT NULL AND award_date != ''
    GROUP BY period
    ORDER BY period
  `);

  return result.toArray().map((row) => ({
    period: String(row.period),
    totalValue: Number(row.total_value),
    count: Number(row.count),
  }));
}

/**
 * Gets distinct values for filters
 */
export async function getDistinctValues(
  column: 'area_of_delivery' | 'business_category' | 'organization_name' | 'awardee_name'
): Promise<string[]> {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }

  const result = await connection.query(`
    SELECT DISTINCT ${column} as value
    FROM contracts
    WHERE ${column} IS NOT NULL AND ${column} != ''
    ORDER BY value
    LIMIT 500
  `);

  return result.toArray().map((row) => String(row.value));
}

/**
 * Closes the DuckDB connection
 */
export async function closeDuckDB(): Promise<void> {
  if (connection) {
    await connection.close();
    connection = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
}

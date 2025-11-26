/**
 * Data Store - Manages procurement data state and filtering
 *
 * Architecture:
 * - Uses DuckDB-WASM for efficient parquet file processing
 * - Supports filtering, sorting, and aggregation
 * - Maintains computed statistics for visualization
 */

import { create } from 'zustand';
import type {
  ProcurementContract,
  ContractSummary,
  FilterState,
  CategoryStats,
  AreaStats,
} from '@/types';
import {
  calculateCategoryStats,
  calculateAreaStats,
  searchContracts,
  sortBy,
  paginate,
} from '@/utils/helpers';

interface DataState {
  // Raw data
  contracts: ProcurementContract[];
  isLoading: boolean;
  error: string | null;
  dataSource: 'parquet' | 'sample' | null;

  // Filtered data
  filteredContracts: ProcurementContract[];

  // Statistics
  summary: ContractSummary | null;
  categoryStats: CategoryStats[];
  areaStats: AreaStats[];

  // Filters
  filters: FilterState;

  // Pagination
  currentPage: number;
  pageSize: number;

  // Selected contract for detail view
  selectedContractId: string | null;

  // Actions
  setContracts: (contracts: ProcurementContract[], source: 'parquet' | 'sample') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  selectContract: (id: string | null) => void;
  applyFilters: () => void;
}

const initialFilters: FilterState = {
  searchQuery: '',
  selectedAreas: [],
  selectedCategories: [],
  selectedOrganizations: [],
  selectedAwardees: [],
  dateRange: { start: null, end: null },
  amountRange: { min: null, max: null },
  sortBy: 'contractAmount',
  sortDirection: 'desc',
};

export const useDataStore = create<DataState>((set, get) => ({
  contracts: [],
  isLoading: false,
  error: null,
  dataSource: null,
  filteredContracts: [],
  summary: null,
  categoryStats: [],
  areaStats: [],
  filters: initialFilters,
  currentPage: 1,
  pageSize: 20,
  selectedContractId: null,

  setContracts: (contracts, source) => {
    // Calculate summary statistics
    const totalValue = contracts.reduce((sum, c) => sum + c.contractAmount, 0);
    const uniqueOrgs = new Set(contracts.map((c) => c.organizationName)).size;
    const uniqueAwardees = new Set(contracts.map((c) => c.awardeeName)).size;
    const uniqueCategories = new Set(contracts.map((c) => c.businessCategory)).size;
    const uniqueAreas = new Set(contracts.map((c) => c.areaOfDelivery)).size;

    const dates = contracts.map((c) => c.awardDate).filter(Boolean).sort();
    const dateRange = {
      earliest: dates[0] || '',
      latest: dates[dates.length - 1] || '',
    };

    const summary: ContractSummary = {
      totalValue,
      totalContracts: contracts.length,
      averageValue: totalValue / contracts.length,
      uniqueOrganizations: uniqueOrgs,
      uniqueAwardees,
      uniqueCategories,
      uniqueAreas,
      dateRange,
    };

    set({
      contracts,
      dataSource: source,
      filteredContracts: contracts,
      summary,
      categoryStats: calculateCategoryStats(contracts),
      areaStats: calculateAreaStats(contracts),
      isLoading: false,
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1, // Reset to first page on filter change
    }));
    get().applyFilters();
  },

  resetFilters: () => {
    set({ filters: initialFilters, currentPage: 1 });
    get().applyFilters();
  },

  setPage: (page) => set({ currentPage: page }),

  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  selectContract: (id) => set({ selectedContractId: id }),

  applyFilters: () => {
    const state = get();
    let filtered = [...state.contracts];

    // Search query filter
    if (state.filters.searchQuery) {
      filtered = searchContracts(filtered, state.filters.searchQuery);
    }

    // Area filter
    if (state.filters.selectedAreas.length > 0) {
      filtered = filtered.filter((c) =>
        state.filters.selectedAreas.includes(c.areaOfDelivery)
      );
    }

    // Category filter
    if (state.filters.selectedCategories.length > 0) {
      filtered = filtered.filter((c) =>
        state.filters.selectedCategories.includes(c.businessCategory)
      );
    }

    // Organization filter
    if (state.filters.selectedOrganizations.length > 0) {
      filtered = filtered.filter((c) =>
        state.filters.selectedOrganizations.includes(c.organizationName)
      );
    }

    // Awardee filter
    if (state.filters.selectedAwardees.length > 0) {
      filtered = filtered.filter((c) =>
        state.filters.selectedAwardees.includes(c.awardeeName)
      );
    }

    // Date range filter
    if (state.filters.dateRange.start) {
      filtered = filtered.filter(
        (c) => c.awardDate >= state.filters.dateRange.start!
      );
    }
    if (state.filters.dateRange.end) {
      filtered = filtered.filter(
        (c) => c.awardDate <= state.filters.dateRange.end!
      );
    }

    // Amount range filter
    if (state.filters.amountRange.min !== null) {
      filtered = filtered.filter(
        (c) => c.contractAmount >= state.filters.amountRange.min!
      );
    }
    if (state.filters.amountRange.max !== null) {
      filtered = filtered.filter(
        (c) => c.contractAmount <= state.filters.amountRange.max!
      );
    }

    // Sort
    const sortKey = state.filters.sortBy as keyof ProcurementContract;
    filtered = sortBy(filtered, [
      { key: sortKey, direction: state.filters.sortDirection },
    ]);

    set({
      filteredContracts: filtered,
      categoryStats: calculateCategoryStats(filtered),
      areaStats: calculateAreaStats(filtered),
    });
  },
}));

// Selector hooks
export const useFilteredContracts = () =>
  useDataStore((state) => state.filteredContracts);

export const usePaginatedContracts = () => {
  const filteredContracts = useDataStore((state) => state.filteredContracts);
  const currentPage = useDataStore((state) => state.currentPage);
  const pageSize = useDataStore((state) => state.pageSize);

  return paginate(filteredContracts, currentPage, pageSize);
};

export const useSelectedContract = () => {
  const selectedId = useDataStore((state) => state.selectedContractId);
  const contracts = useDataStore((state) => state.contracts);

  if (!selectedId) return null;
  return contracts.find((c) => c.id === selectedId) || null;
};

export const useDataSummary = () => useDataStore((state) => state.summary);

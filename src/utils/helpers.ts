/**
 * General helper utilities for SpendWatch PH
 */

import type { ProcurementContract, CategoryStats, AreaStats } from '@/types';

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Safely parses JSON with a fallback value
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Groups an array by a key
 */
export function groupBy<T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Sorts an array by multiple keys
 */
export function sortBy<T>(
  array: T[],
  keys: Array<{ key: keyof T; direction: 'asc' | 'desc' }>
): T[] {
  return [...array].sort((a, b) => {
    for (const { key, direction } of keys) {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

/**
 * Calculates statistics for contracts by category
 */
export function calculateCategoryStats(
  contracts: ProcurementContract[]
): CategoryStats[] {
  const totalValue = contracts.reduce((sum, c) => sum + c.contractAmount, 0);
  const grouped = groupBy(contracts, 'businessCategory');

  return Object.entries(grouped)
    .map(([category, categoryContracts]) => {
      const catTotalValue = categoryContracts.reduce(
        (sum, c) => sum + c.contractAmount,
        0
      );
      return {
        category,
        totalValue: catTotalValue,
        contractCount: categoryContracts.length,
        averageValue: catTotalValue / categoryContracts.length,
        percentage: (catTotalValue / totalValue) * 100,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Calculates statistics for contracts by area
 */
export function calculateAreaStats(
  contracts: ProcurementContract[]
): AreaStats[] {
  const totalValue = contracts.reduce((sum, c) => sum + c.contractAmount, 0);
  const grouped = groupBy(contracts, 'areaOfDelivery');

  return Object.entries(grouped)
    .map(([area, areaContracts]) => {
      const areaTotalValue = areaContracts.reduce(
        (sum, c) => sum + c.contractAmount,
        0
      );
      return {
        area,
        totalValue: areaTotalValue,
        contractCount: areaContracts.length,
        averageValue: areaTotalValue / areaContracts.length,
        percentage: (areaTotalValue / totalValue) * 100,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Filters contracts based on search query
 */
export function searchContracts(
  contracts: ProcurementContract[],
  query: string
): ProcurementContract[] {
  if (!query.trim()) return contracts;

  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return contracts.filter((contract) => {
    const searchableText = [
      contract.awardTitle,
      contract.noticeTitle,
      contract.awardeeName,
      contract.organizationName,
      contract.areaOfDelivery,
      contract.businessCategory,
    ]
      .join(' ')
      .toLowerCase();

    return searchTerms.every((term) => searchableText.includes(term));
  });
}

/**
 * Calculates percentage change between two values
 */
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a color scale based on value
 */
export function getColorIntensity(
  value: number,
  max: number,
  baseColor: string = '#2563eb'
): string {
  const intensity = clamp(value / max, 0.1, 1);
  // Convert hex to rgba with intensity
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${intensity})`;
}

/**
 * Validates an email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extracts unique values from an array of objects
 */
export function getUniqueValues<T, K extends keyof T>(
  array: T[],
  key: K
): T[K][] {
  return [...new Set(array.map((item) => item[key]))];
}

/**
 * Paginates an array
 */
export function paginate<T>(
  array: T[],
  page: number,
  pageSize: number
): { items: T[]; totalPages: number; totalItems: number } {
  const totalItems = array.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  const items = array.slice(start, start + pageSize);

  return { items, totalPages, totalItems };
}

/**
 * Creates a human-readable summary for contract amount
 */
export function getAmountCategory(amount: number): string {
  if (amount >= 100_000_000) return 'Very Large (100M+)';
  if (amount >= 50_000_000) return 'Large (50M-100M)';
  if (amount >= 10_000_000) return 'Medium-Large (10M-50M)';
  if (amount >= 1_000_000) return 'Medium (1M-10M)';
  if (amount >= 100_000) return 'Small-Medium (100K-1M)';
  return 'Small (<100K)';
}

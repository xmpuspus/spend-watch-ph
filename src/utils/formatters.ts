/**
 * Formatting utilities for SpendWatch PH
 * Provides consistent formatting across the application
 */

/**
 * Formats a number as Philippine Peso currency
 * @param amount - The amount to format
 * @param options - Formatting options
 */
export function formatCurrency(
  amount: number,
  options: {
    compact?: boolean;
    showSign?: boolean;
    decimals?: number;
  } = {}
): string {
  const { compact = false, showSign = false, decimals = 2 } = options;

  if (compact) {
    if (Math.abs(amount) >= 1_000_000_000) {
      return `${showSign && amount > 0 ? '+' : ''}₱${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(amount) >= 1_000_000) {
      return `${showSign && amount > 0 ? '+' : ''}₱${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `${showSign && amount > 0 ? '+' : ''}₱${(amount / 1_000).toFixed(0)}K`;
    }
  }

  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return showSign && amount > 0 ? `+${formatted}` : formatted;
}

/**
 * Formats a number with thousand separators
 */
export function formatNumber(
  value: number,
  options: {
    compact?: boolean;
    decimals?: number;
  } = {}
): string {
  const { compact = false, decimals = 0 } = options;

  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(0)}K`;
    }
  }

  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a date string for display
 */
export function formatDate(
  dateString: string,
  opts: {
    format?: 'short' | 'medium' | 'long' | 'relative';
  } = {}
): string {
  const { format = 'medium' } = opts;
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  if (format === 'relative') {
    return formatRelativeDate(date);
  }

  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
  };

  return new Intl.DateTimeFormat('en-PH', formatOptions[format]).format(date);
}

/**
 * Formats a date as relative time (e.g., "2 days ago")
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Formats a percentage value
 */
export function formatPercentage(
  value: number,
  options: {
    decimals?: number;
    showSign?: boolean;
  } = {}
): string {
  const { decimals = 1, showSign = false } = options;
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Truncates text to a specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Formats a contract title for display
 */
export function formatContractTitle(title: string, maxLength = 80): string {
  // Clean up common prefixes
  const cleaned = title
    .replace(/^(Procurement of|Supply and Delivery of|Purchase of)\s+/i, '')
    .trim();

  return truncateText(cleaned, maxLength);
}

/**
 * Generates a search-friendly slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Formats file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

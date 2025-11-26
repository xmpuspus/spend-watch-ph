/**
 * News Search Service
 *
 * Integrates with DuckDuckGo for searching news related to procurement items.
 * This enables users to find recent news about contractors, organizations,
 * or specific procurement projects.
 *
 * Note: DuckDuckGo's HTML search is used because the API has limitations.
 * A CORS proxy is required for browser-side requests.
 */

import type { NewsSearchResult } from '@/types';

// We'll use a simple approach: construct search URL and let user open it,
// or use a CORS-friendly proxy service

/**
 * Builds a DuckDuckGo search URL for procurement-related news
 */
export function buildNewsSearchUrl(query: string, options?: {
  region?: string;
  timeRange?: 'd' | 'w' | 'm' | 'y'; // day, week, month, year
}): string {
  const { region = 'ph-en', timeRange = 'm' } = options || {};

  const params = new URLSearchParams({
    q: `${query} Philippines procurement news`,
    kl: region,
    df: timeRange,
    ia: 'news',
  });

  return `https://duckduckgo.com/?${params.toString()}`;
}

/**
 * Builds a Google News search URL as alternative
 */
export function buildGoogleNewsUrl(query: string): string {
  const params = new URLSearchParams({
    q: `${query} Philippines government procurement`,
    tbm: 'nws',
    tbs: 'qdr:m', // past month
  });

  return `https://news.google.com/search?${params.toString()}`;
}

/**
 * Searches for news using a CORS proxy
 * Note: For production, you should use your own proxy server
 */
export async function searchNews(query: string): Promise<NewsSearchResult> {
  const result: NewsSearchResult = {
    query,
    articles: [],
    searchedAt: new Date(),
    isLoading: false,
  };

  try {
    // For now, we'll use a lite approach that works in browsers
    // In production, this should go through a backend proxy

    // Try using an API that supports CORS
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query + ' Philippines procurement news'
    )}&format=json&no_redirect=1&no_html=1`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error('Search request failed');
    }

    const data = await response.json();

    // DuckDuckGo Instant Answers API returns related topics
    if (data.RelatedTopics) {
      result.articles = data.RelatedTopics.filter(
        (topic: { Text?: string; FirstURL?: string }) =>
          topic.Text && topic.FirstURL
      )
        .slice(0, 10)
        .map((topic: { Text: string; FirstURL: string }) => ({
          title: topic.Text.split(' - ')[0] || topic.Text,
          snippet: topic.Text,
          url: topic.FirstURL,
          source: new URL(topic.FirstURL).hostname,
        }));
    }

    // Also include the abstract if available
    if (data.Abstract && data.AbstractURL) {
      result.articles.unshift({
        title: data.Heading || query,
        snippet: data.Abstract,
        url: data.AbstractURL,
        source: data.AbstractSource || 'DuckDuckGo',
      });
    }

    return result;
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : 'Search failed';
    return result;
  }
}

/**
 * Creates search queries for a procurement contract
 */
export function generateSearchQueries(contract: {
  awardTitle: string;
  awardeeName: string;
  organizationName: string;
  businessCategory: string;
}): string[] {
  const queries: string[] = [];

  // Search for the supplier/awardee
  if (contract.awardeeName) {
    queries.push(`"${contract.awardeeName}" Philippines`);
  }

  // Search for the organization
  if (contract.organizationName) {
    const orgName = contract.organizationName
      .replace(/,?\s*(CITY|MUNICIPALITY|PROVINCE|REGION)\s+OF\s+/i, ' ')
      .trim();
    queries.push(`"${orgName}" procurement`);
  }

  // Search for the project type
  const titleKeywords = contract.awardTitle
    .replace(/Procurement of|Supply and Delivery of|Purchase of/gi, '')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 3)
    .join(' ');

  if (titleKeywords) {
    queries.push(`${titleKeywords} Philippines government`);
  }

  return queries;
}

/**
 * Opens a news search in a new tab
 */
export function openNewsSearch(query: string, source: 'duckduckgo' | 'google' = 'duckduckgo'): void {
  const url = source === 'duckduckgo'
    ? buildNewsSearchUrl(query)
    : buildGoogleNewsUrl(query);

  window.open(url, '_blank', 'noopener,noreferrer');
}

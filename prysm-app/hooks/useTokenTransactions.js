/**
 * React hook to fetch and manage token transactions
 * Integrates with ICPSwap canisters to show transaction activity
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTokenActivitySummary } from '@/lib/icpswap-transactions';

// Cache for transaction data to avoid repeated API calls
const transactionCache = new Map();
// Cache TTL (Time To Live) in milliseconds - 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
const SESSION_CACHE_PREFIX = 'token_tx_v2_'; // v2 for sorted transactions

const readSessionCache = (cacheKey) => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${cacheKey}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed || !parsed.data || !parsed.timestamp) return null;
    const age = Date.now() - parsed.timestamp;
    if (age > CACHE_TTL) {
      sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const writeSessionCache = (cacheKey, data) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${SESSION_CACHE_PREFIX}${cacheKey}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage failures
  }
};

export function useTokenTransactions(tokenId, options = {}) {
  const {
    limit = 50, // Increased to show more transactions
    refreshInterval = 0, // 0 means no auto-refresh
    skip = false,
  } = options;

  const [activity, setActivity] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Check if cached data is still valid
  const isCacheValid = useCallback((cacheKey) => {
    const cached = transactionCache.get(cacheKey);
    if (!cached) return false;

    const now = Date.now();
    const age = now - cached.timestamp;
    return age < CACHE_TTL;
  }, []);

  // Get cached data
  const getCachedData = useCallback((cacheKey) => {
    const cached = transactionCache.get(cacheKey);
    if (!cached) return null;

    if (!isCacheValid(cacheKey)) {
      transactionCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }, [isCacheValid]);

  // Set cached data
  const setCachedData = useCallback((cacheKey, data) => {
    transactionCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  // Fetch transaction activity
  const fetchActivity = useCallback(async () => {
    if (!tokenId || skip) {
      return;
    }

    const cacheKey = `${tokenId}-${limit}`;
    const cachedData = getCachedData(cacheKey) || readSessionCache(cacheKey);

    if (cachedData) {
      setActivity(cachedData);
      setLastFetched(Date.now());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getTokenActivitySummary(tokenId, limit);

      setActivity(result);
      setLastFetched(Date.now());
      setCachedData(cacheKey, result);
      writeSessionCache(cacheKey, result);
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch transactions';
      setError(errorMessage);
      console.error(`[TokenTransactions] ❌ Error for ${tokenId}:`, errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tokenId, limit, skip, getCachedData, setCachedData]);

  // Refresh function
  const refresh = useCallback(() => {
    const cacheKey = `${tokenId}-${limit}`;
    // Clear cache for this token
    transactionCache.delete(cacheKey);
    // Fetch fresh data
    fetchActivity();
  }, [tokenId, limit, fetchActivity]);

  // Initial fetch
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Setup auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || skip) {
      return;
    }

    const interval = setInterval(() => {
      fetchActivity();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchActivity, skip]);

  // Format activity summary for display
  const formattedActivity = activity ? {
    ...activity,
    // Format total volume
    formattedVolume: activity.totalVolumeUSD
      ? `$${activity.totalVolumeUSD.toFixed(2)}`
      : '$0.00',
    // Get latest transaction timestamp
    latestTimestamp: activity.transactions?.length > 0
      ? activity.transactions[0].timestamp
      : null,
    // Get transaction type summary
    transactionTypes: activity.activityByType || {},
  } : null;

  return {
    activity: formattedActivity,
    isLoading,
    error,
    lastFetched,
    refresh,
    hasActivity: activity?.hasActivity || false,
    transactionCount: activity?.transactionCount || 0,
  };
}

// Hook to batch fetch transactions for multiple tokens
export function useBatchTokenTransactions(tokenIds = [], options = {}) {
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchBatch = useCallback(async () => {
    if (!tokenIds || tokenIds.length === 0) {
      return;
    }

    setIsLoading(true);

    const newResults = {};

    for (const tokenId of tokenIds) {
      try {
        const result = await getTokenActivitySummary(tokenId, options.limit || 5);
        newResults[tokenId] = result;
      } catch (err) {
        console.error(`Error fetching transactions for ${tokenId}:`, err);
        newResults[tokenId] = {
          hasActivity: false,
          error: err.message,
          transactions: [],
        };
      }
    }

    setResults(newResults);
    setIsLoading(false);
  }, [tokenIds, options.limit]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  return {
    results,
    isLoading,
    refresh: fetchBatch,
  };
}

export default useTokenTransactions;

export async function prefetchTokenTransactions(tokenId, limit = 50) {
  if (!tokenId) return;
  const cacheKey = `${tokenId}-${limit}`;
  const cachedData = transactionCache.get(cacheKey);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return;
  }

  const sessionCached = readSessionCache(cacheKey);
  if (sessionCached) {
    transactionCache.set(cacheKey, { data: sessionCached, timestamp: Date.now() });
    return;
  }

  try {
    const result = await getTokenActivitySummary(tokenId, limit);
    transactionCache.set(cacheKey, { data: result, timestamp: Date.now() });
    writeSessionCache(cacheKey, result);
  } catch {
    // Best-effort prefetch
  }
}

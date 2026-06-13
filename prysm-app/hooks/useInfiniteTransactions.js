/**
 * Infinite scroll hook for transactions
 * Loads transactions in batches as user scrolls
 * Steve Jobs UX: Seamless, elegant, performant
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTokenTransactions } from '@/lib/icpswap-transactions';

// Cache for performance
const transactionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useInfiniteTransactions(tokenId, options = {}) {
  const {
    batchSize = 50,
    maxCached = 200, // Cache up to 200 transactions
    skip = false,
  } = options;

  const [allTransactions, setAllTransactions] = useState([]);
  const [displayedTransactions, setDisplayedTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [loadedCount, setLoadedCount] = useState(0);

  const getCacheKey = useCallback((tokenId, offset, limit) => {
    return `${tokenId}-${offset}-${limit}`;
  }, []);

  const getCachedBatch = useCallback((tokenId, offset, limit) => {
    const cacheKey = getCacheKey(tokenId, offset, limit);
    const cached = transactionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    return null;
  }, [getCacheKey]);

  const cacheBatch = useCallback((tokenId, offset, limit, data) => {
    const cacheKey = getCacheKey(tokenId, offset, limit);
    transactionCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (transactionCache.size > 100) {
      const firstKey = transactionCache.keys().next().value;
      transactionCache.delete(firstKey);
    }
  }, [getCacheKey]);

  // Load a batch of transactions
  const loadBatch = useCallback(async (offset, limit) => {
    if (skip || !tokenId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = getCachedBatch(tokenId, offset, limit);
      let transactions = cached;

      if (!cached) {
        // Fetch fresh data
        transactions = await getTokenTransactions(tokenId, offset, limit);
        cacheBatch(tokenId, offset, limit, transactions);
      }

      // Update state
      setAllTransactions(prev => {
        const combined = offset === 0 ? transactions : [...prev, ...transactions];
        // Keep only the latest maxCached transactions
        return combined.slice(-maxCached);
      });

      // Update displayed transactions (show first (batchSize * currentBatch))
      const currentBatch = Math.floor(offset / limit) + 1;
      const toDisplay = Math.min(currentBatch * batchSize, maxCached);
      setDisplayedTransactions(prev => {
        if (offset === 0) return transactions;
        return [...prev, ...transactions];
      });

      setLoadedCount(prev => prev + transactions.length);

      // Check if we have more
      setHasMore(transactions.length === limit);

      return transactions;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch transactions';
      setError(errorMessage);
      console.error('Error loading transactions:', errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [tokenId, batchSize, maxCached, skip, getCachedBatch, cacheBatch]);

  // Load initial batch
  useEffect(() => {
    if (skip || !tokenId) return;

    setAllTransactions([]);
    setDisplayedTransactions([]);
    setLoadedCount(0);
    setHasMore(true);
    setError(null);

    loadBatch(0, batchSize);
  }, [tokenId, skip]);

  // Load more when requested
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    const nextOffset = loadedCount;
    await loadBatch(nextOffset, batchSize);
  }, [isLoading, hasMore, loadedCount, loadBatch]);

  // Reset when token changes
  const reset = useCallback(() => {
    setAllTransactions([]);
    setDisplayedTransactions([]);
    setLoadedCount(0);
    setHasMore(true);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    transactions: displayedTransactions,
    allTransactions,
    isLoading,
    hasMore,
    error,
    loadMore,
    reset,
    loadedCount,
    // Transaction statistics
    statistics: {
      totalVolume: allTransactions.reduce((sum, tx) => sum + (Number(tx.amountUSD) || 0), 0),
      transactionCount: allTransactions.length,
      buyCount: allTransactions.filter(tx => {
        if (tx.action !== 'Swap') return false;
        // Determine if this token is being bought (received) or sold (sent)
        // For token0 swaps: positive token0ChangeAmount = BUY, negative = SELL
        // For token1 swaps: positive token1ChangeAmount = BUY, negative = SELL
        const isToken0 = tx.token0Id === tokenId;
        const changeAmount = isToken0 ? tx.token0ChangeAmount : tx.token1ChangeAmount;
        return changeAmount > 0;
      }).length,
      sellCount: allTransactions.filter(tx => {
        if (tx.action !== 'Swap') return false;
        // Determine if this token is being sold (sent) or bought (received)
        const isToken0 = tx.token0Id === tokenId;
        const changeAmount = isToken0 ? tx.token0ChangeAmount : tx.token1ChangeAmount;
        return changeAmount < 0;
      }).length,
      liquidityCount: allTransactions.filter(tx => tx.action.includes('Liquidity')).length,
      dateRange: allTransactions.length > 0 ? {
        earliest: Math.min(...allTransactions.map(tx => Number(tx.timestamp))),
        latest: Math.max(...allTransactions.map(tx => Number(tx.timestamp))),
      } : null,
    },
  };
}

export default useInfiniteTransactions;

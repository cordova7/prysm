/**
 * Performance optimization hooks for token relationships
 * Includes prefetching, virtualization, and performance monitoring
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to prefetch relationships for tokens in viewport
 * Uses IntersectionObserver for efficient viewport detection
 * @param {Array} tokenIds - Array of token IDs to monitor
 * @param {Object} options - Configuration options
 */
export function usePrefetchRelationshipsInViewport(tokenIds, options = {}) {
  const {
    rootMargin = '200px', // Prefetch 200px before entering viewport
    batchSize = 10, // Prefetch in batches of 10
  } = options;

  const queryClient = useQueryClient();
  const observerRef = useRef(null);
  const prefetchedRef = useRef(new Set());

  const prefetchTokenRelationships = useCallback(async (tokenId) => {
    if (prefetchedRef.current.has(tokenId)) return;
    prefetchedRef.current.add(tokenId);

    await queryClient.prefetchQuery({
      queryKey: ['token-relationships', tokenId, 15],
      queryFn: async () => {
        const response = await fetch(`/api/relationships/${tokenId}?limit=15`);
        if (!response.ok) throw new Error('Prefetch failed');
        return response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [queryClient]);

  useEffect(() => {
    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const tokenId = entry.target.dataset.tokenId;
            if (tokenId && !prefetchedRef.current.has(tokenId)) {
              prefetchTokenRelationships(tokenId);
            }
          }
        });
      },
      {
        root: null,
        rootMargin,
        threshold: 0.1,
      }
    );

    // Observe all token elements
    tokenIds.forEach((tokenId) => {
      const element = document.querySelector(`[data-token-id="${tokenId}"]`);
      if (element) {
        observerRef.current.observe(element);
      }
    });

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [tokenIds, rootMargin, prefetchTokenRelationships]);

  // Cleanup prefetched set on unmount
  useEffect(() => {
    return () => {
      prefetchedRef.current.clear();
    };
  }, []);

  return {
    prefetchedCount: prefetchedRef.current.size,
    clearPrefetched: () => prefetchedRef.current.clear(),
  };
}

/**
 * Hook to batch prefetch relationships
 * Prefetches a list of tokens in batches to avoid overwhelming the server
 * @param {Array} tokenIds - Array of token IDs to prefetch
 * @param {Object} options - Configuration options
 */
export function useBatchPrefetchRelationships(tokenIds, options = {}) {
  const {
    batchSize = 20,
    delay = 100, // Delay between batches in ms
  } = options;

  const queryClient = useQueryClient();

  const batchPrefetch = useCallback(async () => {
    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (tokenId) => {
          await queryClient.prefetchQuery({
            queryKey: ['token-relationships', tokenId, 15],
            queryFn: async () => {
              const response = await fetch(`/api/relationships/${tokenId}?limit=15`);
              if (!response.ok) throw new Error('Prefetch failed');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          });
        })
      );

      // Delay between batches
      if (i + batchSize < tokenIds.length) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, [tokenIds, batchSize, delay, queryClient]);

  return { batchPrefetch };
}

/**
 * Hook to monitor relationship query performance
 * Logs timing information for relationship queries
 * @param {string} tokenId - Token ID being queried
 */
export function useRelationshipPerformanceMonitor(tokenId) {
  const startTimeRef = useRef(performance.now());

  useEffect(() => {
    startTimeRef.current = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTimeRef.current;

      // Log slow queries (> 500ms)
      if (duration > 500) {
        console.warn(
          `[Relationship Performance] Slow query for token ${tokenId}: ${duration.toFixed(2)}ms`
        );
      }
    };
  }, [tokenId]);
}

/**
 * Hook to check relationship cache status
 * Provides information about cached relationship data
 */
export function useRelationshipCacheStatus() {
  const queryClient = useQueryClient();

  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const relationshipQueries = cache.getAll().filter((query) =>
      query.queryKey[0] === 'token-relationships'
    );

    return {
      totalRelationshipQueries: relationshipQueries.length,
      cachedTokens: relationshipQueries.map((q) => q.queryKey[1]),
      staleQueries: relationshipQueries.filter((q) => q.isStale).length,
      freshQueries: relationshipQueries.filter((q) => !q.isStale).length,
    };
  }, [queryClient]);

  return { getCacheStats };
}

/**
 * Hook to clear expired relationship cache
 * Removes stale queries to free up memory
 */
export function useClearExpiredRelationshipCache() {
  const queryClient = useQueryClient();

  const clearExpired = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const relationshipQueries = cache.getAll().filter((query) =>
      query.queryKey[0] === 'token-relationships'
    );

    let clearedCount = 0;

    relationshipQueries.forEach((query) => {
      // Clear queries older than 10 minutes
      if (query.dataUpdatedAt < Date.now() - 10 * 60 * 1000) {
        cache.remove(query);
        clearedCount++;
      }
    });
    return clearedCount;
  }, [queryClient]);

  return { clearExpired };
}

/**
 * Hook to enable/disable relationship queries based on user preference
 * Allows users to disable relationship fetching for better performance
 */
export function useRelationshipPreference() {
  const [enabled, setEnabled] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('relationshipsEnabled') !== 'false';
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('relationshipsEnabled', String(enabled));
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return { enabled, toggle, setEnabled };
}

// Import React for the last hook
import React from 'react';

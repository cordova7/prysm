/**
 * Infinite scroll hook for token relationships
 * Loads relationships in batches as user scrolls
 * Steve Jobs UX: Seamless, elegant, performant
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

// Cache for performance
const relationshipCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useInfiniteTokenRelationships(tokenId, options = {}) {
  const {
    batchSize = 50,
    maxCached = 200, // Cache up to 200 relationships
    skip = false,
  } = options;

  const [allRelationships, setAllRelationships] = useState([]);
  const [displayedRelationships, setDisplayedRelationships] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState(null);

  const getCacheKey = useCallback((tokenId, offset, limit) => {
    return `${tokenId}-${offset}-${limit}`;
  }, []);

  const getCachedBatch = useCallback((tokenId, offset, limit) => {
    const cacheKey = getCacheKey(tokenId, offset, limit);
    const cached = relationshipCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    return null;
  }, [getCacheKey]);

  const cacheBatch = useCallback((tokenId, offset, limit, data) => {
    const cacheKey = getCacheKey(tokenId, offset, limit);
    relationshipCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (relationshipCache.size > 100) {
      const firstKey = relationshipCache.keys().next().value;
      relationshipCache.delete(firstKey);
    }
  }, [getCacheKey]);

  // Fetch relationships using React Query
  // Steve Jobs: Use same cache key as useControllerRelationships (remove skip from key!)
  const {
    data: relationshipData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['token-relationships-infinite', tokenId],
    queryFn: async () => {
      if (!tokenId || skip) return null;

      try {
        // Fetch ALL relationships at once (we'll slice for display)
        const response = await fetch(`/api/relationships/${tokenId}?limit=all`);

        if (!response.ok) {
          throw new Error(`Failed to fetch relationships: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    enabled: !skip && !!tokenId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Load a batch of relationships
  const loadBatch = useCallback(async (offset, limit) => {
    if (skip || !tokenId || !relationshipData?.relationships) return;

    try {
      // Check cache first
      const cached = getCachedBatch(tokenId, offset, limit);
      let relationships = cached;

      if (!cached && relationshipData) {
        // Slice from the full dataset
        const start = offset;
        const end = offset + limit;
        relationships = relationshipData.relationships.slice(start, end);
        cacheBatch(tokenId, offset, limit, relationships);
      }

      // Update displayed relationships - client-side pagination
      setDisplayedRelationships(prev => {
        if (offset === 0) return relationships;
        return [...prev, ...relationships];
      });

      setLoadedCount(prev => prev + relationships.length);

      // Check if we have more
      const totalAvailable = relationshipData.relationships.length;
      setHasMore(offset + relationships.length < totalAvailable);

      return relationships;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch relationships';
      setError(errorMessage);
      console.error('Error loading relationships:', errorMessage);
      return [];
    }
  }, [tokenId, batchSize, skip, relationshipData, getCachedBatch, cacheBatch]);

  // Load initial batch
  useEffect(() => {
    if (skip || !tokenId || !relationshipData) return;

    setDisplayedRelationships([]);
    setLoadedCount(0);
    setHasMore(true);
    setError(null);

    loadBatch(0, batchSize);
  }, [tokenId, skip, relationshipData?.relationships?.length, loadBatch]);

  // Load more when requested
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    const nextOffset = loadedCount;
    await loadBatch(nextOffset, batchSize);
  }, [isLoading, hasMore, loadedCount, loadBatch]);

  // Reset when token changes
  const reset = useCallback(() => {
    setAllRelationships([]);
    setDisplayedRelationships([]);
    setLoadedCount(0);
    setHasMore(true);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    relationships: displayedRelationships,
    allRelationships,
    isLoading,
    hasMore,
    error: error || relationshipData?.error,
    loadMore,
    reset,
    loadedCount,
    summary: relationshipData?.summary || {
      totalConnections: 0,
      uniqueControllers: 0,
      topController: null,
    },
  };
}

export default useInfiniteTokenRelationships;

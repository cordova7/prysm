/**
 * Custom React Hook for Token Relationships
 * Integrates with TanStack React Query for caching and background updates
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

const RELATIONSHIP_QUERY_KEY = 'token-relationships';

/**
 * Fetch relationship data for a token
 * @param {string} tokenId - The token's ledger ID
 * @param {Object} options - Query options
 * @returns {Object} - Query object with relationship data
 */
export function useTokenRelationships(tokenId, options = {}) {
  const {
    displayLimit = 50,
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
  } = options;

  const query = useQuery({
    queryKey: [RELATIONSHIP_QUERY_KEY, tokenId, displayLimit],
    queryFn: async () => {
      if (!tokenId) return null;

      const response = await fetch(`/api/relationships/${tokenId}?displayLimit=${displayLimit}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch relationships: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform the data for easier consumption
      return {
        ...data,
        // Add computed properties
        hasRelationships: data.relationships && data.relationships.length > 0,
        relationshipCount: data.relationships ? data.relationships.length : 0,
      };
    },
    enabled: enabled && !!tokenId,
    refetchOnWindowFocus,
    staleTime,
    cacheTime,
    retry: (failureCount, error) => {
      // Don't retry on 404 errors
      if (error.message.includes('404')) return false;
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
  });

  return query;
}

/**
 * Hook to prefetch relationship data for multiple tokens
 * Useful for preparing data before user hovers
 * @param {Array} tokenIds - Array of token IDs to prefetch
 * @param {Object} options - Query options
 */
export function usePrefetchTokenRelationships(tokenIds, options = {}) {
  const { displayLimit = 50 } = options;

  const prefetch = useCallback(async (tokenId) => {
    const queryClient = await import('@tanstack/react-query').then(m =>
      m.useQueryClient ? m.useQueryClient() : null
    );

    if (!queryClient) return;

    await queryClient.prefetchQuery({
      queryKey: [RELATIONSHIP_QUERY_KEY, tokenId, displayLimit],
      queryFn: async () => {
        const response = await fetch(`/api/relationships/${tokenId}?displayLimit=${displayLimit}`);
        if (!response.ok) throw new Error('Prefetch failed');
        return response.json();
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [displayLimit]);

  // Prefetch all token IDs
  if (Array.isArray(tokenIds)) {
    tokenIds.forEach(id => {
      if (id) prefetch(id);
    });
  }

  return { prefetch };
}

/**
 * Hook to get relationship data for multiple tokens at once
 * @param {Array} tokenIds - Array of token IDs
 * @param {Object} options - Query options
 * @returns {Object} - Map of tokenId -> query results
 */
export function useMultiTokenRelationships(tokenIds, options = {}) {
  const queries = {};

  tokenIds.forEach((tokenId) => {
    if (tokenId) {
      queries[tokenId] = useTokenRelationships(tokenId, options);
    }
  });

  return queries;
}

/**
 * Hook with debounced hover detection for relationships
 * Prevents API spam during rapid mouse movements
 * @param {Function} fetchFunction - Function to call after debounce
 * @param {number} delay - Debounce delay in ms (default: 200ms)
 * @returns {Object} - Object with hover handlers and state
 */
export function useDebouncedHover(fetchFunction, delay = 200) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [hoverTimeout, setHoverTimeout] = React.useState(null);

  const handleMouseEnter = useCallback(() => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    setIsHovered(true);

    // Set timeout to fetch data after delay
    const timeout = setTimeout(() => {
      if (fetchFunction) {
        fetchFunction();
      }
    }, delay);

    setHoverTimeout(timeout);
  }, [fetchFunction, delay, hoverTimeout]);

  const handleMouseLeave = useCallback(() => {
    // Clear timeout if still pending
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    setIsHovered(false);
  }, [hoverTimeout]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  return {
    isHovered,
    handleMouseEnter,
    handleMouseLeave,
  };
}

// Note: We need to import React for the useDebouncedHover hook
import React from 'react';

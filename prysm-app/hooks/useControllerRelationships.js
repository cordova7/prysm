/**
 * Hook to check if a specific controller has relationships
 * Efficiently pre-fetches relationship data and caches results
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

export function useControllerRelationships(tokenId, controllers = []) {
  const [controllerRelationshipMap, setControllerRelationshipMap] = useState({});

  // Fetch relationships for the token
  // Steve Jobs: Use same cache key as useInfiniteTokenRelationships for shared cache
  const { data, isLoading, error } = useQuery({
    queryKey: ['token-relationships-infinite', tokenId],
    queryFn: async () => {
      if (!tokenId) return null;

      const response = await fetch(`/api/relationships/${tokenId}?limit=all`);

      if (!response.ok) {
        throw new Error(`Failed to fetch relationships: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!tokenId && controllers.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    // CRITICAL: Only refetch if stale - don't block rendering
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // Still refetch to cache data, but don't block
    refetchOnReconnect: false,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Build controller -> hasRelationship map
  // Use a ref to track the latest tokenId to prevent race conditions
  const tokenIdRef = useRef(tokenId);

  useEffect(() => {
    tokenIdRef.current = tokenId;
  }, [tokenId]);

  useEffect(() => {
    // Create a new map based on current controllers only
    const map = {};

    // Initialize all current controllers as having no relationships
    controllers.forEach(controller => {
      map[controller] = false;
    });

    // Only update if we have data and controllers exist
    if (data && data.relationships && controllers.length > 0) {
      // Mark controllers that have relationships
      data.relationships.forEach(rel => {
        if (rel.sharedControllers && rel.sharedControllers.length > 0) {
          rel.sharedControllers.forEach(controllerId => {
            // Only update if this controller is in our current list
            if (map.hasOwnProperty(controllerId)) {
              map[controllerId] = true;
            }
          });
        }
      });
    }

    setControllerRelationshipMap(map);
  }, [data, controllers, tokenId]);

  // Helper to check if specific controller has relationships
  const hasRelationships = (controllerId) => {
    return controllerRelationshipMap[controllerId] || false;
  };

  return {
    controllerRelationshipMap,
    hasRelationships,
    isLoading,
    error,
    relationshipCount: data?.relationships?.length || 0,
  };
}

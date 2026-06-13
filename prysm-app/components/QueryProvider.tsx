'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

// Cache key for localStorage
const CACHE_KEY = 'snpr-query-cache';

function getStoredCache(): any {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Check if cache is still valid (10 min max age)
    if (parsed.timestamp && Date.now() - parsed.timestamp > 10 * 60 * 1000) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

function saveCache(client: QueryClient) {
  if (typeof window === 'undefined') return;
  try {
    const state = client.getQueryCache().getAll().map(query => ({
      queryKey: query.queryKey,
      state: query.state,
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      state,
    }));
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        retry: (failureCount, error: any) => {
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  // Restore cache AFTER hydration to avoid mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCache = getStoredCache();
    if (storedCache && Array.isArray(storedCache)) {
      storedCache.forEach(({ queryKey, state }) => {
        // Only restore if no data exists yet
        if (!queryClient.getQueryData(queryKey) && state?.data) {
          queryClient.setQueryData(queryKey, state.data);
        }
      });
      console.log('⚡ Cache restored:', storedCache.length, 'queries');

      // Avoid freezing old localStorage data as "fresh" (setQueryData stamps it as updated).
      // Force a background refresh for token-related queries immediately.
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    }

    // Save cache periodically and on visibility change
    const saveInterval = setInterval(() => saveCache(queryClient), 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCache(queryClient);
      }
    };

    const handleBeforeUnload = () => saveCache(queryClient);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(saveInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveCache(queryClient);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

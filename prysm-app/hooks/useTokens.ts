import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Query keys
export const TOKENS_QUERY_KEY = ['tokens'];
export const TOKENS_PAGINATED_QUERY_KEY = (page: number, limit: number) => ['tokens', 'paginated', page, limit];
export const TOKEN_DETAILS_QUERY_KEY = (id: string) => ['token', id];
export const TOKEN_CHART_QUERY_KEY = (id: string, interval: string) => ['chart', id, interval];

// Fetch all tokens from Supabase endpoint (optimized with pagination)
const fetchAllTokens = async () => {
  const response = await fetch('/api/tokens/supabase');
  if (!response.ok) {
    throw new Error('Failed to fetch tokens');
  }
  const data = await response.json();
  return data.data || data; // Handle both wrapped and plain responses
};

// Fetch tokens with pagination support
const fetchTokensPaginated = async (page: number = 1, limit: number = 100) => {
  const response = await fetch(`/api/tokens/supabase?page=${page}&limit=${limit}&sort=ic_id&order=desc`);
  if (!response.ok) {
    throw new Error('Failed to fetch tokens');
  }
  const data = await response.json();
  return data; // Return full response including pagination meta
};

// Fetch all tokens with React Query (now using Supabase - blazing fast with real-time!)
export const useTokens = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TOKENS_QUERY_KEY,
    queryFn: async () => {
      try {
        const response = await fetch('/api/tokens/supabase');
        if (!response.ok) {
          console.error('Failed to fetch tokens:', response.status, response.statusText);
          return [];
        }
        const data = await response.json();
        const tokens = data.data || data;
        return Array.isArray(tokens) ? tokens : [];
      } catch (error) {
        console.error('Error fetching tokens:', error);
        return [];
      }
    },
    staleTime: 300000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: typeof window !== 'undefined' && process.env.NODE_ENV === 'production' ? 120000 : false,
    refetchIntervalInBackground: typeof window !== 'undefined' && process.env.NODE_ENV === 'production',
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });

  // Real-time updates removed - using polling instead for reliability
  // The 2-minute polling is sufficient for token updates

  return query;
};

// Fetch tokens with pagination support (new optimized hook)
export const useTokensPaginated = (page: number = 1, limit: number = 100) => {
  return useQuery({
    queryKey: TOKENS_PAGINATED_QUERY_KEY(page, limit),
    queryFn: () => fetchTokensPaginated(page, limit),
    refetchInterval: 300000, // Refetch every 5 minutes
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    staleTime: 300000, // Data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Fetch new tokens from Supabase (last 24 hours)
const fetchNewTokens = async (hours: number = 24) => {
  const response = await fetch(`/api/new-tokens/supabase?hours=${hours}&limit=50`);
  if (!response.ok) {
    throw new Error('Failed to fetch new tokens');
  }
  const data = await response.json();
  return data.data || data;
};

// Hook for getting new tokens (very fast with Supabase!)
export const useNewTokens = (hours: number = 24) => {
  return useQuery({
    queryKey: ['tokens', 'new', hours],
    queryFn: () => fetchNewTokens(hours),
    refetchInterval: typeof window !== 'undefined' && process.env.NODE_ENV === 'production' ? 60000 : false,
    refetchIntervalInBackground: typeof window !== 'undefined' && process.env.NODE_ENV === 'production',
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    staleTime: 60000, // Data is fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Fetch single token details
export const useTokenDetails = (tokenId: string) => {
  return useQuery({
    queryKey: TOKEN_DETAILS_QUERY_KEY(tokenId),
    queryFn: () => fetchTokenDetails(tokenId),
    enabled: !!tokenId,
  });
};

// Fetch token pools
export const useTokenPools = (tokenId: string) => {
  return useQuery({
    queryKey: ['token', tokenId, 'pools'],
    queryFn: () => fetchTokenPools(tokenId),
    enabled: !!tokenId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Predefined query functions
async function fetchTokenDetails(tokenLedgerId: string) {
  const tokens = await fetchAllTokens();
  const token = tokens.find((t: any) => t.tokenLedgerId === tokenLedgerId);

  if (!token) {
    throw new Error(`Token with ledger ID "${tokenLedgerId}" not found`);
  }

  return token;
}

async function fetchTokenPools(tokenLedgerId: string) {
  const apiBase = 'https://api.icpswap.com/info';
  const response = await fetch(`${apiBase}/pool/all`);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== 200) {
    throw new Error(result.message || 'Unknown error');
  }

  return result.data.filter((pool: any) =>
    pool.token0LedgerId === tokenLedgerId || pool.token1LedgerId === tokenLedgerId
  );
}

// Invalidate and refetch tokens
export const useInvalidateTokens = () => {
  const queryClient = useQueryClient();

  return {
    invalidateTokens: () => queryClient.invalidateQueries({ queryKey: TOKENS_QUERY_KEY }),
    invalidateTokenDetails: (tokenId: string) =>
      queryClient.invalidateQueries({ queryKey: TOKEN_DETAILS_QUERY_KEY(tokenId) }),
  };
};

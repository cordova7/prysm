import { useState, useEffect, useCallback, useRef } from 'react';

interface Token {
  tokenLedgerId: string;
  icId: number;
  controllers: string[];
  name: string;
  symbol: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  totalSupply: number;
  marketCap: number;
  pair: string | null;
  dex: string | null;
  firstSeen: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  success: boolean;
  data: Token[];
  pagination: {
    total: number;
    limit: number;
  };
  meta?: {
    query: string;
    timestamp: string;
  };
}

interface UseTokenSearchReturn {
  searchResults: Token[];
  isSearching: boolean;
  searchError: string | null;
  hasSearched: boolean;
}

export function useTokenSearch(query: string, limit: number = 50): UseTokenSearchReturn {
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset if query is empty
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setSearchError(null);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    // Start search
    setIsSearching(true);
    setSearchError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const searchTokens = async () => {
      try {
        const response = await fetch(
          `/api/tokens/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const result: SearchResult = await response.json();

        if (result.success) {
          setSearchResults(result.data);
          setHasSearched(true);
        } else {
          throw new Error('Search failed');
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error('Token search error:', error);
        setSearchError(error.message || 'Failed to search tokens');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchTokens();

    return () => {
      controller.abort();
    };
  }, [query, limit]);

  return {
    searchResults,
    isSearching,
    searchError,
    hasSearched,
  };
}

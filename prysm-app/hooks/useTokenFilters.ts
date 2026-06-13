'use client';

import { useMemo } from 'react';
import type { FilterState } from '@/components/FilterControls';

interface Token {
  tokenLedgerId: string;
  icId: string;
  name: string;
  symbol: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  totalSupply: number;
  marketCap: number;
  pair: string;
  dex: string;
  firstSeen: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  isNew: boolean;
}

export function useTokenFilters(tokens: Token[], filters: FilterState, searchQuery: string) {
  const filteredTokens = useMemo(() => {
    let result = [...tokens];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (token) =>
          token.name?.toLowerCase().includes(query) ||
          token.symbol?.toLowerCase().includes(query) ||
          token.tokenLedgerId?.toLowerCase().includes(query)
      );
    }

    // Apply "new tokens only" filter
    if (filters.showNewOnly) {
      result = result.filter((token) => token.isNew);
    }

    // Apply sorting
    if (filters.sortBy !== 'default') {
      result.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        switch (filters.sortBy) {
          case 'icId':
            aValue = parseInt(a.icId || '0');
            bValue = parseInt(b.icId || '0');
            break;
          case 'price':
            aValue = a.price || 0;
            bValue = b.price || 0;
            break;
          case 'marketCap':
            aValue = a.marketCap || 0;
            bValue = b.marketCap || 0;
            break;
          case 'volume':
            aValue = a.volume24h || 0;
            bValue = b.volume24h || 0;
            break;
          default:
            return 0;
        }

        return filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    return result;
  }, [tokens, filters, searchQuery]);

  return {
    filteredTokens,
    totalCount: tokens.length,
    filteredCount: filteredTokens.length,
  };
}
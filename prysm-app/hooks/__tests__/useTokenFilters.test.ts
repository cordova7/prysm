import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenFilters } from '../useTokenFilters';

const mockTokens = [
  {
    tokenLedgerId: 'ledger1',
    icId: '100',
    name: 'Token A',
    symbol: 'TKA',
    price: 100,
    volume24h: 1000,
    priceChange24h: 5,
    liquidity: 5000,
    totalSupply: 1000000,
    marketCap: 100000,
    pair: 'pair1',
    dex: 'dex1',
    firstSeen: '2024-01-01',
    lastUpdated: '2024-01-01',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    updatedAt: '2024-01-01',
    isNew: true,
  },
  {
    tokenLedgerId: 'ledger2',
    icId: '200',
    name: 'Token B',
    symbol: 'TKB',
    price: 200,
    volume24h: 2000,
    priceChange24h: -3,
    liquidity: 10000,
    totalSupply: 2000000,
    marketCap: 400000,
    pair: 'pair2',
    dex: 'dex2',
    firstSeen: '2024-01-01',
    lastUpdated: '2024-01-01',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
    updatedAt: '2024-01-01',
    isNew: false,
  },
  {
    tokenLedgerId: 'ledger3',
    icId: '300',
    name: 'ICP Token',
    symbol: 'ICP',
    price: 150,
    volume24h: 5000,
    priceChange24h: 10,
    liquidity: 25000,
    totalSupply: 5000000,
    marketCap: 750000,
    pair: 'pair3',
    dex: 'dex3',
    firstSeen: '2024-01-01',
    lastUpdated: '2024-01-01',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    updatedAt: '2024-01-01',
    isNew: true,
  },
];

describe('useTokenFilters', () => {
  it('should return all tokens when no filters or search are applied', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, '')
    );

    expect(result.current.filteredTokens).toHaveLength(3);
    expect(result.current.filteredCount).toBe(3);
    expect(result.current.totalCount).toBe(3);
  });

  it('should filter tokens by search query (name)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, 'ICP')
    );

    expect(result.current.filteredTokens).toHaveLength(1);
    expect(result.current.filteredTokens[0].name).toBe('ICP Token');
  });

  it('should filter tokens by search query (symbol)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, 'TKA')
    );

    expect(result.current.filteredTokens).toHaveLength(1);
    expect(result.current.filteredTokens[0].symbol).toBe('TKA');
  });

  it('should filter tokens by search query (tokenLedgerId)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, 'ledger3')
    );

    expect(result.current.filteredTokens).toHaveLength(1);
    expect(result.current.filteredTokens[0].tokenLedgerId).toBe('ledger3');
  });

  it('should filter to show only new tokens', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: true, sortBy: 'default', sortOrder: 'desc' }, '')
    );

    expect(result.current.filteredTokens).toHaveLength(2);
    expect(result.current.filteredTokens.every((token) => token.isNew)).toBe(true);
  });

  it('should combine search and filter for new tokens only', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: true, sortBy: 'default', sortOrder: 'desc' }, 'ICP')
    );

    expect(result.current.filteredTokens).toHaveLength(1);
    expect(result.current.filteredTokens[0].name).toBe('ICP Token');
  });

  it('should sort by price (descending)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'price', sortOrder: 'desc' }, '')
    );

    expect(result.current.filteredTokens[0].price).toBe(200);
    expect(result.current.filteredTokens[1].price).toBe(150);
    expect(result.current.filteredTokens[2].price).toBe(100);
  });

  it('should sort by price (ascending)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'price', sortOrder: 'asc' }, '')
    );

    expect(result.current.filteredTokens[0].price).toBe(100);
    expect(result.current.filteredTokens[1].price).toBe(150);
    expect(result.current.filteredTokens[2].price).toBe(200);
  });

  it('should sort by market cap (descending)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'marketCap', sortOrder: 'desc' }, '')
    );

    expect(result.current.filteredTokens[0].marketCap).toBe(750000);
    expect(result.current.filteredTokens[1].marketCap).toBe(400000);
    expect(result.current.filteredTokens[2].marketCap).toBe(100000);
  });

  it('should sort by volume (descending)', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'volume', sortOrder: 'desc' }, '')
    );

    expect(result.current.filteredTokens[0].volume24h).toBe(5000);
    expect(result.current.filteredTokens[1].volume24h).toBe(2000);
    expect(result.current.filteredTokens[2].volume24h).toBe(1000);
  });

  it('should handle search with partial matches', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, 'tok')
    );

    expect(result.current.filteredTokens).toHaveLength(3);
  });

  it('should return empty array when search matches nothing', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, 'nonexistent')
    );

    expect(result.current.filteredTokens).toHaveLength(0);
  });

  it('should handle empty search query', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, '')
    );

    expect(result.current.filteredTokens).toHaveLength(3);
  });

  it('should handle case-insensitive search', () => {
    const { result } = renderHook(() =>
      useTokenFilters(mockTokens, { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' }, 'icp')
    );

    expect(result.current.filteredTokens).toHaveLength(1);
    expect(result.current.filteredTokens[0].name).toBe('ICP Token');
  });
});
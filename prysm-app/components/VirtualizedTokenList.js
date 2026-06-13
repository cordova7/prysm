'use client';

import { FixedSizeList as List } from 'react-window';
import { useMemo, useState, useEffect } from 'react';
import TokenCard from '@/components/TokenCard';
import { preloadTokenLogos } from '@/hooks/useTokenLogo';

export default function VirtualizedTokenList({
  tokens,
  height = 800,
  itemHeight = 120,
  onTokenClick,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Preload logos for the first 20 tokens (highest icID - what user sees first)
  useEffect(() => {
    if (tokens && tokens.length > 0) {
      const firstTokenIds = tokens.slice(0, 20).map(t => t.tokenLedgerId || t.id);
      preloadTokenLogos(firstTokenIds);
    }
  }, [tokens]);


  // Filter tokens by search query (tokens are already sorted by highest icId from API)
  const filteredTokens = useMemo(() => {
    let filtered = [...tokens];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (token) =>
          token.symbol?.toLowerCase().includes(query) ||
          token.name?.toLowerCase().includes(query) ||
          token.tokenLedgerId?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [tokens, searchQuery]);

  // Token row component
  const TokenRow = ({ index, style }) => {
    const token = filteredTokens[index];

    if (!token) return null;

    return (
      <div style={style} className="px-4 py-2">
        <div onClick={() => onTokenClick?.(token)} className="cursor-pointer">
          <TokenCard token={token} />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#f6fdff] rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#f6fdff]">All Tokens</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{filteredTokens.length} tokens</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name or symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Virtualized List */}
      <div style={{ height }}>
        {filteredTokens.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No tokens found</p>
              <p className="text-sm text-gray-400">
                Try adjusting your search
              </p>
            </div>
          </div>
        ) : (
          <List
            height={height}
            itemCount={filteredTokens.length}
            itemSize={itemHeight}
            width="100%"
            itemData={filteredTokens}
          >
            {TokenRow}
          </List>
        )}
      </div>
    </div>
  );
}

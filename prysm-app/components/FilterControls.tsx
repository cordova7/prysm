'use client';

import React from 'react';
import { useState, useEffect } from 'react';

interface FilterControlsProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  showNewOnly: boolean;
  sortBy: 'default' | 'icId' | 'price' | 'marketCap' | 'volume';
  sortOrder: 'asc' | 'desc';
}

const defaultFilters: FilterState = {
  showNewOnly: false,
  sortBy: 'icId',
  sortOrder: 'desc',
};

export default function FilterControls({ onFilterChange, initialFilters }: FilterControlsProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters || defaultFilters);

  // Ensure state is initialized consistently
  useEffect(() => {
    if (initialFilters && JSON.stringify(filters) !== JSON.stringify(initialFilters)) {
      setFilters(initialFilters);
      onFilterChange(initialFilters);
    }
  }, [initialFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const defaultFilters: FilterState = {
      showNewOnly: false,
      sortBy: 'icId',
      sortOrder: 'desc',
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  return (
    <div className="bg-[var(--color-bg-secondary)]/60 backdrop-blur-sm rounded-lg p-4 mb-6 border border-[var(--color-border)]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text)]">Filters:</label>
          <button
            onClick={() => updateFilter('showNewOnly', !filters.showNewOnly)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filters.showNewOnly
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            NEW TOKENS
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text)]">Sort:</label>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
            className="bg-[var(--color-bg-card)] text-[var(--color-text)] text-sm rounded px-3 py-1.5 border border-[var(--color-border)] focus:border-[var(--color-text)] focus:outline-none"
          >
            <option value="icId">Newest</option>
            <option value="price">Price</option>
            <option value="marketCap">Market Cap</option>
            <option value="volume">Volume</option>
          </select>

          <button
            onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--color-bg-card)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            {filters.sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        {(filters.showNewOnly || filters.sortBy !== 'icId') && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 rounded text-sm font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
          >
            Clear
          </button>
        )}

        <div className="text-sm text-[var(--color-text-secondary)] ml-auto">
          {filters.showNewOnly && 'Showing new tokens only'}
          {filters.sortBy !== 'icId' && `Sorted by ${filters.sortBy}`}
        </div>
      </div>
    </div>
  );
}

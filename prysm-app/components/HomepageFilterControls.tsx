'use client';

import { FilterType } from '@/hooks/useHomepageFilters';

interface HomepageFilterControlsProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  icpThreshold: number;
  setIcpThreshold: (threshold: number) => void;
  isCalculating: boolean;
  progress: { current: number; total: number };
  filteredCount: number;
  totalCount: number;
  useGlobalRanking: boolean;
  setUseGlobalRanking: (value: boolean) => void;
}

const filterLabels: Record<FilterType, string> = {
  newest: 'Newest',
  quality: 'Quality',
  volume: 'Volume',
  icpPool: 'ICP in Pool',
};

export default function HomepageFilterControls({
  showFilters,
  setShowFilters,
  activeFilter,
  onFilterChange,
  icpThreshold,
  setIcpThreshold,
  isCalculating,
  progress,
  filteredCount,
  totalCount,
  useGlobalRanking,
  setUseGlobalRanking,
}: HomepageFilterControlsProps) {
  const filterButtonClass = (filter: FilterType) => {
    const baseClass =
      'px-3 py-1.5 rounded text-sm font-medium transition-colors duration-200';
    if (activeFilter === filter) {
      return `${baseClass} bg-[var(--color-primary)] text-[var(--color-on-primary)]`;
    }
    return `${baseClass} bg-[var(--color-bg-card)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]`;
  };

  // Don't render anything if filters are hidden
  if (!showFilters) {
    return null;
  }

  return (
    <div className="mb-4 sm:mb-6">
      {/* Filter Panel */}
      <div className="bg-[var(--color-bg-secondary)]/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[var(--color-border)]">
          {/* Progress indicator for Quality/Recent Activity filter */}
          {isCalculating && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-secondary mb-3 sm:mb-4">
              <svg
                className="animate-spin h-4 w-4 text-[var(--color-text)]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>
                Calculating...
                {' '}
                ({progress.current}/{progress.total})
              </span>
            </div>
          )}

          {/* Filter Options */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <span className="text-sm text-[var(--color-text)] font-medium">Sort by:</span>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onFilterChange('newest')}
                className={filterButtonClass('newest')}
              >
                Newest
              </button>
              <button
                onClick={() => onFilterChange('quality')}
                className={filterButtonClass('quality')}
                disabled={isCalculating && activeFilter !== 'quality'}
              >
                Quality
              </button>
              <button
                onClick={() => onFilterChange('volume')}
                className={filterButtonClass('volume')}
              >
                Volume
              </button>
              <button
                onClick={() => onFilterChange('icpPool')}
                className={filterButtonClass('icpPool')}
              >
                ICP in Pool
              </button>
            </div>

            {/* Filter-specific Controls */}
            {(activeFilter === 'quality' || activeFilter === 'volume') && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-0 sm:ml-auto w-full sm:w-auto">
                {/* Scope Toggle */}
                <div className="flex items-center gap-2">
                  <label className="text-xs sm:text-sm text-secondary">Scope:</label>
                  <button
                    onClick={() => setUseGlobalRanking(false)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      !useGlobalRanking
                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                        : 'bg-[var(--color-bg-card)] text-secondary hover:text-[var(--color-text)]'
                    }`}
                    title="Analyze current page only"
                  >
                    Page
                  </button>
                  <button
                    onClick={() => setUseGlobalRanking(true)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      useGlobalRanking
                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                        : 'bg-[var(--color-bg-card)] text-secondary hover:text-[var(--color-text)]'
                    }`}
                    title="Analyze all tokens globally"
                  >
                    Global
                  </button>
                </div>

                {/* ICP Threshold (only for quality) */}
                {activeFilter === 'quality' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="icp-threshold" className="text-xs sm:text-sm text-secondary">
                      Min ICP:
                    </label>
                    <input
                      id="icp-threshold"
                      type="number"
                      value={icpThreshold}
                      onChange={(e) => setIcpThreshold(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded bg-[var(--color-bg-card)] text-[var(--color-text)] border border-[var(--color-border)] focus:border-[var(--color-text)] transition-colors text-sm"
                      min="0"
                      step="1"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick reset if no results */}
          {activeFilter === 'quality' && filteredCount === 0 && totalCount > 0 && (
            <div className="text-center py-3 mt-2 bg-[var(--color-bg-card)]/30 rounded">
              <p className="text-secondary text-sm mb-2">
                No tokens meet the {icpThreshold} ICP threshold
              </p>
              <button
                onClick={() => setIcpThreshold(1)}
                className="text-[var(--color-text)] hover:text-[#0071e3] text-sm underline transition-colors"
              >
                Lower to 1 ICP
              </button>
            </div>
          )}
      </div>
    </div>
  );
}

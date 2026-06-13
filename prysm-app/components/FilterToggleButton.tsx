'use client';

import { FilterType } from '@/hooks/useHomepageFilters';

interface FilterToggleButtonProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeFilter: FilterType;
}

const filterLabels: Record<FilterType, string> = {
  newest: 'Newest',
  quality: 'Quality',
  volume: 'Volume',
  icpPool: 'ICP in Pool',
};

export default function FilterToggleButton({
  showFilters,
  setShowFilters,
  activeFilter,
}: FilterToggleButtonProps) {
  const hasActiveFilter = activeFilter !== 'newest';

  return (
    <button
      onClick={() => setShowFilters(!showFilters)}
      className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
        showFilters || hasActiveFilter
          ? 'bg-[#2a2a27] border border-[#3a3a34]'
          : 'bg-transparent border border-transparent hover:bg-[#1c1c19]'
      }`}
      title={hasActiveFilter ? filterLabels[activeFilter] : 'Filters'}
    >
      <svg
        className={`w-3.5 h-3.5 transition-colors ${
          hasActiveFilter ? 'text-[#f6fdff]' : 'text-gray-500 group-hover:text-gray-400'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
        />
      </svg>
      {hasActiveFilter && (
        <span className="text-[10px] font-medium text-gray-400">
          {filterLabels[activeFilter]}
        </span>
      )}
    </button>
  );
}

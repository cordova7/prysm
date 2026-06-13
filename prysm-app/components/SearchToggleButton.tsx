'use client';

interface SearchToggleButtonProps {
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;
  hasSearchQuery: boolean;
}

export default function SearchToggleButton({
  showSearch,
  setShowSearch,
  hasSearchQuery,
}: SearchToggleButtonProps) {
  return (
    <button
      onClick={() => setShowSearch(!showSearch)}
      className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
        showSearch || hasSearchQuery
          ? 'bg-[#2a2a27] border border-[#3a3a34]'
          : 'bg-transparent border border-transparent hover:bg-[#1c1c19]'
      }`}
      title="Search tokens"
    >
      <svg
        className={`w-3.5 h-3.5 transition-colors ${
          hasSearchQuery ? 'text-[#f6fdff]' : 'text-gray-500 group-hover:text-gray-400'
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
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {hasSearchQuery && (
        <span className="text-[10px] font-medium text-gray-400">
          Search
        </span>
      )}
    </button>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TokenSearchBarProps {
  showSearch: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onClose: () => void;
}

export default function TokenSearchBar({
  showSearch,
  searchQuery,
  setSearchQuery,
  onClose,
}: TokenSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleChange = useCallback((value: string) => {
    setLocalQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }, [setSearchQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (showSearch) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSearch, onClose]);

  if (!showSearch) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="bg-[var(--color-bg-secondary)]/60 backdrop-blur-sm rounded-lg p-4 border border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <svg
            className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0"
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

          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search by name, symbol, or canister ID..."
            className="flex-1 bg-transparent text-[var(--color-text)] text-sm placeholder-[var(--color-text-secondary)] outline-none"
            autoComplete="off"
            spellCheck={false}
          />

          {localQuery && (
            <button
              onClick={() => {
                handleChange('');
                inputRef.current?.focus();
              }}
              className="p-1 hover:bg-[var(--color-bg-card)] rounded transition-colors"
              title="Clear search"
            >
              <svg
                className="w-4 h-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-bg-card)] rounded transition-colors ml-2"
            title="Close search (Esc)"
          >
            <svg
              className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

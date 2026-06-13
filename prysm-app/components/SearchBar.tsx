'use client';

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = "Search tokens..." }: SearchBarProps) {
  // Initialize with empty string to ensure server/client match
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearch]);

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative mb-6">
      <div className={`relative transition-all duration-200 ${
        isFocused ? 'transform scale-[1.02]' : ''
      }`}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-[var(--color-text-secondary)]" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          aria-label="Search tokens by name, symbol, or ID"
          aria-describedby="search-help"
          className="w-full bg-[var(--color-bg-secondary)]/60 backdrop-blur-sm border border-[var(--color-border)] rounded-lg pl-11 pr-11 py-3 text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-text)] transition-all"
          role="searchbox"
        />

        <button
          onClick={clearSearch}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors focus:outline-none rounded"
          aria-label="Clear search"
          type="button"
          style={{ display: query.length > 0 ? 'flex' : 'none' }}
        >
          <FiX className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        id="search-help"
        className="absolute top-full left-0 right-0 mt-2 p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-dropdown"
        role="status"
        aria-live="polite"
        style={{ display: query.length > 0 ? 'block' : 'none' }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          Searching for: <span className="text-[var(--color-text)] font-medium">{query}</span>
        </p>
      </div>
    </div>
  );
}
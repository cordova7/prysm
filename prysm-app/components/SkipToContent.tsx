/**
 * Skip to Content Link
 * Improves accessibility by allowing keyboard users to skip navigation
 * First focusable element on the page
 */

'use client';

import React from 'react';

interface SkipToContentProps {
  href?: string;
  children?: React.ReactNode;
}

export default function SkipToContent({
  href = '#main-content',
  children = 'Skip to main content',
}: SkipToContentProps) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#f6fdff] focus:text-[#161614] focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f6fdff] focus:ring-offset-2 focus:ring-offset-[#161614] transition-all duration-200"
      onFocus={(e) => {
        // Add visible style when focused via keyboard navigation
        e.currentTarget.classList.remove('sr-only');
      }}
      onBlur={(e) => {
        // Hide when focus is lost
        e.currentTarget.classList.add('sr-only');
      }}
    >
      {children}
    </a>
  );
}

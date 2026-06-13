'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Ensure we have valid numbers
  const safeCurrentPage = Number.isFinite(currentPage) ? currentPage : 1;
  const safeTotalPages = Number.isFinite(totalPages) ? totalPages : 0;
  const safePageSize = Number.isFinite(pageSize) ? pageSize : 10;

  const handlePageChange = (page: number) => {
    // Don't go below page 1 or above total pages
    if (page < 1 || page > safeTotalPages) return;

    // Call onPageChange if provided
    if (onPageChange) {
      onPageChange(page);
    }

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    params.set('limit', safePageSize.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (size: number) => {
    // Call onPageSizeChange if provided
    if (onPageSizeChange) {
      onPageSizeChange(size);
    }

    // Update URL and reset to page 1
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', size.toString());
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  // Calculate range of page numbers to show
  const getPageRange = () => {
    const range = [];
    const delta = 2; // Show 2 pages before and after current

    for (
      let i = Math.max(1, safeCurrentPage - delta);
      i <= Math.min(safeTotalPages, safeCurrentPage + delta);
      i++
    ) {
      range.push(i);
    }

    return range;
  };

  const pageRange = getPageRange();

  // Always show pagination if we have more than 1 page
  if (!safeTotalPages || safeTotalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4 my-8" data-testid="pagination-controls">
      <div className="flex items-center gap-4">
        {/* Previous Button - Only show if not on first page */}
        {safeCurrentPage > 1 && (
          <button
            onClick={() => handlePageChange(safeCurrentPage - 1)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-[var(--color-bg-card)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Previous page"
            data-testid="pagination-previous"
          >
            <span className="text-xl leading-none">&lt;</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{safeCurrentPage - 1}</span>
          </button>
        )}

        {/* Next Button - Only show if not on last page */}
        {safeCurrentPage < safeTotalPages && (
          <button
            onClick={() => handlePageChange(safeCurrentPage + 1)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-[var(--color-bg-card)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Next page"
            data-testid="pagination-next"
          >
            <span className="text-xl leading-none">&gt;</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{safeCurrentPage + 1}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PaginationControls;
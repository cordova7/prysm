'use client';

import { useEffect, Suspense, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import TokenTileGrid from '@/components/TokenTileGrid'
import Header from '@/components/Header'
import PaginationControls from '@/components/PaginationControls'
import { TOKENS_PAGINATED_QUERY_KEY, useTokensPaginated } from '@/hooks/useTokens'
import { useTokenFilters } from '@/hooks/useTokenFilters'
import { TokenGridSkeleton } from '@/components/SkeletonLoader'
import { useRealTimeTokenUpdates } from '@/hooks/useWebSocket'
import { useAutoTokenRefresh } from '@/hooks/useAutoTokenRefresh'
import { useIsClient } from '@/hooks/useIsClient'
import { PromotedBanner } from '@/components/promotions'
import { prefetchTokenTransactions } from '@/hooks/useTokenTransactions'
import { prefetchComments } from '@/hooks/useComments'
import { useHomepageFilters } from '@/hooks/useHomepageFilters'
import HomepageFilterControls from '@/components/HomepageFilterControls'
import TokenSearchBar from '@/components/TokenSearchBar'
import { useTokenSearch } from '@/hooks/useTokenSearch'

// Simple loading skeleton
function PageSkeleton() {
  return (
    <div className="relative mb-16 mt-8 flex items-center justify-center">
      <img
        src="/crystal-shards.png"
        alt="Loading"
        className="w-64 h-auto animate-pulse opacity-80"
      />
    </div>
  )
}

// Client component that uses pagination
function TokenListClient({ showFilters, setShowFilters, activeFilter, setActiveFilter, showSearch, setShowSearch, searchQuery, setSearchQuery }) {
  const { isHydrated } = useIsClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Parse URL parameters with validation
  const currentPage = searchParams ? parseInt(searchParams.get('page') || '1', 10) : 1
  const pageSize = searchParams ? parseInt(searchParams.get('limit') || '104', 10) : 104

  // Fetch paginated tokens
  const { data: paginatedData, isLoading, isFetching, error } = useTokensPaginated(currentPage, pageSize)

  // Enable real-time updates for automatic token refresh
  useRealTimeTokenUpdates(60000) // Poll every 60 seconds

  // Enable auto token refresh for continuous new token detection (silent mode)
  useAutoTokenRefresh()

  const [visibleCount, setVisibleCount] = useState(0)
  const [showLoadingBrand, setShowLoadingBrand] = useState(true)

  // ICP threshold filter state
  const [icpThreshold, setIcpThreshold] = useState(10)
  const [useGlobalRanking, setUseGlobalRanking] = useState(false)

  // Token search
  const { searchResults, isSearching, searchError, hasSearched } = useTokenSearch(searchQuery, 50)
  const isInSearchMode = searchQuery && searchQuery.trim().length > 0

  // Steve Jobs UX Timing: Track the magical moments (client-side only to prevent hydration mismatch)
  // Don't initialize in useState to avoid hydration mismatch - set only in useEffect
  const [loadStartTime, setLoadStartTime] = useState(undefined)

  // Initialize loadStartTime on client side only (after hydration)
  useEffect(() => {
    setLoadStartTime(Date.now())
  }, [])

  // Sync filter state from URL params on mount
  useEffect(() => {
    if (!isHydrated || !searchParams) return;

    const filterParam = searchParams.get('filter');
    if (filterParam && ['newest', 'quality', 'volume', 'icpPool'].includes(filterParam)) {
      setActiveFilter(filterParam);
    }

    const thresholdParam = searchParams.get('minIcp');
    if (thresholdParam) {
      const threshold = Number(thresholdParam);
      if (Number.isFinite(threshold) && threshold >= 0) {
        setIcpThreshold(threshold);
      }
    }

    const globalParam = searchParams.get('global');
    if (globalParam === 'true') {
      setUseGlobalRanking(true);
    }
  }, [isHydrated, searchParams]);

  // Update URL when filter changes
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    // Preserve existing params like 'page' and 'limit'
    if (activeFilter !== 'newest') {
      params.set('filter', activeFilter);
    } else {
      params.delete('filter');
    }

    if (activeFilter === 'quality' && icpThreshold !== 10) {
      params.set('minIcp', icpThreshold.toString());
    } else {
      params.delete('minIcp');
    }

    if (activeFilter === 'quality' && useGlobalRanking) {
      params.set('global', 'true');
    } else {
      params.delete('global');
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [activeFilter, icpThreshold, useGlobalRanking, isHydrated]);

  // Extract tokens and pagination metadata
  const tokens = paginatedData?.data || []
  const pagination = paginatedData?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: 0,
    totalPages: 0,
    hasMore: false
  }
  const hasCachedData = tokens.length > 0

  // Apply homepage filters (sorting and filtering)
  const {
    filteredTokens: sortedTokens,
    isLoading: isCalculating,
    progress,
    error: filterError,
  } = useHomepageFilters(tokens, activeFilter, icpThreshold, useGlobalRanking)

  // Keep the old search filter for backwards compatibility (currently unused on homepage)
  const { filteredTokens, totalCount, filteredCount } = useTokenFilters(
    sortedTokens,
    { showNewOnly: false, sortBy: 'default', sortOrder: 'desc' },
    ''
  )

  // Steve Jobs Magic: Smart prefetching for instant relationships
  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window === 'undefined' || !loadStartTime) return;

    if (!isLoading && tokens.length > 0) {
      // Hide loading brand image
      const brandTimer = setTimeout(() => {
        setShowLoadingBrand(false)
      }, 200)

      // Show ALL tokens immediately (no progressive delay)
      setVisibleCount(tokens.length)

      // Steve Jobs: Trigger relationship prefetching for instant user experience
      // Prefetch top 100 tokens' relationships in background with retry logic
      const triggerPrefetch = async (attempt = 1) => {
        const maxAttempts = 3;
        const baseDelay = 1000; // 1 second

        try {
          // Trigger batch precomputation (no cron job needed!)
          // This will cache relationships for instant future access
          // IMPORTANT: Only process first 10 tokens (homepage tokens) for instant loading
          const prefetchPromise = fetch('/api/precompute-batch?range=0-9&limit=10')
            .then(r => r.json())
            .then(result => {
              return result;
            })
            .catch(error => {
              // Silent fail - background operation
            });

          const prefetchPromises = [prefetchPromise];

          const results = await Promise.allSettled(prefetchPromises)
        } catch (error) {
          // Retry with exponential backoff
          if (attempt < maxAttempts) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            setTimeout(() => triggerPrefetch(attempt + 1), delay);
          }
        }
      }

      // Start prefetching immediately (not after 2 seconds!)
      // Critical: Users expand tokens before 2s, so we need relationships cached NOW
      triggerPrefetch()

      return () => {
        clearTimeout(brandTimer)
      }
    }

    // Reset only on new page load
    if (!isLoading && tokens.length === 0) {
      setVisibleCount(0)
      setShowLoadingBrand(true)
    }
  }, [isLoading, tokens.length])

  useEffect(() => {
    if (!isHydrated || isLoading || tokens.length === 0) return;
    if (typeof window === 'undefined') return;

    const pageTokenIds = tokens.map((token) => token.tokenLedgerId).filter(Boolean);

    const prefetchNextPage = async () => {
      if (!pagination.hasMore) return;
      const nextPage = pagination.page + 1;
      await queryClient.prefetchQuery({
        queryKey: TOKENS_PAGINATED_QUERY_KEY(nextPage, pageSize),
        queryFn: async () => {
          const response = await fetch(`/api/tokens/supabase?page=${nextPage}&limit=${pageSize}&sort=ic_id&order=desc`);
          if (!response.ok) {
            throw new Error('Failed to prefetch next page');
          }
          return response.json();
        },
        staleTime: 300000,
      });
    };

    const prefetchPoolBalances = async (tokenId) => {
      if (typeof window === 'undefined') return;

      // Keep prefetch bookkeeping separate from the real pool cache used by TokenCardTabs.
      const prefetchKey = `token_pools_prefetch_${tokenId}`;
      try {
        if (sessionStorage.getItem(prefetchKey)) return;
      } catch {
        // sessionStorage unavailable; continue best-effort without caching
      }

      try {
        const response = await fetch(`/api/pool-balances/${tokenId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (!data?.success) return;

        // Mark as prefetched (small write; avoids repeated prefetch attempts).
        try {
          sessionStorage.setItem(prefetchKey, String(Date.now()));
        } catch {
          // Ignore quota/private-mode failures
        }

        // Best-effort: populate the real pool cache, but avoid huge writes.
        const cacheKey = `token_pools_${tokenId}`;
        const payload = { pools: data.pools || [], timestamp: Date.now() };
        try {
          const serialized = JSON.stringify(payload);
          if (serialized.length <= 50_000) {
            sessionStorage.setItem(cacheKey, serialized);
          }
        } catch {
          // Ignore quota/private-mode failures
        }
      } catch {
        // Best-effort prefetch; ignore failures
      }
    };

    const prefetchRelationships = async (tokenId) => {
      await queryClient.prefetchQuery({
        queryKey: ['token-relationships-infinite', tokenId],
        queryFn: async () => {
          const response = await fetch(`/api/relationships/${tokenId}?limit=all`);
          if (!response.ok) {
            throw new Error('Failed to fetch relationships');
          }
          return response.json();
        },
        staleTime: 5 * 60 * 1000,
      });
    };

    const runPrefetch = async () => {
      const topTokens = pageTokenIds.slice(0, 20);
      const topHeavyTokens = pageTokenIds.slice(0, 10);

      await Promise.allSettled([
        prefetchNextPage(),
        ...topTokens.map((tokenId) => prefetchRelationships(tokenId)),
      ]);

      topHeavyTokens.forEach((tokenId) => {
        prefetchTokenTransactions(tokenId, 50);
        prefetchComments(tokenId, 50);
        prefetchPoolBalances(tokenId);
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => runPrefetch(), { timeout: 800 });
    } else {
      setTimeout(runPrefetch, 200);
    }
  }, [isHydrated, isLoading, tokens, pageSize, pagination.page, pagination.hasMore, queryClient]);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <TokenGridSkeleton />
      </div>
    )
  }

  // Show loading state only if no cached data
  if (isLoading && !hasCachedData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {showLoadingBrand && (
          <motion.div
            className="relative mb-16 mt-8 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src="/crystal-shards.png"
              alt="Loading"
              className="w-64 h-auto animate-pulse opacity-80"
            />
          </motion.div>
        )}
        <TokenGridSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl text-[var(--color-text)] mb-4">Error</h2>
            <p className="text-[var(--color-text-secondary)] mb-4">{error.message}</p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded hover:bg-[var(--color-primary-hover)]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show tokens immediately after loading (no intermediate skeleton state)
  // This ensures tokens display as soon as they're available

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Promoted Banner */}
      <PromotedBanner
        tokens={tokens}
        onTokenClick={(tokenId) => {
          // Expand the promoted token in the list
          const tokenElement = document.querySelector(`[data-token-ledger-id="${tokenId}"]`);
          if (tokenElement) {
            tokenElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            tokenElement.click();
          }
        }}
        className="mb-4 sm:mb-6"
      />

      {/* Search Bar */}
      <TokenSearchBar
        showSearch={showSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onClose={() => {
          setShowSearch(false)
          setSearchQuery('')
        }}
      />

      {/* Filter Controls (hidden during search) */}
      {!isInSearchMode && (
        <HomepageFilterControls
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          icpThreshold={icpThreshold}
          setIcpThreshold={setIcpThreshold}
          isCalculating={isCalculating}
          progress={progress}
          filteredCount={filteredTokens.length}
          totalCount={sortedTokens.length}
          useGlobalRanking={useGlobalRanking}
          setUseGlobalRanking={setUseGlobalRanking}
        />
      )}

      {/* Token Grid */}
      {isInSearchMode ? (
        // Search Results Mode
        <>
          {isSearching ? (
            <div className="flex items-center justify-center py-16">
              <svg
                className="animate-spin h-6 w-6 text-[var(--color-text)] mr-3"
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
              <span className="text-[var(--color-text-secondary)]">Searching...</span>
            </div>
          ) : searchError ? (
            <div className="text-center py-16 px-4">
              <p className="text-red-400 mb-4">{searchError}</p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-6 py-2 bg-[var(--color-border)] text-[var(--color-text)] rounded hover:bg-[var(--color-border-hover)] transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-[var(--color-text-secondary)] mb-4 text-lg">
                No tokens found for "{searchQuery}"
              </p>
              <p className="text-[var(--color-text-muted)] text-sm mb-6">
                Try searching by token name, symbol, or canister ID
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-6 py-2 bg-[var(--color-border)] text-[var(--color-text)] rounded hover:bg-[var(--color-border-hover)] transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Found {searchResults.length} token{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setShowSearch(false)
                  }}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  Clear search
                </button>
              </div>
              <TokenTileGrid tokens={searchResults} />
            </>
          ) : null}
        </>
      ) : (
        // Normal Mode
        <>
          {filteredTokens.length === 0 && activeFilter !== 'newest' && !isLoading && (
            <div className="text-center py-16 px-4">
              <p className="text-[var(--color-text-secondary)] mb-4 text-lg">
                No tokens match the selected filter
              </p>
              <p className="text-[var(--color-text-muted)] text-sm mb-6">
                {activeFilter === 'quality'
                  ? `Try adjusting the minimum ICP threshold (currently ${icpThreshold} ICP) or select a different filter`
                  : 'Try selecting a different filter or reset to newest'}
              </p>
              <button
                onClick={() => setActiveFilter('newest')}
                className="px-6 py-2 bg-[var(--color-border)] text-[var(--color-text)] rounded hover:bg-[var(--color-border-hover)] transition-colors"
              >
                Reset to Newest
              </button>
            </div>
          )}
          {filteredTokens.length > 0 && <TokenTileGrid tokens={filteredTokens} />}
        </>
      )}

      {/* Pagination (hidden during search) */}
      {!isInSearchMode && (
        <PaginationControls
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.limit}
        />
      )}
    </div>
  )
}

export default function Home() {
  // Filter state (lifted to parent so it can be passed to Header)
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState('newest')

  // Search state (lifted to parent so it can be passed to Header)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Preload critical resources
  useEffect(() => {
    // Only run on the client side
    if (typeof window === 'undefined') return;

    fetch('/api/visit', { method: 'POST' }).catch(() => {});

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = '/api/tokens/supabase'
    document.head.appendChild(link)

    const link2 = document.createElement('link')
    link2.rel = 'prefetch'
    link2.href = '/api/new-tokens/supabase'
    document.head.appendChild(link2)

    // Charts and relationships are now pre-loaded by PreloadData component
    // This is more efficient than API-based prefetching
    // (Removed chart prefetch - now handled by PreloadData in TokenCard)

    return () => {
      try {
        if (link && link.parentNode) {
          document.head.removeChild(link)
        }
      } catch (e) {
        // Element might have already been removed
      }
      try {
        if (link2 && link2.parentNode) {
          document.head.removeChild(link2)
        }
      } catch (e) {
        // Element might have already been removed
      }
    }
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Header
        showPromoSummary
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        activeFilter={activeFilter}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        hasSearchQuery={searchQuery.length > 0}
      />
      <Suspense fallback={<PageSkeleton />}>
        <TokenListClient
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </Suspense>

      <div id="loading-indicator" className="hidden" />
      <div
        onMouseEnter={() => {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.href = '/api/tokens/supabase'
          document.head.appendChild(link)
        }}
        className="hidden"
      />
    </div>
  )
}

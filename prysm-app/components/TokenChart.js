'use client';

import React, { useState, useEffect } from 'react';
import ChartJSAdapter from './ChartJSAdapter';
import { parseChartData } from '@/lib/dateUtils';
import { useInfiniteTransactions } from '@/hooks/useInfiniteTransactions';

const getCachedChartData = (tokenId, range) => {
  if (typeof window === 'undefined') return [];

  try {
    const cached = sessionStorage.getItem(`chart_${tokenId}_${range}`);
    if (!cached) return [];
    const result = JSON.parse(cached);
    if (result.success && result.timestamp) {
      const MAX_CACHE_AGE = 5 * 60 * 1000;
      const cacheAge = Date.now() - new Date(result.timestamp).getTime();
      if (cacheAge < MAX_CACHE_AGE) {
        return parseChartData(result);
      }
    }
  } catch (error) {
    return [];
  }

  return [];
};

const TokenChart = ({ tokenId, timeRange = '24h', showRangeSelector = true }) => {
  const [chartData, setChartData] = useState(() => getCachedChartData(tokenId, timeRange));
  const [loading, setLoading] = useState(false); // Changed to false - use sessionStorage immediately
  const [error, setError] = useState(null);
  const [selectedRange, setSelectedRange] = useState(timeRange);

  // Get transaction data for chart enhancement
  const { transactions, isLoading: txLoading } = useInfiniteTransactions(tokenId, {
    batchSize: 100,
    maxCached: 500,
    skip: !tokenId,
  });

  // 🚀 CHART OPTIMIZATION: Clean up old sessionStorage entries to prevent bloat
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const CACHE_PREFIX = `chart_${tokenId}_`;
      const now = Date.now();
      const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes (matches API cache)

      // Clean up expired entries
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const cached = JSON.parse(sessionStorage.getItem(key));
            if (cached && cached.timestamp) {
              const age = now - new Date(cached.timestamp).getTime();
              if (age > MAX_CACHE_AGE) {
                sessionStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Invalid cache entry, remove it
            sessionStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      // sessionStorage not accessible (private mode or security context)
      console.warn('sessionStorage not accessible:', error.message);
    }
  }, [tokenId]);

  const formatPrice = (value) => {
    if (value === 0) return '$0.00';
    if (value < 0.000001) return `$${value.toFixed(12)}`;
    if (value < 0.01) return `$${value.toFixed(6)}`;
    if (value < 1) return `$${value.toFixed(4)}`;
    if (value < 100) return `$${value.toFixed(2)}`;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchChartData = async (range) => {
    try {
      // Only set loading if we don't have cached data
      const hasCached = typeof window !== 'undefined' && sessionStorage.getItem(`chart_${tokenId}_${range}`);
      if (!hasCached) {
        setLoading(true);
      }

      // 🚀 OPTIMIZATION: Check sessionStorage first for prefetched data
      if (typeof window !== 'undefined') {
        try {
          const cached = sessionStorage.getItem(`chart_${tokenId}_${range}`);
          if (cached) {
            try {
              const result = JSON.parse(cached);
              if (result.success && result.timestamp) {
                // Validate cache expiration
                const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes
                const cacheAge = Date.now() - new Date(result.timestamp).getTime();

                // Only use cache if it's less than 5 minutes old
                if (cacheAge < MAX_CACHE_AGE) {
                  const processedData = parseChartData(result);

                  setChartData(processedData);
                  setLoading(false);
                  return;
                }
              }
            } catch (e) {
              // Invalid cache, continue with fetch
            }
          }
        } catch (error) {
          // sessionStorage not accessible, continue with fetch
        }
      }

      // Fallback: Fetch from API
      const response = await fetch(`/api/chart/${tokenId}?timeRange=${range}`);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Parse data using our UTC utility (returns epoch milliseconds)
        const processedData = parseChartData(result);

        setChartData(processedData);
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(selectedRange);
  }, [tokenId, selectedRange]);

  if (loading) {
    return (
      <div className="bg-[var(--color-bg-secondary)]/60 rounded-xl p-6 h-64 flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading chart...</div>
      </div>
    );
  }

  if (error && (!chartData || chartData.length === 0)) {
    return (
      <div className="bg-[var(--color-bg-secondary)]/60 rounded-xl p-6 h-64 flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)] text-sm">Chart data not available</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-[var(--color-bg-secondary)]/60 rounded-xl p-6 h-64 flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)] text-sm">New token - chart data will appear as trading occurs</div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-secondary)]/60 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-light text-[var(--color-text)]">Price Chart (UTC)</h3>
        {showRangeSelector && (
          <div className="flex space-x-1 bg-[var(--color-border)] rounded-lg p-1">
            {['24h', '7d', '30d', '90d', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-3 py-1.5 text-xs rounded transition-all ${
                  selectedRange === range
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        )}
      </div>

      <ChartJSAdapter
        data={chartData}
        transactions={transactions}
        timeRange={selectedRange}
        height={300}
        showVolume={true}
      />
    </div>
  );
};

export default TokenChart;

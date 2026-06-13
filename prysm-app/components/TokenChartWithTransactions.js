/**
 * Enhanced TokenChart with Transaction Data
 * Shows transaction markers and volume on the price chart
 * Compatible with existing TokenChart
 */

'use client';

import React, { useState, useEffect } from 'react';
import ChartJSAdapter from './ChartJSAdapter';
import { parseChartData } from '@/lib/dateUtils';
import { useInfiniteTransactions } from '@/hooks/useInfiniteTransactions';

const TokenChartWithTransactions = ({ tokenId, timeRange = '24h' }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRange, setSelectedRange] = useState(timeRange);

  // Get transaction data for chart enhancement
  const { transactions, isLoading: txLoading } = useInfiniteTransactions(tokenId, {
    batchSize: 100,
    maxCached: 500,
    skip: !tokenId, // Skip if no tokenId
  });

  // Clean up old sessionStorage entries
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const CACHE_PREFIX = `chart_${tokenId}_`;
    const now = Date.now();
    const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

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
          sessionStorage.removeItem(key);
        }
      }
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
      setLoading(true);

      // Check sessionStorage for prefetched data
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(`chart_${tokenId}_${range}`);
        if (cached) {
          try {
            const result = JSON.parse(cached);
            if (result.success && result.timestamp) {
              const MAX_CACHE_AGE = 5 * 60 * 1000;
              const cacheAge = Date.now() - new Date(result.timestamp).getTime();

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
      }

      // Fetch from API
      const response = await fetch(`/api/chart/${tokenId}?timeRange=${range}`);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
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
      <div className="bg-[#1c1c19]/60 rounded-xl p-6 h-64 flex items-center justify-center">
        <div className="text-gray-400">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1c1c19]/60 rounded-xl p-6 h-64 flex items-center justify-center">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-[#1c1c19]/60 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-light text-[#f6fdff]">Price Chart (UTC)</h3>
          {transactions.length > 0 && !txLoading && (
            <p className="text-xs text-gray-500 mt-1">
              {transactions.length} transactions visible
            </p>
          )}
        </div>
        <div className="flex space-x-1 bg-[#2a2a27] rounded-lg p-1">
          {['24h', '7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1.5 text-xs rounded transition-all ${
                selectedRange === range
                  ? 'bg-[#f6fdff] text-[#161614]'
                  : 'text-gray-400 hover:text-[#f6fdff] hover:bg-[#2a2a27]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <ChartJSAdapter
        data={chartData}
        transactions={transactions}
        timeRange={selectedRange}
        height={300}
        showVolume={true}
      />

      {chartData.length > 0 && (
        <div className="mt-4 flex justify-between items-center text-sm text-gray-400">
          <div>
            Current: {formatPrice(chartData[chartData.length - 1]?.y || 0)}
          </div>
          {transactions.length > 0 && (
            <div className="flex gap-4">
              <span>
                Vol: ${transactions.reduce((sum, tx) => sum + (Number(tx.amountUSD) || 0), 0).toFixed(2)}
              </span>
              <span>
                Tx: {transactions.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenChartWithTransactions;

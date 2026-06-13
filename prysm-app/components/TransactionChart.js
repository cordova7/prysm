/**
 * Enhanced TokenChart with Transaction Markers
 * Steve Jobs UX: Beautiful, informative, like a professional trading terminal
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { useInfiniteTransactions } from '@/hooks/useInfiniteTransactions';

export default function TransactionChart({ tokenId, transactions }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const transactionMarkersRef = useRef([]);

  const [viewMode, setViewMode] = useState('price'); // 'price', 'volume', 'transactions'

  // Process transactions into markers for the chart
  const processTransactionMarkers = (transactions) => {
    if (!transactions || transactions.length === 0) return [];

    return transactions.map(tx => {
      const timestamp = Number(tx.timestamp) * 1000; // Convert to milliseconds
      const price = tx.token0Symbol === 'ICP' || tx.token1Symbol === 'ICP'
        ? tx.token0Price
        : (tx.token0Price + tx.token1Price) / 2;

      const isBuy = tx.action === 'Swap' && tx.amountToken1 > 0;
      const isSell = tx.action === 'Swap' && tx.amountToken0 > 0;

      return {
        time: Math.floor(timestamp / 1000), // Lightweight charts expects seconds
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#10B981' : '#EF4444', // Green for buy, red for sell
        shape: 'circle',
        size: Math.min(Math.max(Math.log10(Number(tx.amountUSD) + 1) * 3, 4), 12),
        text: `${tx.action} $${Number(tx.amountUSD).toFixed(2)}`,
      };
    });
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(55, 65, 81, 0.3)' },
        horzLines: { color: 'rgba(55, 65, 81, 0.3)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
      },
      timeScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
      },
    });

    chartRef.current = chart;

    // Create series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#3B82F6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Set data if provided
    if (transactions && transactions.length > 0) {
      const markers = processTransactionMarkers(transactions);
      candlestickSeries.setMarkers(markers);
      transactionMarkersRef.current = markers;
    }

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: 300,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update markers when transactions change
  useEffect(() => {
    if (candlestickSeriesRef.current && transactions) {
      const markers = processTransactionMarkers(transactions);
      candlestickSeriesRef.current.setMarkers(markers);
      transactionMarkersRef.current = markers;
    }
  }, [transactions]);

  return (
    <div className="bg-[var(--color-border)] rounded-lg p-4 border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Transaction History
        </h4>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('price')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              viewMode === 'price'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            Price
          </button>
          <button
            onClick={() => setViewMode('transactions')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              viewMode === 'transactions'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            Transactions
          </button>
        </div>
      </div>

      {/* Transaction Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[var(--color-text-secondary)]">Buy Orders</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[var(--color-text-secondary)]">Sell Orders</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-yellow-500" />
          <span className="text-[var(--color-text-secondary)]">Liquidity</span>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} style={{ height: '300px', width: '100%' }} />

      {/* Transaction Summary */}
      {transactions && transactions.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <div className="bg-[var(--color-border)] rounded p-2">
            <p className="text-[var(--color-text-muted)]">Total Transactions</p>
            <p className="text-[var(--color-text)] font-medium mt-1">{transactions.length}</p>
          </div>
          <div className="bg-[var(--color-border)] rounded p-2">
            <p className="text-[var(--color-text-muted)]">Total Volume</p>
            <p className="text-[var(--color-text)] font-medium mt-1">
              ${transactions.reduce((sum, tx) => sum + (Number(tx.amountUSD) || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-[var(--color-border)] rounded p-2">
            <p className="text-[var(--color-text-muted)]">Avg Trade Size</p>
            <p className="text-[var(--color-text)] font-medium mt-1">
              ${(transactions.reduce((sum, tx) => sum + (Number(tx.amountUSD) || 0), 0) / transactions.length).toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

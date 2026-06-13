'use client';

import { createChart, IChartApi, ISeriesApi, LineStyle, CrosshairMode } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

export default function AdvancedChart({
  tokenId,
  height = 500,
  theme = 'dark',
  showVolume = true,
  showIndicators = true,
}) {
  const chartContainerRef = useRef(null);
  const chart = useRef(null);
  const candleSeries = useRef(null);
  const volumeSeries = useRef(null);
  const maLineSeries = useRef(null);

  const [timeRange, setTimeRange] = useState('24h');
  const [chartData, setChartData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    // Only initialize chart on the client side
    if (typeof window === 'undefined') return;
    if (!chartContainerRef.current || !tokenId) return;

    // Create chart
    chart.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: theme === 'dark' ? '#000000' : '#ffffff' },
        textColor: theme === 'dark' ? '#9CA3AF' : '#374151',
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#374151' : '#e5e7eb', style: LineStyle.Dotted },
        horzLines: { color: theme === 'dark' ? '#374151' : '#e5e7eb', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#3B82F6',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#3B82F6',
        },
        horzLine: {
          color: '#3B82F6',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#3B82F6',
        },
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.3 : 0.1,
        },
      },
      timeScale: {
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    candleSeries.current = chart.current.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });

    // Create volume series if enabled
    if (showVolume) {
      volumeSeries.current = chart.current.addHistogramSeries({
        color: '#3B82F6',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
      });
    }

    // Create MA line if indicators enabled
    if (showIndicators) {
      maLineSeries.current = chart.current.addLineSeries({
        color: '#3B82F6',
        lineWidth: 2,
        title: 'MA20',
        priceLineVisible: false,
      });
    }

    // Mark chart as ready (after all series are created)
    setChartReady(true);

    // Handle resize
    const handleResize = () => {
      if (chart.current && chartContainerRef.current) {
        chart.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
      // Reset chart ready flag when cleaning up
      setChartReady(false);
    };
  }, [tokenId, height, theme, showVolume, showIndicators]);

  // Fetch and update chart data
  useEffect(() => {
    if (!chartReady) return; // Wait for chart to be ready

    const fetchChartData = async () => {
      if (!tokenId || !timeRange) return;

      setIsLoadingData(true);
      try {
        const response = await fetch(`/api/chart/${tokenId}?timeRange=${timeRange}`);
        const result = await response.json();

        if (result.success && result.data) {
          const processedData = result.data.map((item) => ({
            time: Math.floor(item.snapshotTime / 1000), // Convert to seconds
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
          }));

          // Sort data by time (ascending order - oldest first)
          processedData.sort((a, b) => a.time - b.time);

          // Remove duplicate timestamps (keep last occurrence)
          const uniqueData = [];
          const seen = new Set();
          for (let i = processedData.length - 1; i >= 0; i--) {
            const item = processedData[i];
            if (!seen.has(item.time)) {
              seen.add(item.time);
              uniqueData.unshift(item);
            }
          }

          setChartData(uniqueData);

          // Update series - now chart is guaranteed to be ready
          if (candleSeries.current) {
            candleSeries.current.setData(uniqueData);
          }

          if (volumeSeries.current) {
            const volumeData = uniqueData.map(item => ({
              time: item.time,
              value: item.volume,
              color: item.close >= item.open ? '#10b981' : '#ef4444',
            }));
            volumeSeries.current.setData(volumeData);
          }

          // Calculate and set MA20
          if (maLineSeries.current && showIndicators) {
            const ma20Data = calculateMA(uniqueData, 20);
            maLineSeries.current.setData(ma20Data);
          }
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchChartData();
  }, [tokenId, timeRange, showIndicators, chartReady]);

  // Calculate Moving Average
  const calculateMA = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      const avg = sum / period;
      result.push({
        time: data[i].time,
        value: avg,
      });
    }
    return result;
  };

  // Simple chart component without header/footer
  return (
    <div className="bg-[var(--color-border)] rounded-2xl overflow-hidden">
      {/* Chart Container */}
      <div className="relative" style={{ height }}>
        {isLoadingData && (
          <div className="absolute inset-0 bg-[var(--color-border)]/20 flex items-center justify-center z-10">
            <div className="bg-[var(--color-bg-card)] rounded-lg p-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
              <span className="text-[var(--color-text-secondary)]">Loading data...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

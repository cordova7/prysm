'use client';

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { format } from 'date-fns';
import { formatFullUTC, formatDateUTC } from '@/lib/dateUtils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

interface ChartDataPoint {
  x: number;
  y: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  timestamp?: number;
}

interface ChartJSAdapterProps {
  data: ChartDataPoint[];
  timeRange: string;
  height?: number;
  showVolume?: boolean;
  showAnimationMarker?: boolean;
  animationMarkerTime?: number;
  transactions?: any[]; // Transaction data for markers
  onHover?: (index: number) => void;
  onClick?: (index: number) => void;
}

const ChartJSAdapter: React.FC<ChartJSAdapterProps> = ({
  data,
  timeRange,
  height = 400,
  showVolume = false,
  showAnimationMarker = false,
  animationMarkerTime,
  transactions = [],
  onHover,
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Get time unit based on timeRange
    const getTimeUnit = (range: string) => {
      switch (range) {
        case '24h':
          return 'hour';
        case '7d':
          return 'day';
        case '30d':
          return 'day';
        case '90d':
          return 'week';
        case 'all':
          return 'month';
        default:
          return 'day';
      }
    };

    // Create chart
    chartRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Price',
            data: data,
            borderColor: 'rgb(246, 253, 255)',
            backgroundColor: 'rgba(246, 253, 255, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgb(246, 253, 255)',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
          ...(showVolume
            ? [
                {
                  type: 'bar' as const,
                  label: 'Volume',
                  data: data.map((d) => ({ x: d.x, y: d.volume || 0 })),
                  backgroundColor: 'rgba(156, 163, 175, 0.3)',
                  borderColor: 'rgba(156, 163, 175, 0.5)',
                  borderWidth: 1,
                  yAxisID: 'volume',
                  order: 2,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'rgb(156, 163, 175)',
              usePointStyle: true,
              padding: 20,
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: 'rgb(243, 244, 246)',
            bodyColor: 'rgb(209, 213, 219)',
            borderColor: 'rgb(246, 253, 255)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (tooltipItems) => {
                const timestamp = tooltipItems[0].parsed.x;
                return timestamp !== null ? formatFullUTC(timestamp) + ' (UTC)' : '';
              },
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (value === null || value === undefined) {
                  return `${label}: N/A`;
                }
                if (label === 'Price') {
                  return `${label}: $${value.toFixed(6)}`;
                } else if (label === 'Volume') {
                  return `${label}: ${value.toLocaleString()}`;
                }
                return `${label}: ${value}`;
              },
            },
          },
          title: {
            display: false,
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: getTimeUnit(timeRange),
              displayFormats: {
                hour: 'MMM dd HH:mm',
                day: 'MMM dd',
                week: 'MMM dd',
                month: 'MMM yyyy',
                year: 'yyyy',
              },
              tooltipFormat: 'MMMM dd, yyyy HH:mm:ss \'UTC\'',
            },
            grid: {
              color: 'rgba(75, 85, 99, 0.3)',
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              callback: function (value) {
                // Chart.js passes either a Date object or a timestamp
                // Convert to milliseconds if it's a Date object
                const timestamp = (value as any) instanceof Date ? (value as any).getTime() : Number(value);
                const date = new Date(timestamp);
                const unit = getTimeUnit(timeRange);
                if (unit === 'hour') {
                  return [format(date, 'MMM d'), format(date, 'HH:mm')];
                }
                if (unit === 'day' || unit === 'week') {
                  return format(date, 'MMM d');
                }
                return format(date, 'MMM yyyy');
              },
            },
            adapters: {
              date: {
                zone: 'utc', // Force UTC timezone
              },
            },
          },
          y: {
            beginAtZero: false,
            position: 'right',
            grid: {
              color: 'rgba(75, 85, 99, 0.3)',
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
              callback: function (value) {
                const numValue = Number(value);
                let decimals = 2;
                if (numValue < 0.000001) decimals = 12;
                else if (numValue < 0.001) decimals = 8;
                else if (numValue < 0.01) decimals = 6;
                else if (numValue < 1) decimals = 4;
                return '$' + numValue.toFixed(decimals);
              },
            },
          },
          ...(showVolume && {
            volume: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                color: 'rgb(156, 163, 175)',
                callback: function (value) {
                  return Number(value).toLocaleString();
                },
              },
            },
          }),
        },
        onHover: (event, elements) => {
          if (onHover && elements.length > 0) {
            onHover(elements[0].index);
          }
        },
        onClick: (event, elements) => {
          if (onClick && elements.length > 0) {
            onClick(elements[0].index);
          }
        },
      },
      plugins: [
        ...(showAnimationMarker && animationMarkerTime
          ? [
              {
                id: 'animationMarker',
                afterDatasetsDraw: (chart: any) => {
                  const { ctx, chartArea, scales } = chart;
                  if (!chartArea || !scales.x) return;

                  const x = scales.x.getPixelForValue(animationMarkerTime);
                  if (x < chartArea.left || x > chartArea.right) return;

                  ctx.save();
                  ctx.strokeStyle = 'rgb(239, 68, 68)'; // Red
                  ctx.lineWidth = 2;
                  ctx.setLineDash([5, 5]);
                  ctx.beginPath();
                  ctx.moveTo(x, chartArea.top);
                  ctx.lineTo(x, chartArea.bottom);
                  ctx.stroke();

                  // Draw label
                  ctx.fillStyle = 'rgb(239, 68, 68)';
                  ctx.font = '12px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillText('●', x, chartArea.top - 10);

                  ctx.restore();
                },
              },
            ]
          : []),
      ],
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, timeRange, showVolume, showAnimationMarker, animationMarkerTime, transactions]);

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <canvas
        ref={canvasRef}
        id="chart-canvas"
        data-testid="chart-canvas"
      />
    </div>
  );
};

export default ChartJSAdapter;

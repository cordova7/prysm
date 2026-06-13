'use client';

import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  name: string;
  value: number;
  timestamp: number;
}

export const usePerformanceMonitor = () => {
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  const measureWebVitals = () => {
    // Measure Largest Contentful Paint (LCP)
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;

      if (lastEntry) {
        metricsRef.current.push({
          name: 'LCP',
          value: lastEntry.startTime,
          timestamp: Date.now(),
        });
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // Measure First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        metricsRef.current.push({
          name: 'FID',
          value: entry.processingStart - entry.startTime,
          timestamp: Date.now(),
        });
      });
    });

    fidObserver.observe({ entryTypes: ['first-input'] });

    // Measure Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      metricsRef.current.push({
        name: 'CLS',
        value: clsValue,
        timestamp: Date.now(),
      });
    });

    // Only observe layout-shift if supported
    if (typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }

    return () => {
      observer.disconnect();
      fidObserver.disconnect();
      // Only disconnect if we actually observed
      if (typeof PerformanceObserver !== 'undefined' &&
          PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
        clsObserver.disconnect();
      }
    };
  };

  const measurePageLoad = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    const metrics = {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ssl: navigation.connectEnd - navigation.secureConnectionStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      load: navigation.loadEventEnd - navigation.startTime,
    };

    return metrics;
  };

  const measureApiResponse = async (url: string, callback?: (duration: number) => void) => {
    const start = performance.now();
    const response = await fetch(url);
    const end = performance.now();
    const duration = end - start;

    callback?.(duration);
    return response;
  };

  useEffect(() => {
    // Measure page load
    measurePageLoad();

    // Measure Web Vitals
    const cleanup = measureWebVitals();

    return cleanup;
  }, []);

  const getMetrics = () => metricsRef.current;

  return {
    measureWebVitals,
    measurePageLoad,
    measureApiResponse,
    getMetrics,
  };
};

// Component for displaying performance metrics in development
export const PerformanceMonitor = () => {
  const { getMetrics } = usePerformanceMonitor();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Log metrics less frequently to reduce spam - every 2 minutes instead of 10 seconds
      const interval = setInterval(() => {
        const metrics = getMetrics();
        if (metrics.length > 0) {
          console.group('🔍 Performance Metrics');
          metrics.forEach((metric) => {
            console.log(`${metric.name}: ${metric.value.toFixed(2)}ms`);
          });
          console.groupEnd();
        }
      }, 120000); // Changed from 10000 (10s) to 120000 (2 minutes)

      return () => clearInterval(interval);
    }
  }, [getMetrics]);

  return null;
};

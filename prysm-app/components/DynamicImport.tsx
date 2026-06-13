'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
import React from 'react';

// Generic dynamic import wrapper with loading state
export const withDynamicImport = (
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  loadingComponent?: ComponentType,
  ssr: boolean = false
) => {
  const DynamicComponent = dynamic(importFunc, {
    loading: () => loadingComponent ? React.createElement(loadingComponent) : <LoadingSkeleton />,
    ssr,
  });

  return DynamicComponent;
};

// Specific dynamic components
export const DynamicAdvancedChart = dynamic(
  () => import('@/components/AdvancedChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicVirtualizedTokenList = dynamic(
  () => import('@/components/VirtualizedTokenList'),
  {
    loading: () => <TokenListSkeleton />,
    ssr: true,
  }
);

// Loading skeletons
const LoadingSkeleton = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f6fdff] mb-4"></div>
      <p className="text-gray-400 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-[#f6fdff]/80 bg-[#1c1c19]/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden">
    <div className="p-4 border-b border-gray-200 dark:border-[#2a2a27]">
      <div className="h-8 bg-gray-200 bg-[#2a2a27] rounded w-48 mb-4 animate-pulse"></div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-16 bg-gray-200 bg-[#2a2a27] rounded animate-pulse"></div>
        ))}
      </div>
    </div>
    <div className="h-[500px] bg-gray-100 bg-[#1c1c19]/60 animate-pulse"></div>
  </div>
);

const TokenListSkeleton = () => (
  <div className="bg-[#f6fdff]/80 bg-[#1c1c19]/80 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200/50 dark:border-[#2a2a27]/50 overflow-hidden">
    <div className="p-6 border-b border-gray-200 dark:border-[#2a2a27]">
      <div className="h-8 bg-gray-200 bg-[#2a2a27] rounded w-64 mb-2 animate-pulse"></div>
      <div className="h-4 bg-gray-200 bg-[#2a2a27] rounded w-48 animate-pulse"></div>
    </div>
    <div className="p-6 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 bg-gray-100 bg-[#1c1c19]/60 rounded-xl animate-pulse"></div>
      ))}
    </div>
  </div>
);

export default LoadingSkeleton;

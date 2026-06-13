/**
 * Position List Component
 * Displays all liquidity positions for a given pool
 */
'use client';

import { useEffect, useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { PositionCard } from './PositionCard';
import type { UserPositionInfo } from '@/lib/wallet/actors/icpswap-pool.idl';

interface PositionListProps {
  poolId: string;
  onRefresh?: () => void;
}

export function PositionList({ poolId, onRefresh }: PositionListProps) {
  const { getUserPositions, isLoading, error } = usePositions();
  const [positions, setPositions] = useState<UserPositionInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPositions = async () => {
    try {
      setIsRefreshing(true);
      const data = await getUserPositions(poolId, 0, 100);
      setPositions(data);
    } catch (err) {
      console.error('Failed to load positions:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPositions();
  }, [poolId]);

  const handleRefresh = () => {
    loadPositions();
    onRefresh?.();
  };

  if (isLoading || isRefreshing) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">Loading positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Error loading positions</p>
        <p className="text-sm mt-1">{error.message}</p>
        <button
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No positions</h3>
        <p className="mt-1 text-sm text-gray-500">You don't have any liquidity positions in this pool yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Your Positions ({positions.length})
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-4">
        {positions.map((position) => (
          <PositionCard
            key={position.id.toString()}
            poolId={poolId}
            position={position}
            onUpdate={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}

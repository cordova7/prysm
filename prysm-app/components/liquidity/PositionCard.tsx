/**
 * Position Card Component
 * Displays individual liquidity position details
 */
'use client';

import { useState, useEffect } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { ClaimFeesButton } from './ClaimFeesButton';
import type { UserPositionInfo, UserPositionWithTokenAmount } from '@/lib/wallet/actors/icpswap-pool.idl';

interface PositionCardProps {
  poolId: string;
  position: UserPositionInfo;
  onUpdate?: () => void;
}

// Format bigint to human-readable string
const formatAmount = (amount: bigint, decimals: number = 8, maxDecimals: number = 6): string => {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = amount % base;

  if (frac === 0n) {
    return whole.toString();
  }

  const fracStr = frac.toString().padStart(decimals, '0');
  const trimmed = fracStr.replace(/0+$/, '');
  const shown = trimmed.slice(0, Math.min(maxDecimals, trimmed.length));

  return `${whole.toString()}.${shown}`;
};

// Calculate price from tick (simplified)
const tickToPrice = (tick: bigint): string => {
  // This is a simplified calculation - actual tick-to-price conversion is more complex
  // Price = 1.0001^tick
  const tickNum = Number(tick);
  const price = Math.pow(1.0001, tickNum);
  return price.toFixed(6);
};

export function PositionCard({ poolId, position, onUpdate }: PositionCardProps) {
  const { getUserPositionWithTokenAmount, refreshIncome } = usePositions();
  const [positionDetails, setPositionDetails] = useState<UserPositionWithTokenAmount | null>(null);
  const [fees, setFees] = useState<{ tokensOwed0: bigint; tokensOwed1: bigint }>({
    tokensOwed0: position.tokensOwed0,
    tokensOwed1: position.tokensOwed1,
  });
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isRefreshingFees, setIsRefreshingFees] = useState(false);

  // Load full position details with token amounts
  useEffect(() => {
    const loadDetails = async () => {
      try {
        setIsLoadingDetails(true);
        const details = await getUserPositionWithTokenAmount(poolId, position.id);
        setPositionDetails(details);
      } catch (err) {
        console.error('Failed to load position details:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    loadDetails();
  }, [poolId, position.id, getUserPositionWithTokenAmount]);

  // Refresh fee amounts
  const handleRefreshFees = async () => {
    try {
      setIsRefreshingFees(true);
      const result = await refreshIncome(poolId, position.id);
      setFees({
        tokensOwed0: result.tokensOwed0,
        tokensOwed1: result.tokensOwed1,
      });
    } catch (err) {
      console.error('Failed to refresh fees:', err);
    } finally {
      setIsRefreshingFees(false);
    }
  };

  const handleClaimSuccess = () => {
    setFees({ tokensOwed0: 0n, tokensOwed1: 0n });
    onUpdate?.();
  };

  const hasUnclaimedFees = fees.tokensOwed0 > 0n || fees.tokensOwed1 > 0n;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Position #{position.id.toString()}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Price Range: {tickToPrice(position.tickLower)} - {tickToPrice(position.tickUpper)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshFees}
            disabled={isRefreshingFees}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh fees"
          >
            <svg
              className={`w-5 h-5 ${isRefreshingFees ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Liquidity */}
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
          <span className="text-sm font-medium text-gray-700">Liquidity</span>
          <span className="text-sm text-gray-900">{formatAmount(position.liquidity, 18, 4)}</span>
        </div>

        {/* Token Amounts */}
        {isLoadingDetails ? (
          <div className="text-center py-2 text-sm text-gray-500">Loading token amounts...</div>
        ) : positionDetails ? (
          <>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm font-medium text-gray-700">Token 0 Amount</span>
              <span className="text-sm text-gray-900">{formatAmount(positionDetails.token0Amount, 8)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm font-medium text-gray-700">Token 1 Amount</span>
              <span className="text-sm text-gray-900">{formatAmount(positionDetails.token1Amount, 8)}</span>
            </div>
          </>
        ) : null}

        {/* Unclaimed Fees */}
        <div className={`p-3 rounded ${hasUnclaimedFees ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Unclaimed Fees</span>
            {hasUnclaimedFees && (
              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Available</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Token 0:</span>
              <span className="font-medium">{formatAmount(fees.tokensOwed0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Token 1:</span>
              <span className="font-medium">{formatAmount(fees.tokensOwed1, 8)}</span>
            </div>
          </div>
        </div>

        {/* Claim Button */}
        {hasUnclaimedFees && (
          <ClaimFeesButton
            poolId={poolId}
            positionId={position.id}
            onSuccess={handleClaimSuccess}
          />
        )}
      </div>
    </div>
  );
}

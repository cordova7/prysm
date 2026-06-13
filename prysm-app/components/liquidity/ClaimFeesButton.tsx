/**
 * Claim Fees Button Component
 * Allows users to claim accumulated fees from their liquidity positions
 */
'use client';

import { useState } from 'react';
import { usePoolActions } from '@/hooks/usePoolActions';

interface ClaimFeesButtonProps {
  poolId: string;
  positionId: bigint;
  onSuccess?: () => void;
}

export function ClaimFeesButton({ poolId, positionId, onSuccess }: ClaimFeesButtonProps) {
  const { claimPosition, isWorking, error } = usePoolActions();
  const [isClaiming, setIsClaiming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [claimedAmounts, setClaimedAmounts] = useState<{ amount0: bigint; amount1: bigint } | null>(null);

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      setShowSuccess(false);

      const result = await claimPosition({ poolId, positionId });

      setClaimedAmounts(result);
      setShowSuccess(true);

      // Call onSuccess callback
      onSuccess?.();

      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Failed to claim fees:', err);
    } finally {
      setIsClaiming(false);
    }
  };

  const formatAmount = (amount: bigint, decimals: number = 8): string => {
    const base = 10n ** BigInt(decimals);
    const whole = amount / base;
    const frac = amount % base;

    if (frac === 0n) {
      return whole.toString();
    }

    const fracStr = frac.toString().padStart(decimals, '0');
    const trimmed = fracStr.replace(/0+$/, '');

    return `${whole.toString()}.${trimmed}`;
  };

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={isClaiming || isWorking}
        className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isClaiming || isWorking ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
            <span>Claiming Fees...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Claim Fees</span>
          </>
        )}
      </button>

      {/* Success Message */}
      {showSuccess && claimedAmounts && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Fees claimed successfully!</p>
              <div className="mt-1 text-xs text-green-700">
                <p>Token 0: {formatAmount(claimedAmounts.amount0)}</p>
                <p>Token 1: {formatAmount(claimedAmounts.amount1)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Failed to claim fees</p>
              <p className="text-xs text-red-700 mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

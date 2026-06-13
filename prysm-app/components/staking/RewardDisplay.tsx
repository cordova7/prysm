/**
 * Reward display component
 * Shows pending rewards with claim button
 */
'use client';

import { type UserStakingStats } from '@/lib/wallet/actors';

interface RewardDisplayProps {
  stats: UserStakingStats | null;
  isLoading: boolean;
  onClaim: () => Promise<void>;
  isClaiming: boolean;
  className?: string;
}

export function RewardDisplay({
  stats,
  isLoading,
  onClaim,
  isClaiming,
  className = '',
}: RewardDisplayProps) {
  // Format bigint to readable number (assuming 8 decimals for PRY)
  const formatAmount = (amount: bigint, decimals: number = 8): string => {
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

    // Trim trailing zeros
    const trimmed = fractionalStr.replace(/0+$/, '');
    if (trimmed === '') {
      return wholePart.toString();
    }

    return `${wholePart}.${trimmed}`;
  };

  if (isLoading) {
    return (
      <div className={`bg-[#1c1c19] border border-[#2a2a27] rounded-xl p-4 ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[#232320] rounded w-1/3"></div>
          <div className="h-8 bg-[#232320] rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const pendingRewards = stats.pending_rewards;
  const lifetimeRewards = stats.lifetime_rewards;
  const hasPendingRewards = pendingRewards > 0n;

  return (
    <div className={`bg-[#1c1c19] border border-[#2a2a27] rounded-xl p-4 ${className}`}>
      {/* Pending Rewards */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Pending Rewards
          </p>
          <p className="text-3xl font-bold text-[#f6fdff]">
            {formatAmount(pendingRewards)}
          </p>
          <p className="text-sm text-gray-400 mt-1">PRY</p>
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Lifetime Earned
            </p>
            <p className="text-sm font-medium text-[#f6fdff]">
              {formatAmount(lifetimeRewards)} PRY
            </p>
          </div>

          {hasPendingRewards && (
            <button
              onClick={onClaim}
              disabled={isClaiming}
              className="bg-[#f6fdff] hover:bg-[#e7eef0] disabled:bg-[#2a2a27] disabled:text-gray-500 text-[#161614] font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {isClaiming ? 'Claiming...' : 'Claim'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Verified badge component
 * Shows verification badges for PRY holdings, stake, and earned fees
 */
'use client';

interface VerifiedBadgeProps {
  pryBalance: string;
  stakeAmount: string;
  feesEarned: string;
  className?: string;
}

export function VerifiedBadge({
  pryBalance,
  stakeAmount,
  feesEarned,
  className = '',
}: VerifiedBadgeProps) {
  // Format bigint string to readable number
  const formatAmount = (amountStr: string): string => {
    try {
      const amount = BigInt(amountStr);
      if (amount === 0n) return '0';

      const divisor = BigInt(100000000); // 8 decimals
      const wholePart = amount / divisor;
      const fractionalPart = amount % divisor;

      if (fractionalPart === 0n) {
        return wholePart.toString();
      }

      const fractionalStr = fractionalPart.toString().padStart(8, '0');
      const trimmed = fractionalStr.replace(/0+$/, '');
      return `${wholePart}.${trimmed}`;
    } catch {
      return '0';
    }
  };

  const hasPRY = BigInt(pryBalance || '0') > 0n;
  const hasStake = BigInt(stakeAmount || '0') > 0n;
  const hasEarnings = BigInt(feesEarned || '0') > 0n;

  if (!hasPRY && !hasStake && !hasEarnings) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* PRY Holder Badge */}
      {hasPRY && (
        <div
          className="flex items-center gap-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full px-2 py-0.5"
          title={`Holds ${formatAmount(pryBalance)} PRY`}
        >
          <svg className="w-3 h-3 text-[var(--color-text-secondary)]" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
            {formatAmount(pryBalance)} PRY
          </span>
        </div>
      )}

      {/* Staker Badge */}
      {hasStake && (
        <div
          className="flex items-center gap-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full px-2 py-0.5"
          title={`Staked ${formatAmount(stakeAmount)} PRY`}
        >
          <svg className="w-3 h-3 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
            Staked {formatAmount(stakeAmount)}
          </span>
        </div>
      )}

      {/* Earnings Badge */}
      {hasEarnings && (
        <div
          className="flex items-center gap-1 bg-green-900/30 border border-green-500/50 rounded-full px-2 py-0.5"
          title={`Earned ${formatAmount(feesEarned)} PRY in fees`}
        >
          <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] font-medium text-green-300">
            Earned {formatAmount(feesEarned)}
          </span>
        </div>
      )}
    </div>
  );
}

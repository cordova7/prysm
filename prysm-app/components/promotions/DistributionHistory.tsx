'use client';

import { motion } from 'framer-motion';
import { usePromoDistributions } from '@/hooks/usePromoDistributions';
import { formatDistanceToNow } from 'date-fns';

interface DistributionHistoryProps {
  className?: string;
}

export function DistributionHistory({ className = '' }: DistributionHistoryProps) {
  const {
    distributions,
    isLoadingDistributions,
    myDistributions,
    myTotalRewards,
    nextDistributionTime,
    loadMoreDistributions,
  } = usePromoDistributions();

  const formatPRY = (amount: bigint) => {
    const pry = Number(amount) / 1e8; // Assuming 8 decimals
    return pry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatICP = (amount: bigint) => {
    const icp = Number(amount) / 1e8;
    return icp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTimestamp = (nanos: bigint) => {
    const ms = Number(nanos / 1_000_000n);
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  };

  const getTimeUntilDistribution = () => {
    if (!nextDistributionTime) return null;

    const now = BigInt(Date.now()) * 1_000_000n; // Convert to nanoseconds
    const timeLeft = nextDistributionTime - now;

    if (timeLeft <= 0n) return 'Distribution pending...';

    const seconds = Number(timeLeft / 1_000_000_000n);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with User Stats */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Rewards */}
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">Your Total Promo Rewards</p>
            <p className="text-2xl font-bold text-[var(--color-text)]">
              {myTotalRewards !== null ? `${formatPRY(myTotalRewards)} PRY` : '--'}
            </p>
          </div>

          {/* Distributions Received */}
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">Distributions Received</p>
            <p className="text-2xl font-bold text-[var(--color-text)]">
              {myDistributions.length}
            </p>
          </div>

          {/* Next Distribution */}
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">Next Distribution In</p>
            <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
              {getTimeUntilDistribution() || '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Distribution History */}
      <div className="bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)] rounded-xl p-6">
        <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">Distribution History</h3>

        {isLoadingDistributions && distributions.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[var(--color-surface-tile-3)] rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-[var(--color-border)] rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-[var(--color-border)] rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : distributions.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">
            No distributions yet. The first distribution will occur after traders accumulate 24 hours of activity.
          </div>
        ) : (
          <div className="space-y-3">
            {distributions.map((dist, index) => {
              const myShare = myDistributions.find(
                d => d.distribution_id === dist.id
              );

              return (
                <motion.div
                  key={dist.id.toString()}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-[var(--color-surface-tile-3)] rounded-lg p-4 border ${
                    myShare ? 'border-[var(--color-border)]' : 'border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Distribution #{dist.id.toString()}
                      </span>
                      {myShare && (
                        <span className="text-xs bg-[var(--color-primary)] text-[var(--color-on-primary)] px-2 py-0.5 rounded-full">
                          You received: {formatPRY(myShare.share_amount)} PRY
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatTimestamp(dist.timestamp)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--color-text-secondary)]">Total Distributed:</span>
                      <span className="ml-2 text-[var(--color-text)] font-medium">
                        {formatPRY(dist.total_amount)} PRY
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)]">Total ICP Fees:</span>
                      <span className="ml-2 text-[var(--color-text)] font-medium">
                        {formatICP(dist.total_volume)} ICP
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)]">Recipients:</span>
                      <span className="ml-2 text-[var(--color-text)] font-medium">
                        {dist.recipient_count.toString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Load More Button */}
            <button
              onClick={loadMoreDistributions}
              disabled={isLoadingDistributions}
              className="w-full py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoadingDistributions ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

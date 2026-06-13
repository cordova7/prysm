'use client';

import { useEffect, useState } from 'react';
import { usePromoDistributions } from '@/hooks/usePromoDistributions';

interface DistributionCountdownProps {
  className?: string;
}

export function DistributionCountdown({ className = '' }: DistributionCountdownProps) {
  const { nextDistributionTime, periodStats } = usePromoDistributions();
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');

  useEffect(() => {
    if (!nextDistributionTime) return;

    const updateCountdown = () => {
      const now = BigInt(Date.now()) * 1_000_000n; // Convert to nanoseconds
      const remaining = nextDistributionTime - now;

      if (remaining <= 0n) {
        setTimeLeft('Distribution pending...');
        return;
      }

      const seconds = Number(remaining / 1_000_000_000n);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextDistributionTime]);

  const formatIcp = (amount: bigint) => {
    const icp = Number(amount) / 1e8;
    return icp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateTotalVolume = () => {
    return periodStats.reduce((sum, stat) => sum + stat.volume, 0n);
  };

  const formatPercent = (value: bigint, total: bigint) => {
    if (total === 0n) return '0.00%';
    const percentTimes100 = (value * 10000n) / total;
    const whole = percentTimes100 / 100n;
    const frac = percentTimes100 % 100n;
    return `${whole.toString()}.${frac.toString().padStart(2, '0')}%`;
  };

  const formatPrincipal = (principal: string) => {
    if (principal.length <= 16) return principal;
    return `${principal.slice(0, 6)}...${principal.slice(-4)}`;
  };

  const activeTraders = periodStats.length;
  const totalVolume = calculateTotalVolume();
  const sortedTraders = [...periodStats].sort((a, b) => (a.volume < b.volume ? 1 : -1));
  const topTraders = sortedTraders.slice(0, 5);

  return (
    <div className={`bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--color-text)]">Next Distribution</h3>
      </div>

      {/* Countdown Timer */}
      <div className="mb-4">
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[var(--color-text-secondary)] mb-1">
            {timeLeft}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">until next distribution</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Volume */}
        <div className="bg-[var(--color-bg)]/50 rounded-lg p-3">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">Period ICP Fees</p>
          <p className="text-lg font-bold text-[var(--color-text)]">
            {formatIcp(totalVolume)} ICP
          </p>
        </div>

        {/* Active Traders */}
        <div className="bg-[var(--color-bg)]/50 rounded-lg p-3">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">Active Traders</p>
          <p className="text-lg font-bold text-[var(--color-text)]">
            {activeTraders}
          </p>
        </div>
      </div>

      {/* Info Text */}
      <div className="mt-4 text-xs text-[var(--color-text-secondary)] text-center">
        Distribution occurs automatically on the first swap after the period ends
      </div>

      {/* Active Traders (Current Period) */}
      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Active Traders (Current Period)</h4>
          <span className="text-xs text-[var(--color-text-muted)]">{activeTraders} total</span>
        </div>
        {topTraders.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No active traders yet.</p>
        ) : (
          <div className="space-y-2 text-xs text-[var(--color-text)]">
            {topTraders.map((stat) => {
              const principalText = stat.user.toString();
              return (
                <div key={principalText} className="flex items-center justify-between">
                  <span className="font-mono text-[var(--color-text-secondary)]">{formatPrincipal(principalText)}</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {formatIcp(stat.volume)} ICP • {formatPercent(stat.volume, totalVolume)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {activeTraders > topTraders.length && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
            Showing top {topTraders.length} by activity points.
          </p>
        )}
      </div>
    </div>
  );
}

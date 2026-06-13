'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import { DistributionHistory, DistributionCountdown } from '@/components/promotions';
import { useIsClient } from '@/hooks/useIsClient';

function PromotionsPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Countdown Skeleton */}
        <div className="bg-[var(--color-surface-tile-3)] rounded-xl p-4 animate-pulse">
          <div className="h-6 bg-[var(--color-border)] rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-[var(--color-border)] rounded w-full mb-4"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-[var(--color-border)] rounded"></div>
            <div className="h-20 bg-[var(--color-border)] rounded"></div>
          </div>
        </div>

        {/* History Skeleton */}
        <div className="bg-[var(--color-surface-tile-3)] rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-[var(--color-border)] rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-[var(--color-border)] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromotionsContent() {
  const { isHydrated } = useIsClient();

  if (!isHydrated) {
    return <PromotionsPageSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[var(--color-text)] mb-2">Promo Rewards</h2>
        <p className="text-[var(--color-text-secondary)]">
          Track distribution history and your $PRY rewards from the trader reward pool
        </p>
      </div>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 mb-8">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">How $PRY works</h3>
        <div className="space-y-2 text-sm text-[var(--color-text)]">
          <div>
            <span className="text-[var(--color-text-secondary)]">Bid for Exposure:</span> Projects bid with $PRY to
            secure promoted placement inside the PRYSM community. Promotion spend is redistributed
            to active PRYSM traders based on real trading activity.
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">Stake &amp; Earn:</span> Stake $PRY on tokens you back
            and receive a share of the 1% trading fee generated when that specific token is traded
            through PRYSM.
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">Real Feedback:</span> Comments show verified $PRY
            holdings and staking fees earned so signal stands out from noise.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Countdown Widget - Sidebar */}
        <div className="lg:col-span-1">
          <DistributionCountdown className="sticky top-4" />
        </div>

        {/* Distribution History - Main Content */}
        <div className="lg:col-span-2">
          <DistributionHistory />
        </div>
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <Header />
      <Suspense fallback={<PromotionsPageSkeleton />}>
        <PromotionsContent />
      </Suspense>
    </div>
  );
}

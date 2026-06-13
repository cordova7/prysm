'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FaXTwitter } from 'react-icons/fa6';
import { ConnectButton } from './wallet';
import { usePromoDistributions } from '@/hooks/usePromoDistributions';
import { usePromotions } from '@/hooks/usePromotions';
import FilterToggleButton from './FilterToggleButton';
import SearchToggleButton from './SearchToggleButton';
import { ThemeToggle } from './ThemeToggle';

function PromoSummary() {
  const { nextDistributionTime, periodStats } = usePromoDistributions();
  const { activePromoBid, promoPoolBalance } = usePromotions();
  const [timeLeft, setTimeLeft] = useState('--:--:--');
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!nextDistributionTime) {
      setTimeLeft('--:--:--');
      return;
    }

    const updateCountdown = () => {
      const now = BigInt(Date.now()) * 1_000_000n; // Convert to nanoseconds
      const remaining = nextDistributionTime - now;

      if (remaining <= 0n) {
        setTimeLeft('Pending');
        return;
      }

      const seconds = Number(remaining / 1_000_000_000n);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextDistributionTime]);

  const formatVolume = (volume) => {
    const amount = Number(volume) / 1e8;
    return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const formatPRY = (amount) => {
    const pry = Number(amount) / 1e8;
    if (pry >= 1000000) return `${(pry / 1000000).toFixed(1)}M`;
    if (pry >= 1000) return `${(pry / 1000).toFixed(1)}K`;
    return pry.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const promoTooltip =
    'Users bid with $PRY to secure promoted placement inside the PRYSM community. Promotion spend is redistributed to active PRYSM traders based on real trading activity. Stake $PRY on tokens you back and receive a share of the 1% trading fee generated when those tokens are traded through PRYSM.';

  const totalVolume = periodStats.reduce((sum, stat) => sum + stat.volume, 0n);
  const activeTraders = periodStats.length;

  return (
    <div className="hidden lg:flex items-center gap-2 text-[10px] text-secondary">
      <span className="px-2 py-0.5 rounded-full border border-default bg-secondary">
        Next: {timeLeft}
      </span>
      <span className="px-2 py-0.5 rounded-full border border-default bg-secondary">
        Vol: ${formatVolume(totalVolume)}
      </span>
      <span className="px-2 py-0.5 rounded-full border border-default bg-secondary">
        {activeTraders} traders
      </span>
      {activePromoBid && (
        <span className="px-2 py-0.5 rounded-full border border-default bg-secondary">
          Bid: {formatPRY(activePromoBid.bid_amount)} $PRY
        </span>
      )}
      {promoPoolBalance && (
        <span className="px-2 py-0.5 rounded-full border border-default bg-secondary">
          Pool: {formatPRY(promoPoolBalance)} $PRY
        </span>
      )}
      <span
        className="relative px-2 py-0.5 rounded-full border border-default bg-secondary cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={promoTooltip}
      >
        ?
        {showTooltip && (
          <div className="absolute top-full right-0 mt-2 w-80 p-3 bg-secondary border border-default rounded-lg text-xs text-secondary leading-relaxed shadow-xl z-[9999]">
            {promoTooltip}
          </div>
        )}
      </span>
    </div>
  );
}

export default function Header({
  showPromoSummary = false,
  showFilters,
  setShowFilters,
  activeFilter,
  showSearch,
  setShowSearch,
  hasSearchQuery = false,
}) {
  return (
    <header className="relative mb-3 sm:mb-4 mt-4 sm:mt-6 border-b border-default" role="banner" aria-label="Site header">
      {/* Jobs' Rule: Consistent gray-700 for all borders */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-thin text-[var(--color-text)] tracking-tight">
            <Link
              href="/"
              className="inline-flex items-center focus:outline-none rounded"
              aria-label="Home"
            >
              <Image
                src="/header-logo.png"
                alt="PRYSM"
                width={44}
                height={44}
                priority
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
              />
              <span className="ml-3">PRYSM</span>
            </Link>
          </h1>
          <p className="text-secondary text-xs sm:text-sm font-light tracking-wide mt-0.5 sm:mt-1 mb-2 sm:mb-3">
            Liquidity, made actionable.
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-wrap items-center gap-3 sm:gap-4 mr-0 sm:mr-4">
          <Link
            href="/portfolio"
            className="text-xs sm:text-sm text-secondary hover:text-[var(--color-text)] transition-colors"
          >
            Portfolio
          </Link>
          <Link
            href="/promotions"
            className="text-xs sm:text-sm text-secondary hover:text-[var(--color-text)] transition-colors"
          >
            Rewards
          </Link>
          {/* X (Twitter) Link */}
          <a
            href="https://x.com/PRYSM_ICP"
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:text-[var(--color-text)] transition-colors duration-200"
            aria-label="Follow PRYSM on X (Twitter)"
          >
            <FaXTwitter className="w-4 h-4" />
          </a>
          <ThemeToggle />
          {showPromoSummary && <PromoSummary />}
          {/* Mobile-only: Connect, Filter, Search buttons inline */}
          <div className="flex sm:hidden items-center gap-2 ml-auto">
            {showFilters !== undefined && setShowFilters && activeFilter && (
              <FilterToggleButton
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                activeFilter={activeFilter}
              />
            )}
            {showSearch !== undefined && setShowSearch && (
              <SearchToggleButton
                showSearch={showSearch}
                setShowSearch={setShowSearch}
                hasSearchQuery={hasSearchQuery}
              />
            )}
            <ConnectButton />
          </div>
        </nav>

        {/* Desktop-only: Wallet Connect, Search, and Filter Toggle */}
        <div className="hidden sm:flex flex-shrink-0 items-center gap-2">
          {showFilters !== undefined && setShowFilters && activeFilter && (
            <FilterToggleButton
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              activeFilter={activeFilter}
            />
          )}
          {showSearch !== undefined && setShowSearch && (
            <SearchToggleButton
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              hasSearchQuery={hasSearchQuery}
            />
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

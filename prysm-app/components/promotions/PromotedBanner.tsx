/**
 * Promoted token banner
 * Displays the winning promoted token at the top of the list
 */
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePromotions } from '@/hooks/usePromotions';
import { useTokenLogo } from '@/hooks/useTokenLogo';

interface PromotedBannerProps {
  onTokenClick: (tokenId: string) => void;
  tokens: any[]; // Full token list to find the promoted token
  className?: string;
}

export function PromotedBanner({ onTokenClick, tokens, className = '' }: PromotedBannerProps) {
  const { promotedTokenId, isLoadingPromoted, activePromoBid } = usePromotions();
  const [promotedToken, setPromotedToken] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const tokenLogoId = promotedToken?.tokenLedgerId || '';
  const { logo } = useTokenLogo(tokenLogoId);

  // Find the promoted token in the list
  useEffect(() => {
    if (promotedTokenId && tokens.length > 0) {
      const token = tokens.find(t => t.tokenLedgerId === promotedTokenId);
      setPromotedToken(token || null);
    } else {
      setPromotedToken(null);
    }
  }, [promotedTokenId, tokens]);

  useEffect(() => {
    if (!activePromoBid) {
      setTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      const now = BigInt(Date.now()) * 1_000_000n;
      const remaining = activePromoBid.expires_at - now;
      if (remaining <= 0n) {
        setTimeLeft('Expired');
        return;
      }

      const seconds = Number(remaining / 1_000_000_000n);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activePromoBid]);

  const formatAmount = (amount: bigint, decimals: number = 8): string => {
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmed = fractionalStr.replace(/0+$/, '');
    if (trimmed === '') {
      return wholePart.toString();
    }
    return `${wholePart}.${trimmed}`;
  };

  if (isLoadingPromoted) {
    return (
      <div className={`bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)] rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[var(--color-border)] rounded-xl animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-[var(--color-border)] rounded w-1/3 animate-pulse"></div>
            <div className="h-4 bg-[var(--color-border)] rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!promotedToken) {
    return null;
  }

  const formatPrice = (value: number) => {
    if (value === 0) return '0.00';
    if (value < 0.000001) return value.toFixed(12);
    if (value < 0.01) return value.toFixed(6);
    if (value < 1) return value.toFixed(4);
    if (value < 100) return value.toFixed(2);
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const priceChange = promotedToken.priceChange24h ?? 0;
  const price = promotedToken.price ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)] rounded-2xl p-6 cursor-pointer hover:border-[var(--color-border-hover)] transition-all ${className}`}
      onClick={() => onTokenClick(promotedToken.tokenLedgerId)}
    >
      {/* Featured Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-[var(--color-primary)] text-[var(--color-on-primary)] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          FEATURED
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Promoted Token
        </span>
      </div>

      {/* Token Info */}
      <div className="flex items-center justify-between">
        {/* Left: Token Identity */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="relative">
            {logo ? (
              <img
                src={logo}
                alt={promotedToken.symbol || 'Token'}
                className="w-16 h-16 rounded-xl object-cover shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 bg-[var(--color-surface-tile-3)] rounded-xl flex items-center justify-center text-[var(--color-text)] font-bold text-2xl shadow-lg">
                {promotedToken.symbol?.charAt(0) || 'T'}
              </div>
            )}
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl bg-[var(--color-surface-tile-3)] blur-xl -z-10"></div>
          </div>

          {/* Name & Symbol */}
          <div>
            <h3 className="text-2xl font-bold text-[var(--color-text)] mb-1">
              {promotedToken.symbol || 'TOKEN'}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {promotedToken.name || 'Token Name'}
            </p>
          </div>
        </div>

        {/* Right: Price Info */}
        <div className="text-right">
          <div className="text-3xl font-bold text-[var(--color-text)] mb-1">
            ${formatPrice(price)}
          </div>
          <div className={`text-sm font-medium ${
            priceChange >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Promotional Text */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--color-text-secondary)] text-center">
          <span>This token is currently leading.</span>
          {activePromoBid && (
            <>
              <span>Top bid: {formatAmount(activePromoBid.bid_amount)} PRY</span>
              {timeLeft && <span>Time left: {timeLeft}</span>}
            </>
          )}
          <span>Leader can be outbid anytime.</span>
        </div>
      </div>
    </motion.div>
  );
}

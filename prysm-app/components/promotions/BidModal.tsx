/**
 * Bid modal for promoting tokens
 */
'use client';

import { useEffect, useState } from 'react';
import { usePromotions } from '@/hooks/usePromotions';

interface Token {
  ledger_id?: string;
  tokenLedgerId?: string;
  name: string;
  symbol: string;
}

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: Token;
  onSuccess?: () => void;
}

// Fixed 24-hour promotion period (canister expects hours)
const PROMOTION_DURATION = 24n;

export function BidModal({ isOpen, onClose, token, onSuccess }: BidModalProps) {
  const {
    bidForExposure,
    isBidding,
    activePromoBid,
    promoPoolBalance,
    refundableBids,
    refundableTotal,
    claimRefunds,
    isClaiming,
  } = usePromotions();

  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const resolvedTokenId = token.tokenLedgerId || token.ledger_id || '';

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

  if (!isOpen) return null;

  const handleClaimRefunds = async () => {
    try {
      setError(null);
      await claimRefunds();
      setSuccessMessage('Refunds claimed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Claim refunds failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim refunds');
    }
  };

  const handleBid = async () => {
    if (!bidAmount || isNaN(parseFloat(bidAmount))) {
      setError('Please enter a valid bid amount');
      return;
    }

    try {
      setError(null);
      const amount = BigInt(Math.floor(parseFloat(bidAmount) * 100000000)); // 8 decimals
      await bidForExposure(resolvedTokenId, amount, PROMOTION_DURATION);

      setSuccessMessage('Bid submitted successfully!');
      setBidAmount('');

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Bid failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
    }
  };

  // Format bigint to readable number
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


  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
      <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 w-full max-w-md">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-[var(--color-text)] mb-2">Bid for Exposure</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Promote <span className="text-[var(--color-text-secondary)] font-medium">{token.symbol}</span> for 24 hours
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mt-2">
            Highest bid wins • Winner pays 100% • Losers get 50% refund
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">
            Bids compete across all tokens. Leader can be outbid anytime.
          </p>
        </div>

        {/* Current Leading Bid */}
        {activePromoBid && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Current Leading Bid</span>
              <span className="text-sm font-bold text-[var(--color-text-secondary)]">
                {formatAmount(activePromoBid.bid_amount)} PRY
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Time left: {timeLeft || '--:--:--'}
              {activePromoBid.token_id.toString() === resolvedTokenId ? ' • This token is leading' : ''}
            </p>
          </div>
        )}

        {/* Trader Reward Pool Info */}
        {promoPoolBalance !== null && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Current Trader Reward Pool</span>
              <span className="text-lg font-bold text-[var(--color-text-secondary)]">
                {formatAmount(promoPoolBalance)} PRY
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Pool distributed to active traders based on volume
            </p>
          </div>
        )}

        {/* Refundable Bids */}
        {refundableBids.length > 0 && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-green-300">50% Refunds Available</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {refundableBids.length} losing bid{refundableBids.length !== 1 ? 's' : ''} • Get 50% back, 50% went to traders
                </p>
                <p className="text-xs text-green-400 mt-1">
                  Unclaimed refunds: {formatAmount(refundableTotal)} PRY
                </p>
              </div>
              <button
                onClick={handleClaimRefunds}
                disabled={isClaiming}
                className="bg-green-600 hover:bg-green-700 disabled:bg-[var(--color-border)] text-[var(--color-text)] text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {isClaiming ? 'Claiming...' : 'Claim Refunds'}
              </button>
            </div>
            <div className="space-y-2">
              {refundableBids.map((bid) => {
                const refundAmount = bid.bid_amount / 2n;
                return (
                  <div key={bid.id.toString()} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)]">
                      Bid {formatAmount(bid.bid_amount)} PRY → Get {formatAmount(refundAmount)} back
                    </span>
                    <span className="text-green-400">
                      {bid.expires_at <= BigInt(Date.now() * 1_000_000) ? 'Expired' : 'Lost'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bid Amount */}
        <div className="mb-6">
          <label className="text-sm text-[var(--color-text-secondary)] mb-2 block">
            Bid Amount (PRY)
          </label>
          <input
            type="text"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-[var(--color-surface-tile-3)] text-[var(--color-text)] text-2xl px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--color-text)]"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Minimum recommended: 100 PRY
          </p>
        </div>

        {/* How it works */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">How Bidding Works</h4>
          <div className="space-y-2 text-xs text-[var(--color-text)]">
            <div className="flex gap-2">
              <span className="text-[var(--color-text-secondary)]">1.</span>
              <span>Submit your bid with $PRY tokens</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[var(--color-text-secondary)]">2.</span>
              <span>Highest bid wins; placement lasts until outbid or bid expires</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[var(--color-text-secondary)]">3.</span>
              <span><strong>Winner:</strong> 100% goes to trader reward pool</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[var(--color-text-secondary)]">4.</span>
              <span><strong>Losers:</strong> Get 50% refund, 50% to trader reward pool</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[var(--color-text-secondary)]">5.</span>
              <span>Trader reward pool distributed to active traders every 24h by volume</span>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-400 text-center">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleBid}
          disabled={!bidAmount || isBidding}
          className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)] text-[var(--color-on-primary)] font-bold py-4 rounded-lg transition-colors"
        >
          {isBidding ? 'Submitting Bid...' : 'Submit Bid'}
        </button>
      </div>
    </div>
  );
}

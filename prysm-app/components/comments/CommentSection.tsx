/**
 * Comment section component
 * Shows comments with verified badges and allows posting new comments
 */
'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useComments } from '@/hooks/useComments';
import { VerifiedBadge } from './VerifiedBadge';

interface Token {
  ledger_id?: string;
  tokenLedgerId?: string;
  name: string;
  symbol: string;
}

interface CommentSectionProps {
  token: Token;
  className?: string;
}

export function CommentSection({ token, className = '' }: CommentSectionProps) {
  const { isConnected } = useWallet();
  const [newComment, setNewComment] = useState('');
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(true);

  const tokenId = token.tokenLedgerId || token.ledger_id || '';

  const {
    comments,
    isLoading,
    isSubmitting,
    error,
    submitComment,
  } = useComments({
    tokenId,
    enabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    try {
      await submitComment(newComment);
      setNewComment('');
    } catch (err) {
      console.error('Failed to submit comment:', err);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Truncate principal for display
  const truncatePrincipal = (principal: string): string => {
    if (principal.length <= 16) return principal;
    return `${principal.slice(0, 8)}...${principal.slice(-4)}`;
  };

  const formatAmount = (amountStr: string): string => {
    try {
      const amount = BigInt(amountStr || '0');
      if (amount === 0n) return '0';

      const divisor = 100000000n;
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

  const minVerifiedBalance = 10n * 100000000n;
  const isVerifiedComment = (comment: { pry_balance_at_post?: string }) => {
    try {
      return BigInt(comment.pry_balance_at_post || '0') >= minVerifiedBalance;
    } catch {
      return false;
    }
  };

  const hasFees = (amountStr: string) => {
    try {
      return BigInt(amountStr || '0') > 0n;
    } catch {
      return false;
    }
  };

  const visibleComments = showVerifiedOnly ? comments.filter(isVerifiedComment) : comments;

  return (
    <div className={`bg-[var(--color-bg-secondary)] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-lg font-bold text-[var(--color-text)]">
          Comments ({visibleComments.length}{showVerifiedOnly ? `/${comments.length}` : ''})
        </h4>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showVerifiedOnly}
            onChange={(e) => setShowVerifiedOnly(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          Show only &gt;10 PRY verified
        </label>
      </div>

      {/* Comment Form */}
      {isConnected ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this token..."
            maxLength={1000}
            className="w-full bg-[var(--color-surface-tile-3)] text-[var(--color-text)] text-sm px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {newComment.length}/1000
            </span>
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)] text-[var(--color-on-primary)] font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-[var(--color-surface-tile-3)] rounded-lg p-4 mb-6">
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            Connect your wallet to post comments
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--color-surface-tile-3)]/60 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-[var(--color-border)] rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-[var(--color-border)] rounded w-full mb-2"></div>
              <div className="h-3 bg-[var(--color-border)] rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : visibleComments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-muted)] text-sm">
            {comments.length === 0
              ? 'No comments yet. Be the first to share your thoughts!'
              : 'No comments match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {visibleComments.map((comment) => (
            <div
              key={comment.id}
              className="bg-[var(--color-surface-tile-3)]/60 rounded-lg p-4 hover:bg-[var(--color-surface-tile-3)]/70 transition-colors"
            >
              {/* Author Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)] font-mono">
                    {truncatePrincipal(comment.author_principal)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatTime(comment.created_at)}
                  </p>
                  {hasFees(comment.fees_earned_at_post) && (
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      Earned {formatAmount(comment.fees_earned_at_post)} PRY in fees
                    </p>
                  )}
                </div>
              </div>

              {/* Verified Badges */}
              <VerifiedBadge
                pryBalance={comment.pry_balance_at_post}
                stakeAmount={comment.stake_amount_at_post}
                feesEarned={comment.fees_earned_at_post}
                className="mb-3"
              />

              {/* Comment Content */}
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

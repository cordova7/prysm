/**
 * Transaction List Modal - Shows detailed transaction history
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInfiniteTransactions } from '@/hooks/useInfiniteTransactions';
import { useTokenLogo } from '@/hooks/useTokenLogo';
import Portal from './Portal';

function ModalTokenLogo({ tokenId, symbol, size = 24 }) {
  const { logo } = useTokenLogo(tokenId);

  return (
    <div
      className="rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border-hover)] overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img src={logo} alt={symbol} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{symbol?.charAt(0) || '?'}</span>
      )}
    </div>
  );
}

function formatModalAmount(amount) {
  if (!amount || amount === 0) return '0';
  const absAmount = Math.abs(amount);
  if (absAmount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
  if (absAmount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
  if (absAmount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
  if (absAmount >= 1) return amount.toFixed(4);
  if (absAmount >= 0.0001) return amount.toFixed(6);
  return amount.toFixed(8);
}

export default function TransactionListModal({
  isOpen,
  onClose,
  token,
}) {
  const loadMoreRef = useRef(null);

  const {
    transactions,
    isLoading,
    hasMore,
    loadMore,
    loadedCount,
  } = useInfiniteTransactions(token?.tokenLedgerId, {
    batchSize: 50,
    skip: !isOpen,
  });

  useEffect(() => {
    if (!isOpen || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isOpen, hasMore, isLoading, loadMore]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(Number(timestamp) * 1000);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const getActionColor = (action) => {
    const colors = {
      'Swap': 'text-[var(--color-text-secondary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20',
      'Add Liquidity': 'text-green-400 bg-green-500/10 border-green-500/20',
      'Remove Liquidity': 'text-red-400 bg-red-400/10 border-red-400/20',
      'Increase Liquidity': 'text-green-400 bg-green-500/10 border-green-500/20',
      'Decrease Liquidity': 'text-red-400 bg-red-400/10 border-red-400/20',
      'Claim': 'text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] border-[var(--color-border)]',
    };
    return colors[action] || 'text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10 border-[var(--color-text-muted)]/20';
  };

  const formatAmount = (amount, decimals = 8) => {
    if (!amount) return '0';
    return Number(amount).toFixed(decimals);
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-modal flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
        <motion.div
          className="relative bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
            <div>
              <h3 className="text-xl font-light text-[var(--color-text)]">
                {token?.name || token?.symbol || 'Token'} Transactions
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {token?.tokenLedgerId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
                {isLoading && transactions.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-[var(--color-text-muted)]">Loading transactions...</p>
                    </div>
                  </div>
                ) : transactions.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {transactions.map((tx, idx) => {
                        const token0Change = tx.token0ChangeAmount || tx.amountToken0 || 0;
                        const token1Change = tx.token1ChangeAmount || tx.amountToken1 || 0;
                        const isSell0 = token0Change > token1Change;

                        const soldToken = isSell0 ? {
                          id: tx.token0Id,
                          symbol: tx.token0Symbol,
                          amount: Math.abs(token0Change)
                        } : {
                          id: tx.token1Id,
                          symbol: tx.token1Symbol,
                          amount: Math.abs(token1Change)
                        };

                        const boughtToken = isSell0 ? {
                          id: tx.token1Id,
                          symbol: tx.token1Symbol,
                          amount: Math.abs(token1Change)
                        } : {
                          id: tx.token0Id,
                          symbol: tx.token0Symbol,
                          amount: Math.abs(token0Change)
                        };

                        return (
                          <motion.div
                            key={idx}
                            className="bg-[var(--color-bg-secondary)] rounded-xl p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors border border-[var(--color-border)]"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.01, 0.5) }}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${getActionColor(tx.action)}`}>
                                  {tx.action}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {formatTimestamp(tx.timestamp)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium text-[var(--color-text)]">
                                  ${Number(tx.amountUSD || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 bg-[var(--color-bg)] rounded-lg p-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <ModalTokenLogo tokenId={soldToken.id} symbol={soldToken.symbol} size={32} />
                                <div className="min-w-0">
                                  <div className="text-sm text-red-400 font-mono truncate">
                                    -{formatModalAmount(soldToken.amount)}
                                  </div>
                                  <div className="text-xs text-[var(--color-text-muted)]">{soldToken.symbol}</div>
                                </div>
                              </div>

                              <div className="flex-shrink-0">
                                <svg className="w-6 h-6 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                              </div>

                              <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                                <div className="min-w-0 text-right">
                                  <div className="text-sm text-green-400 font-mono truncate">
                                    +{formatModalAmount(boughtToken.amount)}
                                  </div>
                                  <div className="text-xs text-[var(--color-text-muted)]">{boughtToken.symbol}</div>
                                </div>
                                <ModalTokenLogo tokenId={boughtToken.id} symbol={boughtToken.symbol} size={32} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                              <div className="flex items-center gap-4 text-[10px]">
                                <span className="text-[var(--color-text-muted)]">
                                  From: <span className="text-[var(--color-text-secondary)] font-mono">{formatAddress(tx.from)}</span>
                                </span>
                                {tx.poolId && (
                                  <span className="text-[var(--color-text-muted)]">
                                    Pool: <span className="text-[var(--color-text-secondary)] font-mono">{formatAddress(tx.poolId)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {hasMore && (
                      <div ref={loadMoreRef} className="py-8">
                        {isLoading && (
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <p className="text-[var(--color-text-muted)] text-sm">Loading more transactions...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!hasMore && transactions.length > 0 && (
                      <div className="py-8 text-center text-[var(--color-text-muted)] text-sm">
                        Showing latest {loadedCount} transactions
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <svg className="w-16 h-16 text-[var(--color-bg-tertiary)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h4 className="text-lg text-[var(--color-text)] mb-2">No Transactions Found</h4>
                    <p className="text-[var(--color-text-muted)] max-w-md">
                      This token doesn't have any transactions recorded on ICPSwap yet, or the transaction data isn't available.
                    </p>
                  </div>
                )}
          </div>
        </motion.div>
      </motion.div>
      </AnimatePresence>
    </Portal>
  );
}

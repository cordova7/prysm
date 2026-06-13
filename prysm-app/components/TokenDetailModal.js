/**
 * Token Detail Modal - Terminal Layout
 * Dense, scan-friendly token detail view for trading workflows.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { FiX, FiExternalLink, FiCopy } from 'react-icons/fi';
import { useIsClient } from '@/hooks/useIsClient';
import Portal from './Portal';

const DynamicTokenChart = dynamic(() => import('./TokenChart'), {
  ssr: false,
  loading: () => (
    <div className="bg-[var(--color-surface-tile-3)]/50 rounded-lg p-6 h-80 flex items-center justify-center">
      <div className="text-[var(--color-text-secondary)] font-light">Loading chart...</div>
    </div>
  )
});

const formatPrice = (value) => {
  if (value === 0) return '0.00';
  if (value < 0.000001) return value.toFixed(12);
  if (value < 0.01) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  if (value < 100) return value.toFixed(2);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (value) => {
  if (!value || value === 0) return '0';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const formatDateShort = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

export default function TokenDetailModal({ token, onClose }) {
  const [controllerName, setControllerName] = useState(null);
  const { isClient } = useIsClient();

  useEffect(() => {
    let isMounted = true;

    async function fetchControllerData() {
      try {
        if (token.controllers && token.controllers.length > 0) {
          const controllerId = token.controllers[0];
          const cacheKey = `controller-name-${controllerId}`;

          if (isClient && typeof window !== 'undefined' && window.localStorage) {
            try {
              const cachedName = window.localStorage.getItem(cacheKey);
              if (cachedName) {
                const { name, timestamp } = JSON.parse(cachedName);
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                  if (isMounted) {
                    setControllerName(name);
                    return;
                  }
                }
              }
            } catch (e) {
              console.warn('localStorage access failed, skipping cache');
            }
          }

          const response = await fetch(`/api/ic-api?path=canisters/${controllerId}`);
          if (response.ok) {
            const data = await response.json();
            if (isMounted) {
              const name = data.name || null;
              setControllerName(name);

              if (isClient && typeof window !== 'undefined' && window.localStorage && name) {
                try {
                  window.localStorage.setItem(cacheKey, JSON.stringify({
                    name,
                    timestamp: Date.now()
                  }));
                } catch (e) {
                  console.warn('Failed to cache controller name');
                }
              }
            }
          } else if (response.status === 429) {
            console.warn('Rate limited by IC API');
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch controller info:', error);
        }
      }
    }

    fetchControllerData();

    return () => {
      isMounted = false;
    };
  }, [token.controllers, isClient]);

  const [copiedId, setCopiedId] = useState(null);
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalSupply = token.totalSupply || token.total_supply;
  const fdvValue = token.marketCap || (token.price && totalSupply ? token.price * totalSupply : null);

  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <Portal>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-modal flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
          onClick={onClose}
        >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[var(--color-bg-secondary)] rounded-2xl w-full max-w-6xl max-h-[88vh] overflow-y-auto border border-[var(--color-border)]"
          onClick={(e) => e.stopPropagation()}
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div className="sticky top-0 bg-[var(--color-bg-secondary)]/95 backdrop-blur-sm border-b border-[var(--color-border)] px-6 py-4 z-10">
            <div className="flex items-center justify-end">
              <button
                onClick={onClose}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 pt-5 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
              <MetricCell
                label="Price"
                value={`$${formatPrice(token.price || 0)}`}
              />
              <MetricCell
                label="24h Change"
                value={`${Math.abs(priceChange).toFixed(2)}%`}
                tone={isPositive ? 'up' : 'down'}
              />
              <MetricCell
                label="24h Vol"
                value={`$${formatNumber(token.volume24h || token.volume_24h || 0)}`}
              />
              <MetricCell
                label="Liquidity"
                value={`$${formatNumber(token.liquidity || 0)}`}
              />
              <MetricCell
                label="Market Cap"
                value={token.marketCap ? `$${formatNumber(token.marketCap)}` : 'N/A'}
              />
              <MetricCell
                label="Tx 24h"
                value={formatNumber(token.txCount24h || 0)}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-5">
              <MetricCell
                label="Supply"
                value={totalSupply ? formatNumber(totalSupply) : 'N/A'}
              />
              <MetricCell
                label="FDV"
                value={fdvValue ? `$${formatNumber(fdvValue)}` : 'N/A'}
              />
              <MetricCell
                label="Pair"
                value={token.pair || 'N/A'}
              />
              <MetricCell
                label="DEX"
                value={token.dex || 'N/A'}
              />
              <MetricCell
                label="Controllers"
                value={token.controllers ? formatNumber(token.controllers.length) : '0'}
              />
              <MetricCell
                label="First Seen"
                value={formatDateShort(token.firstSeen || token.createdAt)}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
              <div className="space-y-4">
                <div className="bg-[var(--color-surface-tile-3)]/50 rounded-xl p-4 border border-[var(--color-border)]">
                  <DynamicTokenChart tokenId={token.tokenLedgerId || token.tokenId} />
                </div>
              </div>

              <div className="space-y-4">
                {token.controllers && token.controllers.length > 0 && (
                  <div className="bg-[var(--color-surface-tile-3)]/50 rounded-xl p-4 border border-[var(--color-border)]">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                      Controllers ({token.controllers.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {token.controllers.map((ctrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => copyToClipboard(ctrl, `ctrl-${idx}`)}
                          className="group w-full text-left bg-[var(--color-bg-secondary)]/60 hover:bg-[var(--color-bg-secondary)] rounded-lg p-2.5 border border-[var(--color-border)] hover:border-[var(--color-border)] transition-all"
                        >
                          <p className="text-xs font-mono text-[var(--color-text-secondary)] break-all">
                            {ctrl}
                          </p>
                          {controllerName && idx === 0 && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              {controllerName}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-[var(--color-text-muted)]">Copy</span>
                            {copiedId === `ctrl-${idx}` && (
                              <span className="text-[10px] text-green-400">Copied</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      </AnimatePresence>
    </Portal>
  );
}

function MetricCell({ label, value, tone }) {
  const toneClass = tone === 'up'
    ? 'text-green-400'
    : tone === 'down'
      ? 'text-red-400'
      : 'text-[var(--color-text)]';

  return (
    <div className="bg-[var(--color-surface-tile-3)]/50 rounded-lg px-3 py-2 border border-[var(--color-border)]">
      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-sm font-semibold font-mono ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

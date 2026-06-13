'use client';

/**
 * Wallet Selection Modal
 * Displays available wallets for user to connect
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useWalletAvailability } from '@/contexts/WalletContext';
import type { WalletType } from '@/lib/wallet/types';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletOption {
  id: WalletType;
  name: string;
  description: string;
}

const walletOptions: WalletOption[] = [
  {
    id: 'ii',
    name: 'Internet Identity',
    description: 'Secure passkey-based authentication',
  },
  {
    id: 'plug',
    name: 'Plug Wallet',
    description: 'Browser extension wallet',
  },
];

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, isConnecting, error } = useWallet();
  const availability = useWalletAvailability();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleConnect = async (walletType: WalletType) => {
    try {
      await connect(walletType);
      onClose();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--color-bg)]/85 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl w-full max-w-md shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                <h2 className="text-xl font-semibold text-[var(--color-text)]">Connect Wallet</h2>
                <button
                  onClick={onClose}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors p-1"
                  aria-label="Close"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Wallet Options */}
              <div className="p-6 space-y-3">
                {walletOptions.map((wallet) => {
                  const isAvailable = availability[wallet.id];
                  const isPlugUnavailable = wallet.id === 'plug' && !isAvailable;

                  return (
                    <button
                      key={wallet.id}
                      onClick={() => handleConnect(wallet.id)}
                      disabled={isConnecting || isPlugUnavailable}
                      className={`
                        w-full flex items-center gap-4 p-4 rounded-lg border transition-all
                        ${
                          isPlugUnavailable
                            ? 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 cursor-not-allowed opacity-50'
                            : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-card)]'
                        }
                        ${isConnecting ? 'opacity-50 cursor-wait' : ''}
                      `}
                    >
                      <img
                        className="absolute h-0 w-0 overflow-hidden opacity-0"
                        src="/plug-wallet-logo.png"
                        alt=""
                        decoding="async"
                        loading="eager"
                        aria-hidden
                      />
                      <img
                        className="absolute h-0 w-0 overflow-hidden opacity-0"
                        src="/ii-wallet-logo.png"
                        alt=""
                        decoding="async"
                        loading="eager"
                        aria-hidden
                      />
                      {wallet.id === 'plug' ? (
                        <video
                          className="w-12 h-12 object-contain"
                          src="/plug-wallet-logo.webm"
                          poster="/plug-wallet-logo.png"
                          preload="auto"
                          autoPlay
                          loop
                          muted
                          playsInline
                          onContextMenu={(event) => event.preventDefault()}
                          aria-hidden
                        />
                      ) : (
                        <video
                          className="w-12 h-12 object-contain"
                          src="/ii-wallet-logo.webm"
                          poster="/ii-wallet-logo.png"
                          preload="auto"
                          autoPlay
                          loop
                          muted
                          playsInline
                          onContextMenu={(event) => event.preventDefault()}
                          aria-hidden
                        />
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[var(--color-text)]">{wallet.name}</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          {isPlugUnavailable
                            ? 'Extension not installed'
                            : wallet.description}
                        </div>
                      </div>
                      {isConnecting && (
                        <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                      )}
                      {isPlugUnavailable && (
                        <a
                          href="https://plugwallet.ooo"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        >
                          Install
                        </a>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Error Message */}
              {error && (
                <div className="px-6 pb-6">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-6 pb-6">
                <p className="text-xs text-[var(--color-text-muted)] text-center">
                  By connecting, you agree to the terms of service
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WalletModal;

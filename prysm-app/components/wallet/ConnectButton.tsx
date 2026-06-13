'use client';

/**
 * Connect Wallet Button
 * Shows connection state and opens wallet modal
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@/contexts/WalletContext';
import { WalletModal } from './WalletModal';

type ConnectButtonProps = {
  size?: 'sm' | 'md';
};

export function ConnectButton({ size = 'md' }: ConnectButtonProps) {
  const { isConnected, isConnecting, truncatedPrincipal, disconnect, walletType } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const isSmall = size === 'sm';
  const buttonPadding = isSmall ? 'px-2.5 py-1' : 'px-4 py-2';
  const textSize = isSmall ? 'text-xs' : 'text-sm';
  const iconSize = isSmall ? 'w-5 h-5' : 'w-6 h-6';
  const arrowSize = isSmall ? 'w-3 h-3' : 'w-4 h-4';

  // Connected state - show address with dropdown
  if (isConnected && truncatedPrincipal) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-2 ${buttonPadding} bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-border-hover)] transition-colors`}
        >
          {/* Wallet icon */}
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
          {walletType === 'plug' ? (
            <video
              className={`${iconSize} object-contain`}
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
              className={`${iconSize} object-contain`}
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

          {/* Principal */}
          <span className={`${textSize} font-mono text-[var(--color-text)]`}>
            {truncatedPrincipal}
          </span>

          {/* Dropdown arrow */}
          <svg
            className={`${arrowSize} text-[var(--color-text-secondary)] transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 mt-2 w-48 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-xl z-50"
            >
              <div className="py-1">
                {/* Copy Principal */}
                <button
                  onClick={() => {
                    if (truncatedPrincipal) {
                      navigator.clipboard.writeText(truncatedPrincipal);
                    }
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy Address
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-[var(--color-border)]" />

                {/* Disconnect */}
                <button
                  onClick={() => {
                    disconnect();
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[var(--color-bg-card)] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Disconnect
                </button>
              </div>
            </motion.div>
          </>
        )}
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <button
        disabled
        className={`flex items-center gap-2 ${buttonPadding} bg-[var(--color-primary)]/50 text-[var(--color-on-primary)] rounded-lg cursor-wait`}
      >
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span className={textSize}>Connecting...</span>
      </button>
    );
  }

  // Disconnected state - show connect button
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 ${buttonPadding} bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded-lg transition-colors font-medium`}
      >
        <span className={textSize}>Connect</span>
      </button>

      <WalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default ConnectButton;

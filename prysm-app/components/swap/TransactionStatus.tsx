/**
 * Transaction status modal
 * Shows progress for approval and swap operations
 */
'use client';

interface TransactionStatusProps {
  isOpen: boolean;
  status: 'approving' | 'swapping' | 'success' | 'error';
  error?: string | null;
  txHash?: string | null;
  paidAmount?: string | null;
  paidSymbol?: string | null;
  receivedAmount?: string | null;
  receivedSymbol?: string | null;
  pendingRefunds?: Array<{ tokenId: string; amount: string; symbol: string }>;
  isRefunding?: boolean;
  onWithdrawRefund?: (tokenId: string) => void;
  onClose: () => void;
}

export function TransactionStatus({
  isOpen,
  status,
  error,
  txHash,
  paidAmount,
  paidSymbol,
  receivedAmount,
  receivedSymbol,
  pendingRefunds = [],
  isRefunding = false,
  onWithdrawRefund,
  onClose,
}: TransactionStatusProps) {
  if (!isOpen) return null;

  const getStatusContent = () => {
    switch (status) {
      case 'approving':
        return {
          icon: (
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--color-border)]"></div>
          ),
          title: 'Approving Tokens',
          description: 'Confirm the approval in your wallet so the router can move tokens',
          showClose: false,
        };

      case 'swapping':
        return {
          icon: (
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--color-border)]"></div>
          ),
          title: 'Executing Swap',
          description: 'Swapping via PRYSM Router and transferring to your wallet',
          showClose: false,
        };

      case 'success':
        return {
          icon: (
            <div className="flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full">
              <svg
                className="w-10 h-10 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ),
          title: 'Swap Successful!',
          description: 'Your tokens have been swapped successfully',
          showClose: true,
        };

      case 'error':
        return {
          icon: (
            <div className="flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full">
              <svg
                className="w-10 h-10 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          ),
          title: 'Transaction Failed',
          description: error || 'An error occurred during the transaction',
          showClose: true,
        };
    }
  };

  const content = getStatusContent();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-bg)]/75 backdrop-blur-sm"
        onClick={content.showClose ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        {content.showClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Content */}
        <div className="flex flex-col items-center text-center space-y-4">
          {content.icon}

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-[var(--color-text)]">{content.title}</h3>
            <p className="text-[var(--color-text-secondary)]">{content.description}</p>
          </div>

          {/* Transaction hash (if available) */}
          {txHash && status === 'success' && (
            <div className="mt-4 p-3 bg-[var(--color-surface-tile-3)] rounded-lg w-full">
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">Transaction ID</p>
              <p className="text-xs text-[var(--color-text)] font-mono break-all">
                {txHash}
              </p>
            </div>
          )}

          {/* Swap preview */}
          {(status === 'swapping' || status === 'success') && paidAmount && paidSymbol && (
            <div className="mt-4 p-3 bg-[var(--color-surface-tile-3)] rounded-lg w-full">
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                {status === 'swapping' ? 'You will pay' : 'You paid'}
              </p>
              <p className="text-lg text-[var(--color-text)] font-semibold">
                {paidAmount} {paidSymbol}
              </p>
            </div>
          )}

          {/* Swap output */}
          {(status === 'swapping' || status === 'success') && receivedAmount && receivedSymbol && (
            <div className="mt-4 p-3 bg-[var(--color-surface-tile-3)] rounded-lg w-full">
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                {status === 'swapping' ? 'Expected receive' : 'You received'}
              </p>
              <p className="text-lg text-[var(--color-text)] font-semibold">
                {receivedAmount} {receivedSymbol}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {status === 'error' && pendingRefunds.length > 0 && (
            <div className="mt-4 p-3 bg-[var(--color-surface-tile-3)] rounded-lg w-full space-y-2">
              <p className="text-xs text-[var(--color-text-secondary)]">Pending refunds detected</p>
              {pendingRefunds.map((refund) => (
                <div key={refund.tokenId} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">
                    {refund.amount} {refund.symbol}
                  </span>
                  <button
                    onClick={() => onWithdrawRefund?.(refund.tokenId)}
                    disabled={!onWithdrawRefund || isRefunding}
                    className="text-xs text-[var(--color-text)] hover:text-[var(--color-primary)] disabled:text-[var(--color-text-muted)]"
                  >
                    {isRefunding ? 'Withdrawing...' : 'Withdraw'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {content.showClose && (
            <button
              onClick={onClose}
              className="mt-6 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

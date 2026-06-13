'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTokenLogo } from '@/hooks/useTokenLogo';

interface Transaction {
  hash: string;
  action: string;
  timestamp: string;
  from: string;
  to: string;
  amountUSD: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Id: string;
  token1Id: string;
  amountToken0: number;
  amountToken1: number;
  token0ChangeAmount: number;
  token1ChangeAmount: number;
}

interface TooltipPosition {
  top: number;
  left: number;
}

interface PrincipalTransactionsTooltipProps {
  principalId: string;
  children: React.ReactNode;
}

// Token logo component with fallback
function TokenLogo({ tokenId, symbol, size = 16 }: { tokenId: string; symbol: string; size?: number }) {
  const { logo } = useTokenLogo(tokenId);

  return (
    <div
      className="rounded-full bg-[#232320] border border-[#2a2a27] overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img src={logo} alt={symbol} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[8px] font-mono text-gray-400">{symbol?.charAt(0) || '?'}</span>
      )}
    </div>
  );
}

// Format token amount concisely
function formatAmount(amount: number): string {
  if (!amount || amount === 0) return '0';
  if (Math.abs(amount) >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
  if (Math.abs(amount) >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
  if (Math.abs(amount) >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
  if (Math.abs(amount) >= 1) return amount.toFixed(2);
  if (Math.abs(amount) >= 0.0001) return amount.toFixed(4);
  return amount.toFixed(6);
}

// Transaction row component
function TransactionRow({ tx }: { tx: Transaction }) {
  const formatTimestamp = (timestamp: string) => {
    try {
      const ts = Number(timestamp);
      const date = new Date(ts > 1e12 ? ts / 1e6 : ts * 1000);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      return '--';
    }
  };

  const formatUSD = (amount: number) => {
    if (!amount || amount === 0) return '$0';
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  // Determine which token was sold and which was bought based on change amounts
  const token0Change = tx.token0ChangeAmount || tx.amountToken0 || 0;
  const token1Change = tx.token1ChangeAmount || tx.amountToken1 || 0;

  // For swaps: one will be negative (sold), one positive (bought)
  // If both positive, show as token0 -> token1
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

  const isSwap = tx.action === 'Swap';
  const isLiquidity = tx.action.includes('Liquidity');

  return (
    <div className="rounded-lg bg-[#1a1a17] border border-[#2a2a27]/60 p-2">
      {/* Header: Action type and time */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-[8px] font-medium uppercase px-1.5 py-0.5 rounded ${
            isSwap
              ? 'bg-blue-500/20 text-blue-400'
              : isLiquidity
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {tx.action}
        </span>
        <span className="text-[9px] text-gray-500">{formatTimestamp(tx.timestamp)}</span>
      </div>

      {/* Token exchange visualization */}
      <div className="flex items-center gap-2">
        {/* Sold token */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TokenLogo tokenId={soldToken.id} symbol={soldToken.symbol} size={18} />
          <div className="min-w-0">
            <div className="text-[10px] text-red-400 font-mono truncate">
              -{formatAmount(soldToken.amount)}
            </div>
            <div className="text-[8px] text-gray-500 truncate">{soldToken.symbol}</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 px-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        {/* Bought token */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="text-[10px] text-green-400 font-mono truncate">
              +{formatAmount(boughtToken.amount)}
            </div>
            <div className="text-[8px] text-gray-500 truncate">{boughtToken.symbol}</div>
          </div>
          <TokenLogo tokenId={boughtToken.id} symbol={boughtToken.symbol} size={18} />
        </div>
      </div>

      {/* USD value */}
      {tx.amountUSD > 0 && (
        <div className="mt-1.5 text-right">
          <span className="text-[9px] text-gray-400 font-mono">{formatUSD(tx.amountUSD)}</span>
        </div>
      )}
    </div>
  );
}

export function PrincipalTransactionsTooltip({
  principalId,
  children,
}: PrincipalTransactionsTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch transactions when hovered
  useEffect(() => {
    if (!isHovered || !principalId) return;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = `/api/user-transactions/${encodeURIComponent(principalId)}?limit=10`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();

        if (data.success) {
          setTransactions(data.transactions || []);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions');
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [isHovered, principalId]);

  // Update tooltip position
  useEffect(() => {
    if (!isHovered || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const tooltipWidth = 300;
      const tooltipHeight = 400;
      const padding = 8;

      let top = rect.bottom + padding;
      let left = rect.left;

      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      if (top + tooltipHeight > window.innerHeight) {
        top = rect.top - tooltipHeight - padding;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isHovered]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  const tooltip = isHovered && mounted && (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-[300px] bg-[#1c1c19] border border-[#2a2a27] rounded-xl shadow-2xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      }}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#2a2a27] bg-[#161614]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#f6fdff] uppercase tracking-wider">
            Recent Swaps
          </span>
          <span
            className="text-[9px] font-mono text-gray-500 truncate max-w-[140px]"
            title={principalId}
          >
            {principalId.slice(0, 8)}...{principalId.slice(-4)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 max-h-[360px] overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-[10px] text-gray-500">{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#232320] flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <p className="text-[10px] text-gray-500">No recent swaps found</p>
            <p className="text-[9px] text-gray-600 mt-1">Tokens may have been transferred directly</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, idx) => (
              <TransactionRow key={tx.hash || idx} tx={tx} />
            ))}
          </div>
        )}
      </div>

      {/* Footer with transaction count */}
      {transactions.length > 0 && (
        <div className="px-3 py-2 border-t border-[#2a2a27] bg-[#161614]">
          <p className="text-[9px] text-gray-500 text-center">
            Showing {transactions.length} recent transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cursor-pointer"
      >
        {children}
      </div>
      {mounted && typeof document !== 'undefined' && createPortal(tooltip, document.body)}
    </>
  );
}

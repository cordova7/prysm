/**
 * Quote preview with price impact display
 */
'use client';

import { type QuoteResult } from '@/lib/wallet/actors';

interface QuotePreviewProps {
  quote: QuoteResult | null;
  icpswapQuote?: bigint | null;
  comparison?: { diff: bigint; diffBps: bigint | null } | null;
  isLoading: boolean;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountIn: bigint;
  tokenInDecimals?: number;
  tokenOutDecimals?: number;
  className?: string;
}

export function QuotePreview({
  quote,
  icpswapQuote = null,
  comparison = null,
  isLoading,
  tokenInSymbol,
  tokenOutSymbol,
  amountIn,
  tokenInDecimals = 8,
  tokenOutDecimals = 8,
  className = '',
}: QuotePreviewProps) {
  if (isLoading) {
    return (
      <div className={`bg-[var(--color-surface-tile-3)] rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-border)]"></div>
          <span className="ml-3 text-[var(--color-text-secondary)]">Fetching quote...</span>
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const amountOut = quote.amount_out;
  const priceImpact = quote.price_impact.length > 0 ? quote.price_impact[0] : null;

  // Format bigints to readable numbers
  const formatAmount = (amount: bigint, decimals: number): string => {
    const divisor = 10n ** BigInt(decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmed = fractionalStr.replace(/0+$/, '');
    if (!trimmed) return wholePart.toString();
    return `${wholePart}.${trimmed.slice(0, 6)}`;
  };

  // Calculate effective price
  const amountInFloat = Number(amountIn) / 10 ** tokenInDecimals;
  const amountOutFloat = Number(amountOut) / 10 ** tokenOutDecimals;
  const price = amountInFloat > 0 ? amountOutFloat / amountInFloat : 0;
  const priceStr = Number.isFinite(price) ? price.toFixed(6) : '0';

  // Get price impact color
  const getPriceImpactColor = (impact: number | null | undefined) => {
    if (impact === null || impact === undefined) return 'text-gray-400';
    if (impact < 1) return 'text-green-400';
    if (impact < 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  const priceImpactColor = getPriceImpactColor(priceImpact);
  const diffBps = comparison?.diffBps ?? null;
  const diffSign = comparison?.diff !== undefined && comparison.diff < 0n ? '-' : '+';
  const diffAbs = comparison?.diff !== undefined ? (comparison.diff < 0n ? -comparison.diff : comparison.diff) : null;

  return (
    <div className={`bg-[var(--color-surface-tile-3)] rounded-lg p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">Expected Output</span>
        <span className="font-medium text-[var(--color-text)]">
          {formatAmount(amountOut, tokenOutDecimals)} {tokenOutSymbol}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">Price</span>
        <span className="font-medium text-[var(--color-text-secondary)]">
          1 {tokenInSymbol} = {priceStr} {tokenOutSymbol}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">Price Impact</span>
        <span className={`font-medium ${priceImpactColor}`}>
          {priceImpact !== null && priceImpact !== undefined
            ? `${priceImpact > 0 ? '+' : ''}${priceImpact.toFixed(2)}%`
            : '—'}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">Platform Fee</span>
        <span className="font-medium text-[var(--color-text)]">1%</span>
      </div>

      {null}

      {priceImpact !== null && priceImpact !== undefined && priceImpact > 5 && (
        <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400">
            ⚠ High price impact! This trade will significantly affect the pool price.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main swap interface
 * Integrated into token cards for buying/selling tokens
 */
'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useQuote } from '@/hooks/useQuote';
import { useSwap } from '@/hooks/useSwap';
import { useTokenPool } from '@/hooks/useTokenPool';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useTokenLogo } from '@/hooks/useTokenLogo';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { ICPSWAP_POOL_IDL, ICRC2_IDL } from '@/lib/wallet/actors';
import { QuotePreview } from './QuotePreview';
import { TransactionStatus } from './TransactionStatus';

interface Token {
  ledger_id?: string;
  tokenLedgerId?: string;
  name: string;
  symbol: string;
  pool_id?: string;
  decimals?: number;
}

interface SwapPanelProps {
  token: Token;
  mode: 'buy' | 'sell';
  onClose?: () => void;
  onSuccess?: () => void;
  showHeader?: boolean;
  variant?: 'modal' | 'inline';
}

const ICP_TOKEN = {
  ledger_id: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
  symbol: 'ICP',
  decimals: 8,
};

export function SwapPanel({
  token,
  mode,
  onClose,
  onSuccess,
  showHeader = true,
  variant = 'modal',
}: SwapPanelProps) {
  const { isConnected, principal } = useWallet();
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'approving' | 'swapping' | 'success' | 'error'>('idle');
  const [txError, setTxError] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const approvalMode: 'max' = 'max';
  const [pendingRefunds, setPendingRefunds] = useState<Array<{ tokenId: string; amount: bigint }>>([]);
  const [isRefunding, setIsRefunding] = useState(false);

  const tokenLedgerId = token.ledger_id || token.tokenLedgerId || '';
  const { logo: tokenLogo } = useTokenLogo(tokenLedgerId);

  const isBuying = mode === 'buy';
  const tokenIn = isBuying ? ICP_TOKEN.ledger_id : tokenLedgerId;
  const tokenOut = isBuying ? tokenLedgerId : ICP_TOKEN.ledger_id;
  const tokenInSymbol = isBuying ? ICP_TOKEN.symbol : token.symbol;
  const tokenOutSymbol = isBuying ? token.symbol : ICP_TOKEN.symbol;
  const zeroForOne = true;

  const [tokenInDecimals, setTokenInDecimals] = useState(
    isBuying ? ICP_TOKEN.decimals : (token.decimals ?? 8)
  );
  const [tokenOutDecimals, setTokenOutDecimals] = useState(
    isBuying ? (token.decimals ?? 8) : ICP_TOKEN.decimals
  );

  const parseAmountToBigint = (value: string, decimals: number): bigint | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

    const [whole, frac = ''] = trimmed.split('.');
    const paddedFrac = (frac + '0'.repeat(decimals)).slice(0, decimals);
    const base = 10n ** BigInt(decimals);
    return BigInt(whole) * base + BigInt(paddedFrac || '0');
  };

  const amountBigInt = parseAmountToBigint(amount, tokenInDecimals);

  const formatAmount = (raw: bigint, decimals: number, maxFrac = 6) => {
    const base = 10n ** BigInt(decimals);
    const whole = raw / base;
    const frac = raw % base;
    if (decimals === 0) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0');
    const trimmed = fracStr.replace(/0+$/, '');
    if (!trimmed) return whole.toString();
    const shown = trimmed.slice(0, Math.min(maxFrac, trimmed.length));
    return `${whole.toString()}.${shown}`;
  };

  const formatAmountForInput = (raw: bigint, decimals: number) =>
    formatAmount(raw, decimals, decimals);

  const {
    balance: tokenInBalance,
    isLoading: isLoadingTokenInBalance,
    refresh: refreshTokenInBalance,
  } = useTokenBalance({
    tokenId: tokenIn,
    owner: principal,
    enabled: !!principal && !!tokenIn,
  });

  const {
    balance: tokenOutBalance,
    isLoading: isLoadingTokenOutBalance,
    refresh: refreshTokenOutBalance,
  } = useTokenBalance({
    tokenId: tokenOut,
    owner: principal,
    enabled: !!principal && !!tokenOut,
  });

  const { poolId: fetchedPoolId, isLoading: isPoolLoading } = useTokenPool(
    tokenLedgerId || undefined,
    ICP_TOKEN.ledger_id
  );
  const [resolvedPoolId, setResolvedPoolId] = useState('');
  const [isValidatingPool, setIsValidatingPool] = useState(false);

  useEffect(() => {
    let mounted = true;

    const validatePool = async () => {
      if (!tokenLedgerId) {
        if (mounted) setResolvedPoolId('');
        return;
      }

      if (!token.pool_id) {
        if (mounted) setResolvedPoolId(fetchedPoolId || '');
        return;
      }

      try {
        setIsValidatingPool(true);
        const poolActor = getAnonymousActor<any>(token.pool_id, ICPSWAP_POOL_IDL);
        const metaResult = await poolActor.metadata();
        if ('ok' in metaResult) {
          const token0 = metaResult.ok.token0.address;
          const token1 = metaResult.ok.token1.address;
          const hasIcp =
            token0 === ICP_TOKEN.ledger_id || token1 === ICP_TOKEN.ledger_id;
          const hasToken = token0 === tokenLedgerId || token1 === tokenLedgerId;
          if (hasIcp && hasToken) {
            if (mounted) setResolvedPoolId(token.pool_id);
            return;
          }
        }
      } catch (error) {
        console.warn('Pool metadata validation failed, falling back:', error);
      } finally {
        if (mounted) setIsValidatingPool(false);
      }

      if (mounted) setResolvedPoolId(fetchedPoolId || '');
    };

    validatePool();

    return () => {
      mounted = false;
    };
  }, [tokenLedgerId, token.pool_id, fetchedPoolId]);

  const poolId = resolvedPoolId;
  const isPoolResolving = isPoolLoading || isValidatingPool;

  useEffect(() => {
    let cancelled = false;

    const fetchDecimals = async (tokenId: string, fallback: number) => {
      try {
        const actor = getAnonymousActor<any>(tokenId, ICRC2_IDL);
        const decimals = await actor.icrc1_decimals();
        return typeof decimals === 'number' ? decimals : fallback;
      } catch {
        return fallback;
      }
    };

    const load = async () => {
      const inFallback = isBuying ? ICP_TOKEN.decimals : (token.decimals ?? 8);
      const outFallback = isBuying ? (token.decimals ?? 8) : ICP_TOKEN.decimals;

      if (tokenIn) {
        const resolved = tokenIn === ICP_TOKEN.ledger_id
          ? ICP_TOKEN.decimals
          : await fetchDecimals(tokenIn, inFallback);
        if (!cancelled) setTokenInDecimals(resolved);
      }

      if (tokenOut) {
        const resolved = tokenOut === ICP_TOKEN.ledger_id
          ? ICP_TOKEN.decimals
          : await fetchDecimals(tokenOut, outFallback);
        if (!cancelled) setTokenOutDecimals(resolved);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tokenIn, tokenOut, token.decimals, isBuying]);

  const {
    quote,
    icpswapQuote,
    comparison,
    isLoading: isQuoteLoading,
    error: quoteError,
  } = useQuote({
    poolId,
    tokenIn,
    tokenOut,
    amountIn: amountBigInt,
    zeroForOne,
    enabled: !!poolId && !!amountBigInt && amountBigInt > 0n,
  });

  const {
    needsApproval,
    isCheckingApproval,
    approve,
    isApproving,
    swap,
    isSwapping,
    tokenInLedgerFee,
    tokenInFeeLoaded,
    getPendingRefund,
    withdrawPendingRefund,
    error: swapError,
    txHash,
  } = useSwap({
    poolId,
    tokenIn,
    tokenOut,
    amountIn: amountBigInt,
    zeroForOne,
    enabled: !!poolId && !!amountBigInt && amountBigInt > 0n,
    approvalMode,
  });

  const handleApprove = async () => {
    try {
      setTxStatus('approving');
      setTxError(null);
      setReceivedAmount(null);
      await approve();
      setTxStatus('idle');
    } catch (err) {
      console.error('Approval error:', err);
      setTxStatus('error');
      setTxError(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleSwap = async () => {
    if (!quote) return;

    try {
      setTxStatus('swapping');
      setTxError(null);
      setReceivedAmount(null);
      setPaidAmount(null);
      setPendingRefunds([]);
      const outRaw = await swap(0, quote);
      setReceivedAmount(formatAmount(outRaw, tokenOutDecimals));
      if (amountBigInt) {
        setPaidAmount(formatAmount(amountBigInt, tokenInDecimals));
      }
      setTxStatus('success');
      void Promise.all([refreshTokenInBalance(), refreshTokenOutBalance()]).catch((refreshErr) => {
        console.warn('Failed to refresh balances after swap:', refreshErr);
      });
      if (onSuccess) {
        setTimeout(onSuccess, 2000);
      }
    } catch (err) {
      console.error('Swap error:', err);
      setTxStatus('error');
      setTxError(err instanceof Error ? err.message : 'Swap failed');
      if (isConnected) {
        try {
          const [inRefund, outRefund] = await Promise.all([
            tokenIn ? getPendingRefund(tokenIn) : Promise.resolve(0n),
            tokenOut ? getPendingRefund(tokenOut) : Promise.resolve(0n),
          ]);
          const refunds: Array<{ tokenId: string; amount: bigint }> = [];
          if (tokenIn && inRefund > 0n) refunds.push({ tokenId: tokenIn, amount: inRefund });
          if (tokenOut && outRefund > 0n) refunds.push({ tokenId: tokenOut, amount: outRefund });
          setPendingRefunds(refunds);
        } catch (refundErr) {
          console.warn('Failed to load pending refunds:', refundErr);
        }
      }
    }
  };

  const handleCloseStatus = () => {
    setTxStatus('idle');
    setTxError(null);
    setReceivedAmount(null);
    setPaidAmount(null);
    setPendingRefunds([]);
    if (txStatus === 'success' && onClose) {
      onClose();
    }
  };

  const handleWithdrawRefund = async (tokenId: string) => {
    try {
      setIsRefunding(true);
      await withdrawPendingRefund(tokenId);
      setPendingRefunds((prev) => prev.filter((entry) => entry.tokenId !== tokenId));
      await Promise.all([refreshTokenInBalance(), refreshTokenOutBalance()]);
    } catch (err) {
      console.error('Withdraw refund error:', err);
      setTxError(err instanceof Error ? err.message : 'Refund withdrawal failed');
    } finally {
      setIsRefunding(false);
    }
  };

  const isValid = amountBigInt && amountBigInt > 0n && quote && !quoteError;
  const canExecute = isValid && !isCheckingApproval && !isQuoteLoading;

  const handleBalanceClick = () => {
    if (tokenInBalance === null || tokenInBalance <= 0n) return;
    const fee = tokenInFeeLoaded ? tokenInLedgerFee : 0n;
    const approvalFeeCount = needsApproval || isCheckingApproval ? 2n : 1n;
    const feeBuffer = fee * approvalFeeCount;
    const maxSpendable =
      feeBuffer > 0n
        ? tokenInBalance > feeBuffer
          ? tokenInBalance - feeBuffer
          : 0n
        : tokenInBalance;
    setAmount(formatAmountForInput(maxSpendable, tokenInDecimals));
  };

  return (
    <>
      <div
        className={`rounded-xl space-y-4 ${
          variant === 'inline' ? 'bg-[var(--color-bg-secondary)] p-4' : 'bg-[var(--color-bg-secondary)] p-6'
        }`}
      >
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-[var(--color-text)]">
              {mode === 'buy' ? 'Buy' : 'Sell'} {token.symbol}
            </h3>
            {onClose && (
              <button
                onClick={onClose}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {isPoolResolving && (
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Finding liquidity pool...
            </p>
          </div>
        )}

        {!isPoolResolving && !poolId && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">
              No pool found for this token
            </p>
          </div>
        )}

        {poolId && (
          <>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className={`w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text)] font-bold rounded-lg focus:outline-none focus:border-[var(--color-primary)] ${
                    variant === 'inline' ? 'text-xl px-3 py-2' : 'text-2xl px-4 py-3'
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isBuying ? (
                    <img
                      src="/icp-logo.png"
                      alt="ICP"
                      className="h-6 w-6 rounded-sm object-contain"
                    />
                  ) : tokenLogo ? (
                    <img
                      src={tokenLogo}
                      alt={token.symbol || 'Token'}
                      className="h-6 w-6 rounded-sm object-contain"
                    />
                  ) : (
                    <span className="text-lg font-medium text-[var(--color-text-secondary)]">
                      {tokenInSymbol}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>Balance</span>
                <button
                  type="button"
                  onClick={handleBalanceClick}
                  disabled={isLoadingTokenInBalance || tokenInBalance === null || tokenInBalance <= 0n}
                  className="font-mono text-[var(--color-text-secondary)] disabled:text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  {isLoadingTokenInBalance || tokenInBalance === null
                    ? '—'
                    : `${formatAmount(tokenInBalance, tokenInDecimals, 4)} ${tokenInSymbol}`}
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-[var(--color-bg-tertiary)] p-2 rounded-lg">
                <svg className="w-5 h-5 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            <QuotePreview
              quote={quote}
              icpswapQuote={icpswapQuote}
              comparison={comparison}
              isLoading={isQuoteLoading}
              tokenInSymbol={tokenInSymbol}
              tokenOutSymbol={tokenOutSymbol}
              amountIn={amountBigInt || 0n}
              tokenInDecimals={tokenInDecimals}
              tokenOutDecimals={tokenOutDecimals}
            />

            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)]">
              <span>{tokenOutSymbol} Balance</span>
              <span className="font-mono text-[var(--color-text-secondary)]">
                {isLoadingTokenOutBalance || tokenOutBalance === null
                  ? '—'
                  : `${formatAmount(tokenOutBalance, tokenOutDecimals, 4)} ${tokenOutSymbol}`}
              </span>
            </div>

            {(quoteError || swapError) && (
              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  {quoteError?.message || swapError?.message}
                </p>
              </div>
            )}

            <div className="pt-2">
              {null}
              {needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={!isConnected || !canExecute || isApproving}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-bg-card)] disabled:text-[var(--color-text-muted)] text-[var(--color-on-primary)] font-bold py-4 px-6 rounded-lg transition-colors"
                >
                  {!isConnected
                    ? 'Connect wallet to approve'
                    : isApproving
                    ? 'Approving...'
                    : `Approve ${tokenInSymbol}`}
                </button>
              ) : (
                <button
                  onClick={handleSwap}
                  disabled={!isConnected || !canExecute || isSwapping}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-bg-card)] disabled:text-[var(--color-text-muted)] text-[var(--color-on-primary)] font-bold py-4 px-6 rounded-lg transition-colors"
                >
                  {!isConnected
                    ? 'Connect wallet to swap'
                    : isSwapping
                    ? 'Swapping...'
                    : mode === 'buy'
                    ? 'Buy'
                    : 'Sell'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <TransactionStatus
        isOpen={txStatus !== 'idle'}
        status={txStatus === 'idle' ? 'success' : txStatus}
        error={txError}
        txHash={txHash}
        paidAmount={paidAmount}
        paidSymbol={tokenInSymbol}
        receivedAmount={receivedAmount}
        receivedSymbol={tokenOutSymbol}
        pendingRefunds={pendingRefunds.map((entry) => {
          const isTokenIn = entry.tokenId === tokenIn;
          const decimals = isTokenIn ? tokenInDecimals : tokenOutDecimals;
          const symbol = isTokenIn ? tokenInSymbol : tokenOutSymbol;
          return {
            tokenId: entry.tokenId,
            amount: formatAmount(entry.amount, decimals),
            symbol,
          };
        })}
        isRefunding={isRefunding}
        onWithdrawRefund={handleWithdrawRefund}
        onClose={handleCloseStatus}
      />
    </>
  );
}

/**
 * Quote fetching hook with debouncing
 * Fetches swap quotes from ICPSwap pool
 */
import { useState, useEffect, useCallback } from 'react';
import { Principal } from '@dfinity/principal';
import type { QuoteResult } from '@/lib/wallet/actors';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { ICPSWAP_POOL_IDL, PRYSM_ROUTER_IDL, ICRC2_IDL } from '@/lib/wallet/actors';

interface UseQuoteOptions {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint | null;
  zeroForOne: boolean;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseQuoteReturn {
  quote: QuoteResult | null;
  icpswapQuote: bigint | null;
  comparison: { diff: bigint; diffBps: bigint | null } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const ROUTER_FEE_BPS = 100n; // 1%
const BPS_DENOMINATOR = 10000n;
const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';

/**
 * Hook for fetching swap quotes with automatic debouncing
 */
export function useQuote({
  poolId,
  tokenIn,
  tokenOut,
  amountIn,
  zeroForOne,
  enabled = true,
  debounceMs = 300, // Reduced from 500ms for faster response
}: UseQuoteOptions): UseQuoteReturn {
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [icpswapQuote, setIcpswapQuote] = useState<bigint | null>(null);
  const [comparison, setComparison] = useState<{ diff: bigint; diffBps: bigint | null } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetchParams, setLastFetchParams] = useState<string>('');
  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID || '';

  const fetchQuote = useCallback(async () => {
    if (!enabled || !amountIn || amountIn <= 0n || !poolId) {
      setQuote(null);
      setIcpswapQuote(null);
      setComparison(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Quotes are queries; do not require wallet connection.
      const poolActor = getAnonymousActor<any>(poolId, ICPSWAP_POOL_IDL);

      const isMethodNotFound = (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return (
          message.includes("has no query method 'metadata'") ||
          message.includes('IC0536')
        );
      };

      // Resolve swap direction without assuming ICP is token0.
      let resolvedZeroForOne = zeroForOne;
      try {
        const metaResult = await poolActor.metadata();
        if ('ok' in metaResult) {
          const token0 = metaResult.ok.token0.address;
          const token1 = metaResult.ok.token1.address;
          if (tokenIn === token0) resolvedZeroForOne = true;
          else if (tokenIn === token1) resolvedZeroForOne = false;

          if (tokenOut) {
            const expectedOut = resolvedZeroForOne ? token1 : token0;
            if (tokenOut !== expectedOut) {
              throw new Error('Selected token pair does not match pool token0/token1');
            }
          }
        } else if ('err' in metaResult) {
          throw new Error(`Pool metadata error: ${JSON.stringify(metaResult.err)}`);
        }
      } catch (err) {
        // If metadata isn't available, fall back to caller-provided direction.
        // Do not call token0()/token1() because many pool canisters don't expose them.
        if (!isMethodNotFound(err)) throw err;
      }

      // Cache check - avoid refetching with same parameters
      const params = `${poolId}-${tokenIn}-${amountIn.toString()}-${resolvedZeroForOne}`;
      if (params === lastFetchParams && quote) {
        return; // Use cached quote
      }

      let routerAmountOut: bigint | null = null;
      let routerNetOut: bigint | null = null;
      let poolOutFee: bigint = 0n;
      let tokenOutLedgerFee: bigint = 0n;
      const isIcpOut = tokenOut === ICP_LEDGER_ID;

      try {
        const cached = await poolActor.getCachedTokenFee();
        poolOutFee = resolvedZeroForOne ? cached.token1Fee : cached.token0Fee;
      } catch {
        poolOutFee = 0n;
      }

      try {
        const tokenActor = getAnonymousActor<any>(tokenOut, ICRC2_IDL);
        const fee = await Promise.race([
          tokenActor.icrc1_fee(),
          new Promise<bigint>((_, reject) =>
            setTimeout(() => reject(new Error('fee timeout')), 5_000)
          ),
        ]);
        tokenOutLedgerFee = BigInt(fee);
      } catch {
        tokenOutLedgerFee = 0n;
      }
      if (routerCanisterId) {
        const routerAmountIn = isIcpOut
          ? amountIn
          : amountIn > 0n
          ? amountIn - (amountIn * ROUTER_FEE_BPS) / BPS_DENOMINATOR
          : amountIn;
        if (routerAmountIn <= 0n) {
          setQuote(null);
          setIcpswapQuote(null);
          setComparison(null);
          return;
        }
        const routerActor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
        const routerResult = await routerActor.get_quote({
          pool_id: Principal.fromText(poolId),
          zero_for_one: resolvedZeroForOne,
          amount_in: routerAmountIn,
        });

        if ('Ok' in routerResult) {
          routerAmountOut = routerResult.Ok.amount_out;

          let netOut = routerAmountOut ?? 0n;
          if (poolOutFee > 0n) {
            netOut = netOut > poolOutFee ? netOut - poolOutFee : 0n;
          }
          if (isIcpOut && netOut > 0n) {
            const routerFee = (netOut * ROUTER_FEE_BPS) / BPS_DENOMINATOR;
            netOut = netOut > routerFee ? netOut - routerFee : 0n;
          }
          if (tokenOutLedgerFee > 0n) {
            netOut = netOut > tokenOutLedgerFee ? netOut - tokenOutLedgerFee : 0n;
          }
          routerNetOut = netOut;

          setQuote({
            amount_out: netOut,
            price_impact: routerResult.Ok.price_impact ?? [],
          });
        } else if ('Err' in routerResult) {
          throw new Error(formatRouterError(routerResult.Err));
        }
      }

      // Call quote on the pool (for comparison)
      const swapArgs = {
        amountIn: amountIn.toString(),
        zeroForOne: resolvedZeroForOne,
        amountOutMinimum: '0', // Just for quote
      };

      const result = await poolActor.quote(swapArgs);

      setLastFetchParams(params);

      if ('ok' in result) {
        const poolAmountOut = result.ok;
        setIcpswapQuote(poolAmountOut);

        if (!routerAmountOut && !routerCanisterId) {
          setQuote({
            amount_out: poolAmountOut,
            price_impact: [],
          });
        }

        if (routerNetOut !== null) {
          const diff = poolAmountOut - routerNetOut;
          const diffBps = poolAmountOut === 0n ? null : (diff * 10000n) / poolAmountOut;
          setComparison({ diff, diffBps });
        } else {
          setComparison(null);
        }
      } else if ('err' in result) {
        const errorMsg = formatError(result.err);
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error('Quote fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch quote'));
      setQuote(null);
      setIcpswapQuote(null);
      setComparison(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    enabled,
    poolId,
    tokenIn,
    tokenOut,
    amountIn,
    zeroForOne,
    quote,
    lastFetchParams,
    routerCanisterId,
  ]);

  // Debounced quote fetching
  useEffect(() => {
    if (!enabled || !amountIn || amountIn <= 0n) {
      setQuote(null);
      setIcpswapQuote(null);
      setComparison(null);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchQuote();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [enabled, amountIn, fetchQuote, debounceMs]);

  return {
    quote,
    icpswapQuote,
    comparison,
    isLoading,
    error,
    refetch: fetchQuote,
  };
}

/**
 * Format canister error for display
 */
function formatError(error: any): string {
  if ('CommonError' in error) {
    return 'Quote failed due to a common error';
  }
  if ('InsufficientFunds' in error) {
    return 'Insufficient funds';
  }
  if ('InternalError' in error) {
    return `Internal error: ${error.InternalError}`;
  }
  if ('UnsupportedToken' in error) {
    return `Unsupported token: ${error.UnsupportedToken}`;
  }
  return 'Unknown error occurred';
}

function formatRouterError(error: any): string {
  if (!error) return 'Unknown error occurred';
  if ('Unauthorized' in error) return 'Unauthorized';
  if ('InvalidArguments' in error) return `Invalid arguments: ${error.InvalidArguments.reason}`;
  if ('PoolNotFound' in error) return 'Pool not found';
  if ('UnsupportedToken' in error) return `Unsupported token: ${error.UnsupportedToken.token}`;
  if ('CanisterCallFailed' in error) {
    return `Canister call failed: ${error.CanisterCallFailed.reason}`;
  }
  if ('InternalError' in error) return `Internal error: ${error.InternalError.reason}`;
  return 'Unknown error occurred';
}

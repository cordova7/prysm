/**
 * Swap execution hook
 * Handles approval checks and swap execution through ICPSwap pool
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import {
  ICRC2_IDL,
  ICPSWAP_POOL_IDL,
  PRYSM_ROUTER_IDL,
  type GetCachedTokenFeeRet,
  type QuoteResult,
} from '@/lib/wallet/actors';
import { addImportedTokens } from '@/lib/portfolio-store';

interface UseSwapOptions {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint | null;
  zeroForOne: boolean;
  enabled?: boolean;
  approvalMode?: 'exact' | 'max';
}

interface UseSwapReturn {
  // Approval state
  needsApproval: boolean;
  isCheckingApproval: boolean;
  approve: () => Promise<void>;
  isApproving: boolean;

  // Swap state
  swap: (slippageBps: number, quote: QuoteResult) => Promise<bigint>;
  isSwapping: boolean;

  // Shared state
  error: Error | null;
  txHash: string | null;

  // Refund helpers
  getPendingRefund: (tokenId: string) => Promise<bigint>;
  withdrawPendingRefund: (tokenId: string) => Promise<bigint>;
  withdrawFromRouter: (tokenId: string, amount: bigint) => Promise<bigint>;

  // Fees (for max input calculations)
  tokenInLedgerFee: bigint;
  tokenInFeeLoaded: boolean;
}

/**
 * Hook for executing swaps with approval flow
 */
export function useSwap({
  poolId,
  tokenIn,
  tokenOut,
  amountIn,
  zeroForOne,
  enabled = true,
  approvalMode = 'exact',
}: UseSwapOptions): UseSwapReturn {
  const { getActor, isConnected, principal } = useWallet();
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenStandard, setTokenStandard] = useState<'icrc2' | 'icrc1' | 'unknown'>('unknown');
  const [tokenInLedgerFee, setTokenInLedgerFee] = useState<bigint>(0n);
  const [tokenInFeeLoaded, setTokenInFeeLoaded] = useState(false);
  const tokenActorRef = useRef<any>(null);
  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID || '';

  const [lastApprovalParams, setLastApprovalParams] = useState<string>('');

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, label: string) => {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label}: timed out`)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const getAnonTokenActor = useCallback(
    (tokenId: string) => getAnonymousActor<any>(tokenId, ICRC2_IDL),
    []
  );

  const getAnonPoolActor = useCallback(
    (poolId: string) => getAnonymousActor<any>(poolId, ICPSWAP_POOL_IDL),
    []
  );

  const isMethodNotFound = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes("has no query method 'metadata'") ||
      message.includes('IC0536') ||
      message.includes('does not have method') ||
      message.includes('has no method')
    );
  };

  const getPoolCachedFees = useCallback(
    async (poolId: string): Promise<GetCachedTokenFeeRet> => {
      // Queries; do not require wallet connection.
      const poolActor = getAnonPoolActor(poolId);
      return await poolActor.getCachedTokenFee();
    },
    [getAnonPoolActor]
  );

  const resolveZeroForOne = useCallback(
    async (poolId: string, tokenIn: string, tokenOut?: string): Promise<boolean> => {
      // Queries; do not require wallet connection.
      const poolActor = getAnonPoolActor(poolId);

      // Prefer metadata() because some pools don't expose token0()/token1().
      try {
        const metaResult = await poolActor.metadata();
        if ('ok' in metaResult) {
          const token0 = metaResult.ok.token0.address;
          const token1 = metaResult.ok.token1.address;
          if (tokenIn === token0) {
            if (tokenOut && tokenOut !== token1) {
              throw new Error(`Token ${tokenOut} is not the counterparty token for pool ${poolId}`);
            }
            return true;
          }
          if (tokenIn === token1) {
            if (tokenOut && tokenOut !== token0) {
              throw new Error(`Token ${tokenOut} is not the counterparty token for pool ${poolId}`);
            }
            return false;
          }
          throw new Error(`Token ${tokenIn} is not part of pool ${poolId}`);
        }
        if ('err' in metaResult) {
          throw new Error(`Pool metadata error: ${JSON.stringify(metaResult.err)}`);
        }
      } catch (err) {
        if (!isMethodNotFound(err)) throw err;
      }

      // Last resort: infer direction by matching fee cache vs ledger fees (works when fees differ).
      const [cached, tokenInActor, tokenOutActor] = await Promise.all([
        getPoolCachedFees(poolId),
        Promise.resolve(getAnonTokenActor(tokenIn)),
        tokenOut ? Promise.resolve(getAnonTokenActor(tokenOut)) : Promise.resolve(null),
      ]);

      const [ledgerInFee, ledgerOutFee] = await Promise.all([
        tokenInActor.icrc1_fee().catch(() => null),
        tokenOutActor?.icrc1_fee().catch(() => null),
      ]);

      if (ledgerInFee !== null && ledgerOutFee !== null) {
        const matchesTrue = ledgerInFee === cached.token0Fee && ledgerOutFee === cached.token1Fee;
        const matchesFalse = ledgerInFee === cached.token1Fee && ledgerOutFee === cached.token0Fee;
        if (matchesTrue && !matchesFalse) return true;
        if (matchesFalse && !matchesTrue) return false;
      }

      throw new Error(`Unable to determine pool direction for ${poolId}`);
    },
    [getAnonPoolActor, getAnonTokenActor, getPoolCachedFees]
  );

  const getTokenFeesForSwap = useCallback(
    async (poolId: string, tokenIn: string, tokenOut: string): Promise<{
      resolvedZeroForOne: boolean;
      tokenInFee: bigint;
      tokenOutFee: bigint;
    }> => {
      let resolvedZeroForOne: boolean;
      try {
        resolvedZeroForOne = await withTimeout(
          resolveZeroForOne(poolId, tokenIn, tokenOut),
          15_000,
          'Resolve pool direction'
        );
      } catch {
        // If direction can't be resolved reliably, fall back to caller-provided direction.
        // This may still fail later if fees don't match the pool's cached fee ordering.
        resolvedZeroForOne = zeroForOne;
      }

      // Prefer pool cached fees because the pool validates them ("Wrong fee cache ...").
      try {
        const cached = await withTimeout(getPoolCachedFees(poolId), 15_000, 'Fetch pool fee cache');
        const tokenInFee = resolvedZeroForOne ? cached.token0Fee : cached.token1Fee;
        const tokenOutFee = resolvedZeroForOne ? cached.token1Fee : cached.token0Fee;
        return { resolvedZeroForOne, tokenInFee, tokenOutFee };
      } catch {
        // Fallback to reading from the ledgers (may fail for non-ICRC tokens).
        const tokenInActor = getAnonTokenActor(tokenIn);
        const tokenOutActor = getAnonTokenActor(tokenOut);
        const [tokenInFee, tokenOutFee] = await Promise.all([
          tokenInActor.icrc1_fee().catch(() => 0n),
          tokenOutActor.icrc1_fee().catch(() => 0n),
        ]);
        return { resolvedZeroForOne, tokenInFee, tokenOutFee };
      }
    },
    [getAnonTokenActor, getPoolCachedFees, resolveZeroForOne, withTimeout, zeroForOne]
  );

  const getLedgerFee = useCallback(
    async (tokenId: string): Promise<bigint> => {
      const tokenActor = getAnonTokenActor(tokenId);
      try {
        const fee = await withTimeout(tokenActor.icrc1_fee(), 10_000, 'Ledger fee');
        return typeof fee === 'bigint' ? fee : BigInt(fee as any);
      } catch {
        return 0n;
      }
    },
    [getAnonTokenActor, withTimeout]
  );

  useEffect(() => {
    let cancelled = false;
    if (!tokenIn) {
      setTokenInLedgerFee(0n);
      setTokenInFeeLoaded(false);
      return;
    }
    const loadFee = async () => {
      const fee = await getLedgerFee(tokenIn);
      if (!cancelled) {
        setTokenInLedgerFee(fee);
        setTokenInFeeLoaded(true);
      }
    };
    loadFee();
    return () => {
      cancelled = true;
    };
  }, [tokenIn, getLedgerFee]);

  useEffect(() => {
    let cancelled = false;
    if (!isConnected || !tokenIn) {
      tokenActorRef.current = null;
      return;
    }
    const loadActor = async () => {
      try {
        const actor = await getActor(tokenIn, ICRC2_IDL);
        if (!cancelled) {
          tokenActorRef.current = actor;
        }
      } catch {
        if (!cancelled) {
          tokenActorRef.current = null;
        }
      }
    };
    loadActor();
    return () => {
      cancelled = true;
    };
  }, [getActor, isConnected, tokenIn]);

  const principalToSubaccount = (principal: Principal): Uint8Array => {
    const bytes = principal.toUint8Array();
    const sub = new Uint8Array(32);
    sub[0] = bytes.length;
    sub.set(bytes.slice(0, 31), 1);
    return sub;
  };

  const isUnsupportedTokenError = (err: unknown) => {
    if (!err) return false;
    if (typeof err === 'string') return err.includes('UnsupportedToken');
    try {
      return JSON.stringify(err).includes('UnsupportedToken');
    } catch {
      return false;
    }
  };

  const normalizeWalletError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes('tab closed')) {
      return 'Wallet window closed. Reconnect your wallet and try again.';
    }
    if (message.toLowerCase().includes('user rejected') || message.toLowerCase().includes('rejected')) {
      return 'Transaction rejected in wallet.';
    }
    return message;
  };

  const performIcrc1Swap = useCallback(
    async (
      poolId: string,
      tokenIn: string,
      tokenOut: string,
      amountIn: bigint,
      amountOutMinimum: bigint,
      zeroForOneResolved: boolean
    ): Promise<bigint> => {
      if (!principal) {
        throw new Error('Wallet not connected');
      }

      const poolPrincipal = Principal.fromText(poolId);
      const tokenInActor = await getActor(tokenIn, ICRC2_IDL) as any;
      const [tokenInFee, tokenOutFee] = await Promise.all([
        getLedgerFee(tokenIn),
        getLedgerFee(tokenOut),
      ]);

      const subaccount = principalToSubaccount(principal);
      const transferResult = await withTimeout<{ Ok: bigint } | { Err: unknown }>(
        tokenInActor.icrc1_transfer({
          to: {
            owner: poolPrincipal,
            subaccount: [Array.from(subaccount)],
          },
          amount: amountIn,
          fee: [tokenInFee],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
        }),
        120_000,
        'ICRC1 transfer'
      );

      if ('Err' in transferResult) {
        throw new Error(`Transfer failed: ${JSON.stringify(transferResult.Err)}`);
      }

      const poolActor = await getActor(poolId, ICPSWAP_POOL_IDL) as any;
      const depositResult = await withTimeout<{ ok: bigint } | { err: unknown }>(
        poolActor.deposit({
          fee: tokenInFee,
          token: tokenIn,
          amount: amountIn,
        }),
        120_000,
        'Deposit'
      );

      if ('err' in depositResult) {
        throw new Error(formatError(depositResult.err));
      }

      const swapResult = await withTimeout<{ ok: bigint } | { err: unknown }>(
        poolActor.swap({
          amountIn: amountIn.toString(),
          zeroForOne: zeroForOneResolved,
          amountOutMinimum: amountOutMinimum.toString(),
        }),
        120_000,
        'Swap'
      );

      if ('err' in swapResult) {
        throw new Error(formatError(swapResult.err));
      }

      const amountOut = swapResult.ok;

      const withdrawResult = await withTimeout<{ ok: bigint } | { err: unknown }>(
        poolActor.withdraw({
          fee: tokenOutFee,
          token: tokenOut,
          amount: amountOut,
        }),
        120_000,
        'Withdraw'
      );

      if ('err' in withdrawResult) {
        throw new Error(formatError(withdrawResult.err));
      }

      return amountOut;
    },
    [getActor, getLedgerFee, principal, withTimeout]
  );

  const recordSwapTokens = useCallback(
    (tokenInId: string, tokenOutId: string) => {
      const principalText = principal?.toText();
      addImportedTokens([tokenInId, tokenOutId], principalText);
    },
    [principal]
  );

  const getPendingRefund = useCallback(
    async (tokenId: string): Promise<bigint> => {
      if (!isConnected || !principal) {
        throw new Error('Wallet not connected');
      }
      if (!routerCanisterId) {
        throw new Error('Router canister ID not configured');
      }
      const routerActor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const result = await withTimeout<bigint>(
        routerActor.get_pending_refund(Principal.fromText(tokenId)),
        20_000,
        'Get pending refund'
      );
      return BigInt(result);
    },
    [getActor, isConnected, principal, routerCanisterId, withTimeout]
  );

  const withdrawPendingRefund = useCallback(
    async (tokenId: string): Promise<bigint> => {
      if (!isConnected || !principal) {
        throw new Error('Wallet not connected');
      }
      if (!routerCanisterId) {
        throw new Error('Router canister ID not configured');
      }
      const routerActor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const result = await withTimeout<{ Ok: bigint } | { Err: unknown }>(
        routerActor.withdraw_pending_refund(Principal.fromText(tokenId)),
        120_000,
        'Withdraw pending refund'
      );
      if ('Ok' in result) return result.Ok;
      if ('Err' in result) throw new Error(formatRouterError(result.Err));
      throw new Error('Unknown withdraw result');
    },
    [getActor, isConnected, principal, routerCanisterId, withTimeout]
  );

  const withdrawFromRouter = useCallback(
    async (tokenId: string, amount: bigint): Promise<bigint> => {
      if (!isConnected || !principal) {
        throw new Error('Wallet not connected');
      }
      if (!routerCanisterId) {
        throw new Error('Router canister ID not configured');
      }
      const routerActor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const result = await withTimeout<{ Ok: bigint } | { Err: unknown }>(
        routerActor.withdraw_from_router(Principal.fromText(tokenId), amount),
        120_000,
        'Withdraw from router'
      );
      if ('Ok' in result) return result.Ok;
      if ('Err' in result) throw new Error(formatRouterError(result.Err));
      throw new Error('Unknown withdraw result');
    },
    [getActor, isConnected, principal, routerCanisterId, withTimeout]
  );

  /**
   * Check if approval is needed
   */
  const checkApproval = useCallback(async () => {
      if (!enabled || !isConnected || !principal || !amountIn || amountIn <= 0n || !poolId) {
        setNeedsApproval(false);
        return;
      }

      try {
        setIsCheckingApproval(true);

      const params = `${poolId}-${tokenIn}-${tokenOut}-${amountIn.toString()}`;
      if (params === lastApprovalParams) return;
      setLastApprovalParams(params);

      if (!routerCanisterId) {
        throw new Error('Router canister ID not configured');
      }

      // Get ICRC-2 token actor
      const tokenActor = getAnonTokenActor(tokenIn);

      // User approval must cover amount + ledger fee for transfer_from.
      const ledgerFee = tokenInFeeLoaded ? tokenInLedgerFee : await getLedgerFee(tokenIn);
      const requiredAllowance = amountIn + ledgerFee;

      try {
        // Check current allowance
        const allowance = await withTimeout<{ allowance: bigint; expires_at: [] | [bigint] }>(
          tokenActor.icrc2_allowance({
            account: { owner: principal, subaccount: [] },
            spender: { owner: Principal.fromText(routerCanisterId), subaccount: [] },
          }),
          20_000,
          'Check allowance'
        );

        // Check if allowance is sufficient
        const hasAllowance = allowance.allowance >= requiredAllowance;
        setNeedsApproval(!hasAllowance);
        setTokenStandard('icrc2');
      } catch (err) {
        if (isMethodNotFound(err)) {
          setNeedsApproval(false);
          setTokenStandard('icrc1');
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error('Approval check error:', err);
      // Assume approval needed if check fails
      setNeedsApproval(true);
    } finally {
      setIsCheckingApproval(false);
    }
  }, [
    enabled,
    isConnected,
    principal,
    tokenIn,
    tokenOut,
    amountIn,
    poolId,
    routerCanisterId,
    getAnonTokenActor,
    lastApprovalParams,
    withTimeout,
  ]);

  /**
   * Approve token transfer
   */
  const approve = useCallback(async () => {
    if (!isConnected || !principal || !amountIn || amountIn <= 0n || !poolId) {
      throw new Error('Invalid approval parameters');
    }

    try {
      setIsApproving(true);
      setError(null);

      if (!routerCanisterId) {
        throw new Error('Router canister ID not configured');
      }

      if (tokenStandard === 'icrc1') {
        setNeedsApproval(false);
        return;
      }

      const tokenActor = tokenActorRef.current;
      if (!tokenActor) {
        throw new Error('Wallet actor not ready. Try again in a moment.');
      }
      const ledgerFee = tokenInFeeLoaded ? tokenInLedgerFee : 0n;
      const baseApproval = amountIn + ledgerFee;
      const approvalAmount =
        approvalMode === 'max' ? (amountIn * 2n) + ledgerFee : baseApproval;

      try {
        const approvePromise = tokenActor.icrc2_approve({
          from_subaccount: [],
          spender: { owner: Principal.fromText(routerCanisterId), subaccount: [] },
          amount: approvalAmount,
          expected_allowance: [],
          expires_at: [],
          fee: [],
          memo: [],
          created_at_time: [],
        });
        const result = await withTimeout<{ Ok: bigint } | { Err: unknown }>(
          approvePromise,
          120_000,
          'Approve'
        );

        if ('Ok' in result) {
          setNeedsApproval(false);
          setTokenStandard('icrc2');
        } else if ('Err' in result) {
          throw new Error(`Approval failed: ${JSON.stringify(result.Err)}`);
        }
      } catch (err) {
        if (isMethodNotFound(err)) {
          setNeedsApproval(false);
          setTokenStandard('icrc1');
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error('Approval error:', err);
      const errorMsg = normalizeWalletError(err) || 'Failed to approve tokens';
      setError(new Error(errorMsg));
      throw err;
    } finally {
      setIsApproving(false);
    }
  }, [
    isConnected,
    principal,
    tokenIn,
    tokenOut,
    amountIn,
    poolId,
    routerCanisterId,
    tokenStandard,
    getActor,
    tokenInFeeLoaded,
    tokenInLedgerFee,
    approvalMode,
    withTimeout,
  ]);

  /**
   * Execute swap
   */
  const swap = useCallback(
    async (slippageBps: number, quote: QuoteResult): Promise<bigint> => {
      if (!isConnected || !principal || !amountIn || amountIn <= 0n || !poolId) {
        throw new Error('Invalid swap parameters');
      }

      try {
        setIsSwapping(true);
        setError(null);
        setTxHash(null);

        if (!routerCanisterId) {
          throw new Error('Router canister ID not configured');
        }

        const { resolvedZeroForOne, tokenOutFee } = await getTokenFeesForSwap(
          poolId,
          tokenIn,
          tokenOut
        );

        // Calculate minimum output with slippage
        const slippageMultiplier = BigInt(10000 - slippageBps);
        const amountOutMinimum = (quote.amount_out * slippageMultiplier) / 10000n;

        if (tokenStandard === 'icrc1') {
          const result = await performIcrc1Swap(
            poolId,
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMinimum,
            resolvedZeroForOne
          );
          recordSwapTokens(tokenIn, tokenOut);
          setTxHash('success');
          return result;
        }

        try {
          const routerActor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
          const result = await withTimeout<{ Ok: { amount_out: bigint } } | { Err: unknown }>(
            routerActor.swap({
              token_in: Principal.fromText(tokenIn),
              token_out: Principal.fromText(tokenOut),
              amount_in: amountIn,
              amount_out_minimum: amountOutMinimum,
              pool_id: Principal.fromText(poolId),
              zero_for_one: resolvedZeroForOne,
            }),
            120_000,
            'Router swap'
          );

          if ('Ok' in result) {
            recordSwapTokens(tokenIn, tokenOut);
            setTxHash('success');
            const rawOut = result.Ok.amount_out;
            let netOut = rawOut;

            if (tokenOutFee > 0n) {
              netOut = netOut > tokenOutFee ? netOut - tokenOutFee : 0n;
            }

            const ledgerOutFee = await getLedgerFee(tokenOut);
            const isIcpOut = tokenOut === 'ryjl3-tyaaa-aaaaa-aaaba-cai';
            if (isIcpOut && netOut > 0n) {
              const routerFeeOut = (netOut * 100n) / 10000n;
              netOut = netOut > routerFeeOut ? netOut - routerFeeOut : 0n;
            }
            if (ledgerOutFee > 0n) {
              netOut = netOut > ledgerOutFee ? netOut - ledgerOutFee : 0n;
            }

            return netOut;
          }

          if ('Err' in result) {
            const errorMsg = formatRouterError(result.Err);
            if (isUnsupportedTokenError(result.Err)) {
              setTokenStandard('icrc1');
              const fallbackResult = await performIcrc1Swap(
                poolId,
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMinimum,
                resolvedZeroForOne
              );
              recordSwapTokens(tokenIn, tokenOut);
              setTxHash('success');
              return fallbackResult;
            }
            throw new Error(errorMsg);
          }
        } catch (err) {
          if (isMethodNotFound(err)) {
            setTokenStandard('icrc1');
            const fallbackResult = await performIcrc1Swap(
              poolId,
              tokenIn,
              tokenOut,
              amountIn,
              amountOutMinimum,
              resolvedZeroForOne
            );
            recordSwapTokens(tokenIn, tokenOut);
            setTxHash('success');
            return fallbackResult;
          }
          throw err;
        }

        throw new Error('Unknown swap result');
    } catch (err) {
      console.error('Swap error:', err);
      const errorMsg = normalizeWalletError(err) || 'Failed to execute swap';
      setError(new Error(errorMsg));
      throw err;
      } finally {
        setIsSwapping(false);
      }
    },
    [
      isConnected,
      principal,
      tokenIn,
      tokenOut,
      amountIn,
      poolId,
      getActor,
      getTokenFeesForSwap,
      tokenStandard,
      performIcrc1Swap,
      routerCanisterId,
      recordSwapTokens,
    ]
  );

  // Check approval only when amount or token changes significantly
  useEffect(() => {
    if (enabled && amountIn && amountIn > 0n && !isApproving && !isSwapping) {
      const timer = setTimeout(() => {
        checkApproval();
      }, 400);
      return () => clearTimeout(timer);
    }
    return;
  }, [enabled, amountIn, isApproving, isSwapping, tokenIn, tokenOut, poolId, checkApproval]);

  return {
    needsApproval,
    isCheckingApproval,
    approve,
    isApproving,
    swap,
    isSwapping,
    error,
    txHash,
    getPendingRefund,
    withdrawPendingRefund,
    withdrawFromRouter,
    tokenInLedgerFee,
    tokenInFeeLoaded,
  };
}

/**
 * Format canister error for display
 */
function formatError(error: any): string {
  if ('CommonError' in error) {
    return 'Swap failed due to a common error';
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
  if ('InsufficientBalance' in error) {
    return `Insufficient balance. Required: ${error.InsufficientBalance.required}`;
  }
  if ('InsufficientAllowance' in error) {
    return `Insufficient allowance. Required: ${error.InsufficientAllowance.required}`;
  }
  if ('SlippageExceeded' in error) {
    return 'Slippage exceeded';
  }
  if ('TransferFailed' in error) {
    return `Transfer failed: ${error.TransferFailed.reason}`;
  }
  if ('InvalidArguments' in error) {
    return `Invalid arguments: ${error.InvalidArguments.reason}`;
  }
  if ('PoolNotFound' in error) return 'Pool not found';
  if ('UnsupportedToken' in error) return `Unsupported token: ${error.UnsupportedToken.token}`;
  if ('CanisterCallFailed' in error) {
    return `Canister call failed: ${error.CanisterCallFailed.reason}`;
  }
  if ('InternalError' in error) return `Internal error: ${error.InternalError.reason}`;
  return 'Unknown error occurred';
}

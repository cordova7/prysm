import { useCallback, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import { PRYSM_ROUTER_IDL } from '@/lib/wallet/actors';
import type { TokenAmounts } from '@/lib/wallet/actors';

type ResultVariant<T> = { Ok: T } | { Err: unknown };

interface PoolActionsReturn {
  isWorking: boolean;
  error: Error | null;
  clearError: () => void;
  addLimitOrder: (args: { poolId: string; positionId: bigint; tickLimit: bigint }) => Promise<boolean>;
  removeLimitOrder: (args: { poolId: string; positionId: bigint }) => Promise<boolean>;
  mintPosition: (args: {
    poolId: string;
    fee: bigint;
    tickLower: bigint;
    tickUpper: bigint;
    token0: string;
    token1: string;
    amount0Desired: bigint;
    amount1Desired: bigint;
  }) => Promise<bigint>;
  increaseLiquidity: (args: {
    poolId: string;
    positionId: bigint;
    amount0Desired: bigint;
    amount1Desired: bigint;
  }) => Promise<bigint>;
  decreaseLiquidity: (args: { poolId: string; positionId: bigint; liquidity: bigint }) => Promise<TokenAmounts>;
  claimPosition: (args: { poolId: string; positionId: bigint }) => Promise<TokenAmounts>;
}

const formatRouterError = (err: unknown) => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export function usePoolActions(): PoolActionsReturn {
  const { getActor, isConnected } = useWallet();
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;

  const getRouterActor = useCallback(async () => {
    if (!routerCanisterId) {
      throw new Error('Router canister ID not configured');
    }
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }
    return (await getActor(routerCanisterId, PRYSM_ROUTER_IDL)) as any;
  }, [getActor, isConnected, routerCanisterId]);

  const unwrapResult = <T,>(result: ResultVariant<T>) => {
    if ('Ok' in result) {
      return result.Ok;
    }
    throw new Error(formatRouterError(result.Err));
  };

  const toPrincipal = (value: string) => Principal.fromText(value);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      setIsWorking(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const formatted = err instanceof Error ? err : new Error(formatRouterError(err));
        setError(formatted);
        throw formatted;
      } finally {
        setIsWorking(false);
      }
    },
    []
  );

  const addLimitOrder = useCallback(
    async ({ poolId, positionId, tickLimit }: { poolId: string; positionId: bigint; tickLimit: bigint }) =>
      run(async () => {
        const actor = await getRouterActor();
        const result: ResultVariant<boolean> = await actor.add_limit_order({
          pool_id: toPrincipal(poolId),
          position_id: positionId,
          tick_limit: tickLimit,
        });
        return unwrapResult(result);
      }),
    [getRouterActor, run]
  );

  const removeLimitOrder = useCallback(
    async ({ poolId, positionId }: { poolId: string; positionId: bigint }) =>
      run(async () => {
        const actor = await getRouterActor();
        const result: ResultVariant<boolean> = await actor.remove_limit_order({
          pool_id: toPrincipal(poolId),
          position_id: positionId,
        });
        return unwrapResult(result);
      }),
    [getRouterActor, run]
  );

  const mintPosition = useCallback(
    async ({
      poolId,
      fee,
      tickLower,
      tickUpper,
      token0,
      token1,
      amount0Desired,
      amount1Desired,
    }: {
      poolId: string;
      fee: bigint;
      tickLower: bigint;
      tickUpper: bigint;
      token0: string;
      token1: string;
      amount0Desired: bigint;
      amount1Desired: bigint;
    }) =>
      run(async () => {
        const actor = await getRouterActor();
        const result: ResultVariant<bigint> = await actor.mint_position({
          pool_id: toPrincipal(poolId),
          fee,
          tick_lower: tickLower,
          tick_upper: tickUpper,
          token0: toPrincipal(token0),
          token1: toPrincipal(token1),
          amount0_desired: amount0Desired,
          amount1_desired: amount1Desired,
        });
        return unwrapResult(result);
      }),
    [getRouterActor, run]
  );

  const increaseLiquidity = useCallback(
    async ({
      poolId,
      positionId,
      amount0Desired,
      amount1Desired,
    }: {
      poolId: string;
      positionId: bigint;
      amount0Desired: bigint;
      amount1Desired: bigint;
    }) =>
      run(async () => {
        const actor = await getRouterActor();
        const result: ResultVariant<bigint> = await actor.increase_liquidity({
          pool_id: toPrincipal(poolId),
          position_id: positionId,
          amount0_desired: amount0Desired,
          amount1_desired: amount1Desired,
        });
        return unwrapResult(result);
      }),
    [getRouterActor, run]
  );

  const decreaseLiquidity = useCallback(
    async ({ poolId, positionId, liquidity }: { poolId: string; positionId: bigint; liquidity: bigint }) =>
      run(async () => {
        const actor = await getRouterActor();
        const result: ResultVariant<TokenAmounts> = await actor.decrease_liquidity({
          pool_id: toPrincipal(poolId),
          position_id: positionId,
          liquidity,
        });
        return unwrapResult(result);
      }),
    [getRouterActor, run]
  );

  const claimPosition = useCallback(
    async ({ poolId, positionId }: { poolId: string; positionId: bigint }) =>
      run(async () => {
        const actor = await getRouterActor();
        const result: ResultVariant<TokenAmounts> = await actor.claim_position({
          pool_id: toPrincipal(poolId),
          position_id: positionId,
        });
        return unwrapResult(result);
      }),
    [getRouterActor, run]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    isWorking,
    error,
    clearError,
    addLimitOrder,
    removeLimitOrder,
    mintPosition,
    increaseLiquidity,
    decreaseLiquidity,
    claimPosition,
  };
}

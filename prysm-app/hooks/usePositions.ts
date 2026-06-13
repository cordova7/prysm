import { useCallback, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import { ICPSWAP_POOL_IDL } from '@/lib/wallet/actors/icpswap-pool.idl';
import type {
  UserPositionInfo,
  UserPositionWithTokenAmount,
  RefreshIncomeResult,
  UserPositionsResult,
  UserPositionResult,
  UserPositionWithTokenAmountResult,
  RefreshIncomeResultType,
  UserBalanceResult,
  PoolError,
} from '@/lib/wallet/actors/icpswap-pool.idl';

interface UsePositionsReturn {
  isLoading: boolean;
  error: Error | null;
  clearError: () => void;

  // Position queries
  getUserPositions: (poolId: string, offset?: number, limit?: number) => Promise<UserPositionInfo[]>;
  getUserPosition: (poolId: string, positionId: bigint) => Promise<UserPositionInfo>;
  getUserPositionWithTokenAmount: (poolId: string, positionId: bigint) => Promise<UserPositionWithTokenAmount>;
  getUserPositionIds: (poolId: string) => Promise<bigint[]>;

  // Income management
  refreshIncome: (poolId: string, positionId: bigint) => Promise<RefreshIncomeResult>;
  batchRefreshIncome: (poolId: string, positionIds: bigint[]) => Promise<RefreshIncomeResult[]>;

  // Ownership checks
  getUserByPositionId: (poolId: string, positionId: bigint) => Promise<Principal>;
  checkOwnerOfUserPosition: (poolId: string, user: Principal, positionId: bigint) => Promise<boolean>;

  // Balance queries
  getUserUnusedBalance: (poolId: string, user?: Principal) => Promise<{ balance0: bigint; balance1: bigint }>;
}

const formatPoolError = (err: PoolError): string => {
  if ('CommonError' in err) return 'Common error occurred';
  if ('InsufficientFunds' in err) return 'Insufficient funds';
  if ('InternalError' in err) return `Internal error: ${err.InternalError}`;
  if ('UnsupportedToken' in err) return `Unsupported token: ${err.UnsupportedToken}`;
  return 'Unknown error';
};

export function usePositions(): UsePositionsReturn {
  const { getActor, isConnected, principal } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getPoolActor = useCallback(
    async (poolId: string) => {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      return (await getActor(poolId, ICPSWAP_POOL_IDL)) as any;
    },
    [getActor, isConnected]
  );

  const unwrapResult = <T,>(result: { ok: T } | { err: PoolError }, context?: string): T => {
    if ('ok' in result) {
      return result.ok;
    }
    const errorMsg = formatPoolError(result.err);
    throw new Error(context ? `${context}: ${errorMsg}` : errorMsg);
  };

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, context?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const formatted = err instanceof Error ? err : new Error(String(err));
        setError(formatted);
        console.error(context || 'Position operation failed:', formatted);
        throw formatted;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getUserPositions = useCallback(
    async (poolId: string, offset: number = 0, limit: number = 100) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: UserPositionsResult = await actor.getUserPositions(BigInt(offset), BigInt(limit));
        return unwrapResult(result, 'Get user positions');
      }, 'getUserPositions'),
    [getPoolActor, run]
  );

  const getUserPosition = useCallback(
    async (poolId: string, positionId: bigint) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: UserPositionResult = await actor.getUserPosition(positionId);
        return unwrapResult(result, 'Get user position');
      }, 'getUserPosition'),
    [getPoolActor, run]
  );

  const getUserPositionWithTokenAmount = useCallback(
    async (poolId: string, positionId: bigint) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: UserPositionWithTokenAmountResult = await actor.getUserPositionWithTokenAmount(positionId);
        return unwrapResult(result, 'Get position with token amount');
      }, 'getUserPositionWithTokenAmount'),
    [getPoolActor, run]
  );

  const getUserPositionIds = useCallback(
    async (poolId: string) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: bigint[] = await actor.getUserPositionIds();
        return result;
      }, 'getUserPositionIds'),
    [getPoolActor, run]
  );

  const refreshIncome = useCallback(
    async (poolId: string, positionId: bigint) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: RefreshIncomeResultType = await actor.refreshIncome(positionId);
        return unwrapResult(result, 'Refresh income');
      }, 'refreshIncome'),
    [getPoolActor, run]
  );

  const batchRefreshIncome = useCallback(
    async (poolId: string, positionIds: bigint[]) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const results: RefreshIncomeResultType[] = await actor.batchRefreshIncome(positionIds);
        return results.map((result, idx) =>
          unwrapResult(result, `Refresh income for position ${positionIds[idx]}`)
        );
      }, 'batchRefreshIncome'),
    [getPoolActor, run]
  );

  const getUserByPositionId = useCallback(
    async (poolId: string, positionId: bigint) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: { ok: Principal } | { err: PoolError } = await actor.getUserByPositionId(positionId);
        return unwrapResult(result, 'Get position owner');
      }, 'getUserByPositionId'),
    [getPoolActor, run]
  );

  const checkOwnerOfUserPosition = useCallback(
    async (poolId: string, user: Principal, positionId: bigint) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const result: { ok: boolean } | { err: PoolError } = await actor.checkOwnerOfUserPosition(user, positionId);
        return unwrapResult(result, 'Check position ownership');
      }, 'checkOwnerOfUserPosition'),
    [getPoolActor, run]
  );

  const getUserUnusedBalance = useCallback(
    async (poolId: string, user?: Principal) =>
      run(async () => {
        const actor = await getPoolActor(poolId);
        const targetUser = user || principal;
        if (!targetUser) {
          throw new Error('No user principal provided or available');
        }
        const result: UserBalanceResult = await actor.getUserUnusedBalance(targetUser);
        return unwrapResult(result, 'Get unused balance');
      }, 'getUserUnusedBalance'),
    [getPoolActor, run, principal]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    clearError,
    getUserPositions,
    getUserPosition,
    getUserPositionWithTokenAmount,
    getUserPositionIds,
    refreshIncome,
    batchRefreshIncome,
    getUserByPositionId,
    checkOwnerOfUserPosition,
    getUserUnusedBalance,
  };
}

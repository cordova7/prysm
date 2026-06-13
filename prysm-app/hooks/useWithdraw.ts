import { useCallback, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import { PRYSM_ROUTER_IDL } from '@/lib/wallet/actors';
import type { WithdrawArgs as RouterWithdrawArgs, PrysmRouterError } from '@/lib/wallet/actors/prysm-router.idl';

type ResultVariant<T> = { Ok: T } | { Err: PrysmRouterError };

interface UseWithdrawReturn {
  isWithdrawing: boolean;
  error: Error | null;
  clearError: () => void;
  withdraw: (poolId: string, token: string, amount: bigint, fee: bigint) => Promise<bigint>;
}

const formatRouterError = (err: PrysmRouterError): string => {
  if ('Unauthorized' in err) return 'Unauthorized';
  if ('InsufficientBalance' in err) return `Insufficient balance: ${err.InsufficientBalance.available} available, ${err.InsufficientBalance.required} required`;
  if ('InsufficientAllowance' in err) return `Insufficient allowance: ${err.InsufficientAllowance.allowance} approved, ${err.InsufficientAllowance.required} required`;
  if ('TransferFailed' in err) return `Transfer failed: ${err.TransferFailed.reason}`;
  if ('InvalidArguments' in err) return `Invalid arguments: ${err.InvalidArguments.reason}`;
  if ('PoolNotFound' in err) return 'Pool not found';
  if ('UnsupportedToken' in err) return `Unsupported token: ${err.UnsupportedToken.token}`;
  if ('CanisterCallFailed' in err) return `Canister call failed: ${err.CanisterCallFailed.reason}`;
  if ('InternalError' in err) return `Internal error: ${err.InternalError.reason}`;
  return 'Unknown error';
};

export function useWithdraw(): UseWithdrawReturn {
  const { getActor, isConnected } = useWallet();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
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

  const unwrapResult = (result: ResultVariant<bigint>): bigint => {
    if ('Ok' in result) {
      return result.Ok;
    }
    const errorMsg = formatRouterError(result.Err);
    throw new Error(`Withdrawal failed: ${errorMsg}`);
  };

  const withdraw = useCallback(
    async (poolId: string, token: string, amount: bigint, fee: bigint) => {
      setIsWithdrawing(true);
      setError(null);
      try {
        const actor = await getRouterActor();
        const args: RouterWithdrawArgs = {
          pool_id: Principal.fromText(poolId),
          token: Principal.fromText(token),
          amount,
          fee,
        };
        const result: ResultVariant<bigint> = await actor.withdraw(args);
        return unwrapResult(result);
      } catch (err) {
        const formatted = err instanceof Error ? err : new Error(String(err));
        setError(formatted);
        console.error('Withdraw failed:', formatted);
        throw formatted;
      } finally {
        setIsWithdrawing(false);
      }
    },
    [getRouterActor]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    isWithdrawing,
    error,
    clearError,
    withdraw,
  };
}

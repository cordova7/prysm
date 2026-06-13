import { useCallback, useEffect, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { ICRC2_IDL } from '@/lib/wallet/actors';

interface UseTokenBalanceOptions {
  tokenId: string;
  owner: Principal | null;
  enabled?: boolean;
  refreshIntervalMs?: number;
}

interface UseTokenBalanceReturn {
  balance: bigint | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useTokenBalance({
  tokenId,
  owner,
  enabled = true,
  refreshIntervalMs = 20000,
}: UseTokenBalanceOptions): UseTokenBalanceReturn {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!enabled || !tokenId || !owner) {
      setBalance(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const actor = getAnonymousActor<any>(tokenId, ICRC2_IDL);
      const result = await actor.icrc1_balance_of({
        owner,
        subaccount: [],
      });
      setBalance(BigInt(result));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balance'));
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, owner, tokenId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    if (!refreshIntervalMs || !enabled) return;
    const timer = setInterval(fetchBalance, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [enabled, fetchBalance, refreshIntervalMs]);

  return {
    balance,
    isLoading,
    error,
    refresh: fetchBalance,
  };
}

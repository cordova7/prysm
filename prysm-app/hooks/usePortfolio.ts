import { useCallback, useEffect, useMemo, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { ICRC2_IDL, PRYSM_ROUTER_IDL } from '@/lib/wallet/actors';

type TokenSummary = {
  tokenLedgerId: string;
  symbol?: string;
  name?: string;
};

export type PortfolioEntry = {
  tokenId: string;
  symbol: string;
  name: string;
  balance: bigint;
  decimals: number;
  totalStaked: bigint;
  userStaked: bigint;
  userStakePercent: number;
  pendingRewards: bigint;
  lifetimeRewards: bigint;
};

type PortfolioState = {
  holdings: PortfolioEntry[];
  staked: PortfolioEntry[];
  isLoading: boolean;
  processed: number;
  total: number;
  pryDecimals: number;
};

const DEFAULT_DECIMALS = 8;
const CONCURRENCY = 6;

const runWithConcurrency = async <T,>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) => {
  let index = 0;
  const runners = new Array(limit).fill(0).map(async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
};

export function usePortfolio(
  tokens: TokenSummary[],
  principal: Principal | null,
  isConnected: boolean
): PortfolioState {
  const [holdings, setHoldings] = useState<PortfolioEntry[]>([]);
  const [staked, setStaked] = useState<PortfolioEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [pryDecimals, setPryDecimals] = useState(DEFAULT_DECIMALS);

  const reset = useCallback(() => {
    setHoldings([]);
    setStaked([]);
    setIsLoading(false);
    setProcessed(0);
    setTotal(0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!tokens?.length || !principal || !isConnected) {
      reset();
      return;
    }

    const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
    const pryLedgerId = process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID;
    if (!routerCanisterId) {
      reset();
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setProcessed(0);
      setTotal(tokens.length);

      if (pryLedgerId) {
        try {
          const pryActor = getAnonymousActor<any>(pryLedgerId, ICRC2_IDL);
          const decimals = await pryActor.icrc1_decimals();
          if (!cancelled && typeof decimals === 'number') {
            setPryDecimals(decimals);
          }
        } catch {
          // Default decimals
        }
      }

      const routerActor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const holdingMap = new Map<string, PortfolioEntry>();
      const stakedMap = new Map<string, PortfolioEntry>();

      const worker = async (token: TokenSummary) => {
        if (cancelled) return;
        const tokenId = token.tokenLedgerId;
        if (!tokenId) {
          setProcessed((count) => count + 1);
          return;
        }

        try {
          const tokenActor = getAnonymousActor<any>(tokenId, ICRC2_IDL);
          const balance = await tokenActor.icrc1_balance_of({
            owner: principal,
            subaccount: [],
          });

          const bucketOpt = await routerActor.get_token_bucket(Principal.fromText(tokenId));
          const totalStaked = bucketOpt?.length ? bucketOpt[0].total_staked : 0n;

          let userStaked = 0n;
          let pendingRewards = 0n;
          let lifetimeRewards = 0n;
          try {
            const stats = await routerActor.get_user_stats(principal, Principal.fromText(tokenId));
            userStaked = stats?.staked_amount ?? 0n;
            pendingRewards = stats?.pending_rewards ?? 0n;
            lifetimeRewards = stats?.lifetime_rewards ?? 0n;
          } catch {
            userStaked = 0n;
          }

          const userStakePercent =
            totalStaked > 0n ? Number((userStaked * 10000n) / totalStaked) / 100 : 0;

          const decimals = await tokenActor.icrc1_decimals().catch(() => DEFAULT_DECIMALS);
          const entry: PortfolioEntry = {
            tokenId,
            symbol: token.symbol || 'TOKEN',
            name: token.name || 'Token',
            balance,
            decimals: typeof decimals === 'number' ? decimals : DEFAULT_DECIMALS,
            totalStaked,
            userStaked,
            userStakePercent,
            pendingRewards,
            lifetimeRewards,
          };

          if (balance > 0n) {
            holdingMap.set(tokenId, entry);
          }
          if (totalStaked > 0n) {
            stakedMap.set(tokenId, entry);
          }
        } catch {
          // Ignore per-token failures
        } finally {
          setProcessed((count) => count + 1);
          if (cancelled) return;
          setHoldings(Array.from(holdingMap.values()));
          setStaked(Array.from(stakedMap.values()));
        }
      };

      await runWithConcurrency(tokens, CONCURRENCY, worker);
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tokens, principal, isConnected, reset]);

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => (a.balance > b.balance ? -1 : 1));
  }, [holdings]);

  const sortedStaked = useMemo(() => {
    return [...staked].sort((a, b) => (a.totalStaked > b.totalStaked ? -1 : 1));
  }, [staked]);

  return {
    holdings: sortedHoldings,
    staked: sortedStaked,
    isLoading,
    processed,
    total,
    pryDecimals,
  };
}

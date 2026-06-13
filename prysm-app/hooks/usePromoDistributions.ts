import { useState, useCallback, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import { PRYSM_ROUTER_IDL } from '@/lib/wallet/actors/prysm-router.idl';
import type { PromoDistribution, DistributionShare } from '@/lib/wallet/actors/prysm-router.idl';
import { getAnonymousActor } from '@/lib/wallet/anonymous';

interface UsePromoDistributionsReturn {
  // Distribution history
  distributions: PromoDistribution[];
  isLoadingDistributions: boolean;

  // User's distributions
  myDistributions: DistributionShare[];
  isLoadingMyDistributions: boolean;

  // User's total promo rewards
  myTotalRewards: bigint | null;
  isLoadingRewards: boolean;

  // Next distribution time
  nextDistributionTime: bigint | null;
  isLoadingNextTime: boolean;

  // Current period stats
  periodStats: Array<{ user: Principal; volume: bigint; trades: bigint }>;
  isLoadingStats: boolean;

  // Error state
  error: Error | null;

  // Refresh functions
  refresh: () => Promise<void>;
  loadMoreDistributions: () => Promise<void>;
}

export function usePromoDistributions(
  pageSize: number = 10,
  refreshInterval: number = 60000 // 60 seconds
): UsePromoDistributionsReturn {
  const { getActor, isConnected, principal } = useWallet();

  const [distributions, setDistributions] = useState<PromoDistribution[]>([]);
  const [isLoadingDistributions, setIsLoadingDistributions] = useState(false);
  const [distributionOffset, setDistributionOffset] = useState(0);

  const [myDistributions, setMyDistributions] = useState<DistributionShare[]>([]);
  const [isLoadingMyDistributions, setIsLoadingMyDistributions] = useState(false);

  const [myTotalRewards, setMyTotalRewards] = useState<bigint | null>(null);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);

  const [nextDistributionTime, setNextDistributionTime] = useState<bigint | null>(null);
  const [isLoadingNextTime, setIsLoadingNextTime] = useState(false);

  const [periodStats, setPeriodStats] = useState<Array<{ user: Principal; volume: bigint; trades: bigint }>>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const [error, setError] = useState<Error | null>(null);

  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;

  const fetchDistributionHistory = useCallback(async (offset: number = 0, append: boolean = false) => {
    if (!routerCanisterId) return;

    try {
      setIsLoadingDistributions(true);
      setError(null);
      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const history = await actor.get_distribution_history(BigInt(offset), BigInt(pageSize));

      if (append) {
        setDistributions(prev => [...prev, ...history]);
      } else {
        setDistributions(history);
      }
      setDistributionOffset(offset);
    } catch (err) {
      // Silently fail for expected errors (wallet not connected, canister not found)
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch distribution history:', err);
      }
      setError(err instanceof Error ? err : new Error('Failed to fetch distributions'));
    } finally {
      setIsLoadingDistributions(false);
    }
  }, [routerCanisterId, pageSize]);

  const fetchMyDistributions = useCallback(async () => {
    if (!isConnected || !routerCanisterId) {
      setMyDistributions([]);
      return;
    }

    try {
      setIsLoadingMyDistributions(true);
      setError(null);
      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const myDists = await actor.get_user_distributions(principal, 0n, 100n);
      setMyDistributions(myDists);
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch my distributions:', err);
      }
      setMyDistributions([]);
    } finally {
      setIsLoadingMyDistributions(false);
    }
  }, [isConnected, principal, routerCanisterId]);

  const fetchMyRewards = useCallback(async () => {
    if (!isConnected || !routerCanisterId) {
      setMyTotalRewards(null);
      return;
    }

    try {
      setIsLoadingRewards(true);
      setError(null);
      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const rewards = await actor.get_user_promo_rewards(principal);
      setMyTotalRewards(rewards);
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch my rewards:', err);
      }
      setMyTotalRewards(null);
    } finally {
      setIsLoadingRewards(false);
    }
  }, [isConnected, principal, routerCanisterId]);

  const fetchNextDistributionTime = useCallback(async () => {
    if (!routerCanisterId) return;

    try {
      setIsLoadingNextTime(true);
      setError(null);
      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const time = await actor.get_next_distribution_time();
      setNextDistributionTime(time);
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch next distribution time:', err);
      }
      setNextDistributionTime(null);
    } finally {
      setIsLoadingNextTime(false);
    }
  }, [routerCanisterId]);

  const fetchPeriodStats = useCallback(async () => {
    if (!routerCanisterId) return;

    try {
      setIsLoadingStats(true);
      setError(null);
      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const stats = await actor.get_period_trader_stats();

      const formatted = stats.map(([user, volume, trades]: [Principal, bigint, bigint]) => ({
        user,
        volume,
        trades,
      }));

      setPeriodStats(formatted);
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch period stats:', err);
      }
      setPeriodStats([]);
    } finally {
      setIsLoadingStats(false);
    }
  }, [routerCanisterId]);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchDistributionHistory(0, false),
      fetchMyDistributions(),
      fetchMyRewards(),
      fetchNextDistributionTime(),
      fetchPeriodStats(),
    ]);
  }, [
    fetchDistributionHistory,
    fetchMyDistributions,
    fetchMyRewards,
    fetchNextDistributionTime,
    fetchPeriodStats,
  ]);

  const loadMoreDistributions = useCallback(async () => {
    const newOffset = distributionOffset + pageSize;
    await fetchDistributionHistory(newOffset, true);
  }, [distributionOffset, pageSize, fetchDistributionHistory]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, refresh]);

  return {
    distributions,
    isLoadingDistributions,
    myDistributions,
    isLoadingMyDistributions,
    myTotalRewards,
    isLoadingRewards,
    nextDistributionTime,
    isLoadingNextTime,
    periodStats,
    isLoadingStats,
    error,
    refresh,
    loadMoreDistributions,
  };
}

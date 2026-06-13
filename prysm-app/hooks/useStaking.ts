/**
 * Staking hook
 * Handles stake, unstake, and claim operations for PRY tokens
 */
import { useState, useCallback, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import {
  PRYSM_ROUTER_IDL,
  ICRC2_IDL,
  type UserStake,
  type UserStakingStats,
  type TokenFeeBucket,
} from '@/lib/wallet/actors';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { addImportedToken } from '@/lib/portfolio-store';

interface UseStakingOptions {
  tokenId: string;
  enabled?: boolean;
  refreshInterval?: number;
}

interface UseStakingReturn {
  // User stake info
  userStake: UserStake | null;
  userStats: UserStakingStats | null;

  // Token bucket info
  tokenBucket: TokenFeeBucket | null;

  // Loading states
  isLoadingStake: boolean;
  isLoadingStats: boolean;
  isLoadingBucket: boolean;

  // Operations
  stake: (amount: bigint) => Promise<void>;
  unstake: (amount: bigint) => Promise<void>;
  claimRewards: () => Promise<bigint>;

  // Operation states
  isStaking: boolean;
  isUnstaking: boolean;
  isClaiming: boolean;

  // Error state
  error: Error | null;

  // Refresh
  refresh: () => Promise<void>;
}

/**
 * Hook for staking operations
 */
export function useStaking({
  tokenId,
  enabled = true,
  refreshInterval = 30000, // 30 seconds
}: UseStakingOptions): UseStakingReturn {
  const { getActor, isConnected, principal } = useWallet();

  const [userStake, setUserStake] = useState<UserStake | null>(null);
  const [userStats, setUserStats] = useState<UserStakingStats | null>(null);
  const [tokenBucket, setTokenBucket] = useState<TokenFeeBucket | null>(null);

  const [isLoadingStake, setIsLoadingStake] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingBucket, setIsLoadingBucket] = useState(false);

  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const [error, setError] = useState<Error | null>(null);
  const getLedgerFee = useCallback(
    async (ledgerId: string): Promise<bigint> => {
      const actor = getAnonymousActor<any>(ledgerId, ICRC2_IDL);
      try {
        return await actor.icrc1_fee();
      } catch {
        return 0n;
      }
    },
    []
  );

  /**
   * Fetch user stake info
   */
  const fetchUserStake = useCallback(async () => {
    if (!enabled || !isConnected || !principal) {
      setUserStake(null);
      return;
    }

    try {
      setIsLoadingStake(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const result = await actor.get_user_stake(principal, Principal.fromText(tokenId));

      if (result.length > 0) {
        setUserStake(result[0]);
      } else {
        setUserStake(null);
      }
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch user stake:', err);
      }
      setUserStake(null);
    } finally {
      setIsLoadingStake(false);
    }
  }, [enabled, isConnected, principal, tokenId]);

  /**
   * Fetch user staking stats
   */
  const fetchUserStats = useCallback(async () => {
    if (!enabled || !isConnected || !principal) {
      setUserStats(null);
      return;
    }

    try {
      setIsLoadingStats(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const stats = await actor.get_user_stats(principal, Principal.fromText(tokenId));

      setUserStats(stats);
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch user stats:', err);
      }
      setUserStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [enabled, isConnected, principal, tokenId]);

  /**
   * Fetch token bucket info
   */
  const fetchTokenBucket = useCallback(async () => {
    if (!enabled) {
      setTokenBucket(null);
      return;
    }

    try {
      setIsLoadingBucket(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const result = await actor.get_token_bucket(Principal.fromText(tokenId));

      if (result.length > 0) {
        setTokenBucket(result[0]);
      } else {
        setTokenBucket(null);
      }
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch token bucket:', err);
      }
      setTokenBucket(null);
    } finally {
      setIsLoadingBucket(false);
    }
  }, [enabled, tokenId]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchUserStake(),
      fetchUserStats(),
      fetchTokenBucket(),
    ]);
  }, [fetchUserStake, fetchUserStats, fetchTokenBucket]);

  /**
   * Stake PRY tokens
   */
  const stake = useCallback(async (amount: bigint) => {
    if (!isConnected || !principal || amount <= 0n) {
      throw new Error('Invalid stake parameters');
    }

    try {
      setIsStaking(true);
      setError(null);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      const pryLedgerId = process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID;

      if (!routerCanisterId || !pryLedgerId) {
        throw new Error('Canister IDs not configured');
      }

      // Step 1: Approve PRY transfer
      const pryActor = await getActor(pryLedgerId, ICRC2_IDL) as any;

      const fee = await getLedgerFee(pryLedgerId);
      const approvalAmount = amount + fee;
      const approvalResult = await pryActor.icrc2_approve({
        from_subaccount: [],
        spender: { owner: Principal.fromText(routerCanisterId), subaccount: [] },
        amount: approvalAmount,
        expected_allowance: [],
        expires_at: [],
        fee: [],
        memo: [],
        created_at_time: [],
      });

      if ('Err' in approvalResult) {
        throw new Error(`Approval failed: ${JSON.stringify(approvalResult.Err)}`);
      }

      // Step 2: Call stake on router
      const routerActor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const stakeResult = await routerActor.stake(Principal.fromText(tokenId), amount);

      if ('Err' in stakeResult) {
        throw new Error(formatError(stakeResult.Err));
      }

      addImportedToken(tokenId, principal.toText());

      // Refresh data
      await refresh();
    } catch (err) {
      console.error('Stake error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to stake tokens';
      setError(new Error(errorMsg));
      throw err;
    } finally {
      setIsStaking(false);
    }
  }, [isConnected, principal, tokenId, getActor, refresh, getLedgerFee]);

  /**
   * Unstake PRY tokens
   */
  const unstake = useCallback(async (amount: bigint) => {
    if (!isConnected || !principal || amount <= 0n) {
      throw new Error('Invalid unstake parameters');
    }

    try {
      setIsUnstaking(true);
      setError(null);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const result = await actor.unstake(Principal.fromText(tokenId), amount);

      if ('Err' in result) {
        throw new Error(formatError(result.Err));
      }

      // Refresh data
      await refresh();
    } catch (err) {
      console.error('Unstake error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to unstake tokens';
      setError(new Error(errorMsg));
      throw err;
    } finally {
      setIsUnstaking(false);
    }
  }, [isConnected, principal, tokenId, getActor, refresh]);

  /**
   * Claim rewards
   */
  const claimRewards = useCallback(async (): Promise<bigint> => {
    if (!isConnected || !principal) {
      throw new Error('Wallet not connected');
    }

    try {
      setIsClaiming(true);
      setError(null);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const result = await actor.claim_rewards(Principal.fromText(tokenId));

      if ('Ok' in result) {
        const claimedAmount = result.Ok;

        // Refresh data
        await refresh();

        return claimedAmount;
      } else if ('Err' in result) {
        throw new Error(formatError(result.Err));
      }

      throw new Error('Unknown claim result');
    } catch (err) {
      console.error('Claim error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to claim rewards';
      setError(new Error(errorMsg));
      throw err;
    } finally {
      setIsClaiming(false);
    }
  }, [isConnected, principal, tokenId, getActor, refresh]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      refresh();
    }
  }, [enabled, refresh]);

  // Set up refresh interval
  useEffect(() => {
    if (!enabled || !refreshInterval) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enabled, refreshInterval, refresh]);

  return {
    userStake,
    userStats,
    tokenBucket,
    isLoadingStake,
    isLoadingStats,
    isLoadingBucket,
    stake,
    unstake,
    claimRewards,
    isStaking,
    isUnstaking,
    isClaiming,
    error,
    refresh,
  };
}

/**
 * Format canister error for display
 */
function formatError(error: any): string {
  if ('InsufficientBalance' in error) {
    return `Insufficient balance. Required: ${error.InsufficientBalance.required}, Available: ${error.InsufficientBalance.available}`;
  }
  if ('Unauthorized' in error) {
    return 'Unauthorized';
  }
  if ('InvalidArguments' in error) {
    return `Invalid arguments: ${error.InvalidArguments.reason}`;
  }
  if ('InternalError' in error) {
    return `Internal error: ${error.InternalError.reason}`;
  }
  if ('TransferFailed' in error) {
    return `Transfer failed: ${error.TransferFailed.reason}`;
  }
  return 'Unknown error occurred';
}

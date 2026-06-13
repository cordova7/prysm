/**
 * Promotions hook
 * Handles bidding for token exposure and fetching promoted token
 */
import { useState, useCallback, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useWallet } from '@/contexts/WalletContext';
import { PRYSM_ROUTER_IDL, ICRC2_IDL, type PromoBid, type ActivePromoBid } from '@/lib/wallet/actors';
import { getAnonymousActor } from '@/lib/wallet/anonymous';

interface UsePromotionsReturn {
  // Current promoted token
  promotedTokenId: string | null;
  isLoadingPromoted: boolean;

  // Promo pool balance
  promoPoolBalance: bigint | null;
  isLoadingPool: boolean;

  // Bidding
  bidForExposure: (tokenId: string, amount: bigint, duration: bigint) => Promise<void>;
  isBidding: boolean;

  // Current winning bid
  activePromoBid: ActivePromoBid | null;

  // Refundable bids
  refundableBids: PromoBid[];
  refundableTotal: bigint;
  isLoadingRefundable: boolean;
  claimRefunds: () => Promise<void>;
  isClaiming: boolean;

  // All user bids
  myBids: PromoBid[];
  isLoadingBids: boolean;

  // Error state
  error: Error | null;

  // Refresh
  refresh: () => Promise<void>;
}

/**
 * Hook for promotion operations
 */
export function usePromotions(refreshInterval: number = 60000): UsePromotionsReturn {
  const { getActor, isConnected, principal } = useWallet();

  const [promotedTokenId, setPromotedTokenId] = useState<string | null>(null);
  const [isLoadingPromoted, setIsLoadingPromoted] = useState(false);

  const [promoPoolBalance, setPromoPoolBalance] = useState<bigint | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);

  const [isBidding, setIsBidding] = useState(false);
  const [activePromoBid, setActivePromoBid] = useState<ActivePromoBid | null>(null);

  const [refundableBids, setRefundableBids] = useState<PromoBid[]>([]);
  const [isLoadingRefundable, setIsLoadingRefundable] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const [myBids, setMyBids] = useState<PromoBid[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [refundableTotal, setRefundableTotal] = useState<bigint>(0n);

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
   * Fetch currently promoted token
   */
  const fetchPromotedToken = useCallback(async () => {
    try {
      setIsLoadingPromoted(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const result = await actor.get_promoted_token();

      if (result.length > 0) {
        setPromotedTokenId(result[0].toString());
      } else {
        setPromotedTokenId(null);
      }
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch promoted token:', err);
      }
      setPromotedTokenId(null);
    } finally {
      setIsLoadingPromoted(false);
    }
  }, []);

  /**
   * Fetch promo pool balance
   */
  const fetchPromoPool = useCallback(async () => {
    try {
      setIsLoadingPool(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const balance = await actor.get_promo_pool();

      setPromoPoolBalance(balance);
    } catch (err) {
      // Silently fail for expected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch promo pool:', err);
      }
      setPromoPoolBalance(null);
    } finally {
      setIsLoadingPool(false);
    }
  }, []);

  /**
   * Fetch current winning bid
   */
  const fetchActivePromoBid = useCallback(async () => {
    try {
      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const result = await actor.get_active_promo_bid();

      if (result.length > 0) {
        setActivePromoBid(result[0]);
      } else {
        setActivePromoBid(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch active promo bid:', err);
      }
      setActivePromoBid(null);
    }
  }, []);

  /**
   * Fetch refundable bids
   */
  const fetchRefundableBids = useCallback(async () => {
    if (!isConnected || !principal) {
      setRefundableBids([]);
      return;
    }

    try {
      setIsLoadingRefundable(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const bids = await actor.get_user_refundable_bids(principal);

      setRefundableBids(bids);
      const total = bids.reduce((sum: bigint, bid: PromoBid) => sum + (bid.bid_amount / 2n), 0n);
      setRefundableTotal(total);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch refundable bids:', err);
      }
      setRefundableBids([]);
      setRefundableTotal(0n);
    } finally {
      setIsLoadingRefundable(false);
    }
  }, [isConnected, principal]);

  /**
   * Fetch all user bids
   */
  const fetchMyBids = useCallback(async () => {
    if (!isConnected || !principal) {
      setMyBids([]);
      return;
    }

    try {
      setIsLoadingBids(true);

      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (!routerCanisterId) {
        throw new Error('PRYSM Router canister ID not configured');
      }

      const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const bids = await actor.get_user_bids(principal);

      setMyBids(bids);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes('Wallet not connected') && !errorMsg.includes('canister_not_found')) {
        console.error('Failed to fetch my bids:', err);
      }
      setMyBids([]);
    } finally {
      setIsLoadingBids(false);
    }
  }, [isConnected, principal]);

  /**
   * Claim refunds for losing/expired bids
   */
  const claimRefunds = useCallback(async () => {
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
      const result = await actor.claim_bid_refunds();

      if ('Ok' in result) {
        const refunds = result.Ok;
        console.log('Claimed refunds:', refunds);

        // Refresh data
        await Promise.all([fetchRefundableBids(), fetchMyBids(), fetchPromoPool()]);
      } else if ('Err' in result) {
        throw new Error(formatError(result.Err));
      }
    } catch (err) {
      console.error('Claim refunds error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to claim refunds';
      setError(new Error(errorMsg));
      throw err;
    } finally {
      setIsClaiming(false);
    }
  }, [isConnected, principal, getActor, fetchRefundableBids, fetchMyBids, fetchPromoPool]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchPromotedToken(),
      fetchPromoPool(),
      fetchActivePromoBid(),
      fetchRefundableBids(),
      fetchMyBids(),
    ]);
  }, [fetchPromotedToken, fetchPromoPool, fetchActivePromoBid, fetchRefundableBids, fetchMyBids]);

  /**
   * Bid for token exposure
   */
  const bidForExposure = useCallback(
    async (tokenId: string, amount: bigint, duration: bigint) => {
      if (!isConnected || !principal || amount <= 0n) {
        throw new Error('Invalid bid parameters');
      }

      try {
        setIsBidding(true);
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

        // Step 2: Submit bid
        const routerActor = await getActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
        const bidResult = await routerActor.bid_for_exposure(
          Principal.fromText(tokenId),
          amount,
          duration
        );

        if ('Err' in bidResult) {
          throw new Error(formatError(bidResult.Err));
        }

        // Refresh data
        await refresh();
      } catch (err) {
        console.error('Bid error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to submit bid';
        setError(new Error(errorMsg));
        throw err;
      } finally {
        setIsBidding(false);
      }
    },
    [isConnected, principal, getActor, refresh, getLedgerFee]
  );

  // Fetch data on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, refresh]);

  return {
    promotedTokenId,
    isLoadingPromoted,
    promoPoolBalance,
    isLoadingPool,
    bidForExposure,
    isBidding,
    activePromoBid,
    refundableBids,
    refundableTotal,
    isLoadingRefundable,
    claimRefunds,
    isClaiming,
    myBids,
    isLoadingBids,
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

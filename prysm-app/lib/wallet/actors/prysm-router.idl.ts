/**
 * PRYSM Router Canister IDL
 * Generated from prysm_router.did
 */
import { IDL } from '@dfinity/candid';

export const PRYSM_ROUTER_IDL: IDL.InterfaceFactory = ({ IDL }) => {
  const TokenId = IDL.Principal;

  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });

  // Swap types
  const SwapArgs = IDL.Record({
    token_in: TokenId,
    token_out: TokenId,
    amount_in: IDL.Nat,
    amount_out_minimum: IDL.Nat,
    pool_id: IDL.Principal,
    zero_for_one: IDL.Bool,
  });

  const SwapResult = IDL.Record({
    amount_out: IDL.Nat,
    fee_amount: IDL.Nat,
    token_in: TokenId,
    token_out: TokenId,
  });

  const QuoteArgs = IDL.Record({
    pool_id: IDL.Principal,
    zero_for_one: IDL.Bool,
    amount_in: IDL.Nat,
  });

  const QuoteResult = IDL.Record({
    amount_out: IDL.Nat,
    price_impact: IDL.Opt(IDL.Float64),
  });

  // Pool action types
  const AddLimitOrderArgs = IDL.Record({
    pool_id: IDL.Principal,
    position_id: IDL.Nat,
    tick_limit: IDL.Int,
  });

  const RemoveLimitOrderArgs = IDL.Record({
    pool_id: IDL.Principal,
    position_id: IDL.Nat,
  });

  const MintPositionArgs = IDL.Record({
    pool_id: IDL.Principal,
    fee: IDL.Nat,
    tick_lower: IDL.Int,
    tick_upper: IDL.Int,
    token0: IDL.Principal,
    token1: IDL.Principal,
    amount0_desired: IDL.Nat,
    amount1_desired: IDL.Nat,
  });

  const IncreaseLiquidityArgs = IDL.Record({
    pool_id: IDL.Principal,
    position_id: IDL.Nat,
    amount0_desired: IDL.Nat,
    amount1_desired: IDL.Nat,
  });

  const DecreaseLiquidityArgs = IDL.Record({
    pool_id: IDL.Principal,
    position_id: IDL.Nat,
    liquidity: IDL.Nat,
  });

  const ClaimPositionArgs = IDL.Record({
    pool_id: IDL.Principal,
    position_id: IDL.Nat,
  });

  const WithdrawArgs = IDL.Record({
    pool_id: IDL.Principal,
    token: IDL.Principal,
    amount: IDL.Nat,
    fee: IDL.Nat,
  });

  const TokenAmounts = IDL.Record({
    amount0: IDL.Nat,
    amount1: IDL.Nat,
  });

  // Staking types
  const TokenFeeBucket = IDL.Record({
    token_id: TokenId,
    total_fees_collected: IDL.Nat,
    total_staked: IDL.Nat,
    accumulated_per_share: IDL.Nat,
    last_updated: IDL.Nat64,
  });

  const UserStake = IDL.Record({
    amount: IDL.Nat,
    reward_debt: IDL.Nat,
    staked_at: IDL.Nat64,
  });

  const UserStakingStats = IDL.Record({
    token_id: TokenId,
    staked_amount: IDL.Nat,
    pending_rewards: IDL.Nat,
    lifetime_rewards: IDL.Nat,
  });

  // Trader activity
  const TraderActivity = IDL.Record({
    total_volume: IDL.Nat,
    trade_count: IDL.Nat64,
    last_trade: IDL.Nat64,
    activity_points: IDL.Nat,
  });

  // Promotion bid type
  const PromoBid = IDL.Record({
    id: IDL.Nat64,
    bidder: IDL.Principal,
    token_id: TokenId,
    bid_amount: IDL.Nat,
    created_at: IDL.Nat64,
    expires_at: IDL.Nat64,
    is_active: IDL.Bool,
    refunded: IDL.Bool,
    added_to_pool: IDL.Bool,
  });

  const ActivePromoBid = IDL.Record({
    id: IDL.Nat64,
    token_id: TokenId,
    bid_amount: IDL.Nat,
    created_at: IDL.Nat64,
    expires_at: IDL.Nat64,
  });

  // Distribution types
  const PromoDistribution = IDL.Record({
    id: IDL.Nat64,
    timestamp: IDL.Nat64,
    total_amount: IDL.Nat,
    total_volume: IDL.Nat,
    recipient_count: IDL.Nat64,
  });

  const DistributionShare = IDL.Record({
    distribution_id: IDL.Nat64,
    recipient: IDL.Principal,
    volume: IDL.Nat,
    share_amount: IDL.Nat,
    claimed: IDL.Bool,
  });

  // Error type
  const Error = IDL.Variant({
    Unauthorized: IDL.Null,
    InsufficientBalance: IDL.Record({
      available: IDL.Nat,
      required: IDL.Nat,
    }),
    InsufficientAllowance: IDL.Record({
      allowance: IDL.Nat,
      required: IDL.Nat,
    }),
    SlippageExceeded: IDL.Record({
      expected: IDL.Nat,
      received: IDL.Nat,
    }),
    TransferFailed: IDL.Record({
      reason: IDL.Text,
    }),
    InvalidArguments: IDL.Record({
      reason: IDL.Text,
    }),
    PoolNotFound: IDL.Null,
    UnsupportedToken: IDL.Record({
      token: TokenId,
    }),
    CanisterCallFailed: IDL.Record({
      canister: IDL.Principal,
      method: IDL.Text,
      reason: IDL.Text,
    }),
    InternalError: IDL.Record({
      reason: IDL.Text,
    }),
  });

  const Result = IDL.Variant({
    Ok: IDL.Nat,
    Err: Error,
  });

  const ResultSwap = IDL.Variant({
    Ok: SwapResult,
    Err: Error,
  });

  const ResultQuote = IDL.Variant({
    Ok: QuoteResult,
    Err: Error,
  });

  const ResultBool = IDL.Variant({
    Ok: IDL.Bool,
    Err: Error,
  });

  const ResultTokenAmounts = IDL.Variant({
    Ok: TokenAmounts,
    Err: Error,
  });

  const ResultUnit = IDL.Variant({
    Ok: IDL.Null,
    Err: Error,
  });

  const ResultRefunds = IDL.Variant({
    Ok: IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat)),
    Err: Error,
  });

  return IDL.Service({
    // Admin functions
    set_fee_basis_points: IDL.Func([IDL.Nat64], [ResultUnit], []),
    add_admin: IDL.Func([IDL.Principal], [ResultUnit], []),

    // Swap functions
    get_quote: IDL.Func([QuoteArgs], [ResultQuote], []),
    swap: IDL.Func([SwapArgs], [ResultSwap], []),

    // Pool action functions
    add_limit_order: IDL.Func([AddLimitOrderArgs], [ResultBool], []),
    remove_limit_order: IDL.Func([RemoveLimitOrderArgs], [ResultBool], []),
    mint_position: IDL.Func([MintPositionArgs], [Result], []),
    increase_liquidity: IDL.Func([IncreaseLiquidityArgs], [Result], []),
    decrease_liquidity: IDL.Func([DecreaseLiquidityArgs], [ResultTokenAmounts], []),
    claim_position: IDL.Func([ClaimPositionArgs], [ResultTokenAmounts], []),
    withdraw: IDL.Func([WithdrawArgs], [Result], []),
    withdraw_from_router: IDL.Func([IDL.Principal, IDL.Nat], [Result], []),
    withdraw_pending_refund: IDL.Func([IDL.Principal], [Result], []),

    // Staking functions
    stake: IDL.Func([TokenId, IDL.Nat], [ResultUnit], []),
    unstake: IDL.Func([TokenId, IDL.Nat], [ResultUnit], []),
    claim_rewards: IDL.Func([TokenId], [Result], []),

    // Promotion functions
    bid_for_exposure: IDL.Func([TokenId, IDL.Nat, IDL.Nat64], [Result], []),
    get_promoted_token: IDL.Func([], [IDL.Opt(TokenId)], ['query']),
    get_active_promo_bid: IDL.Func([], [IDL.Opt(ActivePromoBid)], ['query']),
    get_promo_pool: IDL.Func([], [IDL.Nat], ['query']),
    claim_bid_refunds: IDL.Func([], [ResultRefunds], []),
    get_my_refundable_bids: IDL.Func([], [IDL.Vec(PromoBid)], ['query']),
    get_user_refundable_bids: IDL.Func([IDL.Principal], [IDL.Vec(PromoBid)], ['query']),
    get_my_bids: IDL.Func([], [IDL.Vec(PromoBid)], ['query']),
    get_user_bids: IDL.Func([IDL.Principal], [IDL.Vec(PromoBid)], ['query']),

    // Query functions
    get_user_stake: IDL.Func(
      [IDL.Principal, TokenId],
      [IDL.Opt(UserStake)],
      ['query']
    ),
    get_pending_rewards: IDL.Func(
      [IDL.Principal, TokenId],
      [IDL.Nat],
      ['query']
    ),
    get_token_bucket: IDL.Func(
      [TokenId],
      [IDL.Opt(TokenFeeBucket)],
      ['query']
    ),
    get_trader_activity: IDL.Func(
      [IDL.Principal],
      [IDL.Opt(TraderActivity)],
      ['query']
    ),
    get_user_stats: IDL.Func(
      [IDL.Principal, TokenId],
      [UserStakingStats],
      ['query']
    ),
    get_stats: IDL.Func([], [IDL.Tuple(IDL.Nat, IDL.Nat64, IDL.Nat64)], ['query']),

    // Distribution query functions
    get_distribution_history: IDL.Func(
      [IDL.Nat64, IDL.Nat64],
      [IDL.Vec(PromoDistribution)],
      ['query']
    ),
    get_user_distribution_share: IDL.Func(
      [IDL.Nat64, IDL.Principal],
      [IDL.Opt(DistributionShare)],
      ['query']
    ),
    get_my_promo_rewards: IDL.Func([], [IDL.Nat], ['query']),
    get_user_promo_rewards: IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
    get_my_distributions: IDL.Func(
      [IDL.Nat64, IDL.Nat64],
      [IDL.Vec(DistributionShare)],
      ['query']
    ),
    get_user_distributions: IDL.Func(
      [IDL.Principal, IDL.Nat64, IDL.Nat64],
      [IDL.Vec(DistributionShare)],
      ['query']
    ),
    get_pending_refund: IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
    get_next_distribution_time: IDL.Func([], [IDL.Nat64], ['query']),
    get_period_trader_stats: IDL.Func(
      [],
      [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat, IDL.Nat64))],
      ['query']
    ),
  });
};

// TypeScript types for the canister interface
export interface SwapArgs {
  token_in: Principal;
  token_out: Principal;
  amount_in: bigint;
  amount_out_minimum: bigint;
  pool_id: Principal;
  zero_for_one: boolean;
}

export interface SwapResult {
  amount_out: bigint;
  fee_amount: bigint;
  token_in: Principal;
  token_out: Principal;
}

export interface QuoteArgs {
  pool_id: Principal;
  zero_for_one: boolean;
  amount_in: bigint;
}

export interface QuoteResult {
  amount_out: bigint;
  price_impact: [] | [number];
}

export interface AddLimitOrderArgs {
  pool_id: Principal;
  position_id: bigint;
  tick_limit: bigint;
}

export interface RemoveLimitOrderArgs {
  pool_id: Principal;
  position_id: bigint;
}

export interface MintPositionArgs {
  pool_id: Principal;
  fee: bigint;
  tick_lower: bigint;
  tick_upper: bigint;
  token0: Principal;
  token1: Principal;
  amount0_desired: bigint;
  amount1_desired: bigint;
}

export interface IncreaseLiquidityArgs {
  pool_id: Principal;
  position_id: bigint;
  amount0_desired: bigint;
  amount1_desired: bigint;
}

export interface DecreaseLiquidityArgs {
  pool_id: Principal;
  position_id: bigint;
  liquidity: bigint;
}

export interface ClaimPositionArgs {
  pool_id: Principal;
  position_id: bigint;
}

export interface WithdrawArgs {
  pool_id: Principal;
  token: Principal;
  amount: bigint;
  fee: bigint;
}

export interface WithdrawFromRouterArgs {
  token: Principal;
  amount: bigint;
}

export interface WithdrawPendingRefundArgs {
  token: Principal;
}

export interface TokenAmounts {
  amount0: bigint;
  amount1: bigint;
}

export interface UserStake {
  amount: bigint;
  reward_debt: bigint;
  staked_at: bigint;
}

export interface UserStakingStats {
  token_id: Principal;
  staked_amount: bigint;
  pending_rewards: bigint;
  lifetime_rewards: bigint;
}

export interface TokenFeeBucket {
  token_id: Principal;
  total_fees_collected: bigint;
  total_staked: bigint;
  accumulated_per_share: bigint;
  last_updated: bigint;
}

export interface TraderActivity {
  total_volume: bigint;
  trade_count: bigint;
  last_trade: bigint;
  activity_points: bigint;
}

export interface PromoDistribution {
  id: bigint;
  timestamp: bigint;
  total_amount: bigint;
  total_volume: bigint;
  recipient_count: bigint;
}

export interface DistributionShare {
  distribution_id: bigint;
  recipient: Principal;
  volume: bigint;
  share_amount: bigint;
  claimed: boolean;
}

export interface PromoBid {
  id: bigint;
  bidder: Principal;
  token_id: Principal;
  bid_amount: bigint;
  created_at: bigint;
  expires_at: bigint;
  is_active: boolean;
  refunded: boolean;
  added_to_pool: boolean;
}

export interface ActivePromoBid {
  id: bigint;
  token_id: Principal;
  bid_amount: bigint;
  created_at: bigint;
  expires_at: bigint;
}

export type PrysmRouterError =
  | { Unauthorized: null }
  | { InsufficientBalance: { available: bigint; required: bigint } }
  | { InsufficientAllowance: { allowance: bigint; required: bigint } }
  | { SlippageExceeded: { expected: bigint; received: bigint } }
  | { TransferFailed: { reason: string } }
  | { InvalidArguments: { reason: string } }
  | { PoolNotFound: null }
  | { UnsupportedToken: { token: Principal } }
  | { CanisterCallFailed: { canister: Principal; method: string; reason: string } }
  | { InternalError: { reason: string } };

import { Principal } from '@dfinity/principal';

import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface ActivePromoBid {
  'id' : bigint,
  'token_id' : TokenId,
  'created_at' : bigint,
  'bid_amount' : bigint,
  'expires_at' : bigint,
}
export interface AddLimitOrderArgs {
  'tick_limit' : bigint,
  'pool_id' : Principal,
  'position_id' : bigint,
}
export interface ClaimPositionArgs {
  'pool_id' : Principal,
  'position_id' : bigint,
}
export interface DecreaseLiquidityArgs {
  'liquidity' : bigint,
  'pool_id' : Principal,
  'position_id' : bigint,
}
export interface DistributionShare {
  'recipient' : Principal,
  'distribution_id' : bigint,
  'volume' : bigint,
  'claimed' : boolean,
  'share_amount' : bigint,
}
export type Error = {
    'InsufficientAllowance' : { 'required' : bigint, 'allowance' : bigint }
  } |
  { 'PoolNotFound' : null } |
  { 'InvalidArguments' : { 'reason' : string } } |
  { 'InsufficientBalance' : { 'available' : bigint, 'required' : bigint } } |
  {
    'CanisterCallFailed' : {
      'method' : string,
      'canister' : Principal,
      'reason' : string,
    }
  } |
  { 'Unauthorized' : null } |
  { 'TransferFailed' : { 'reason' : string } } |
  { 'InternalError' : { 'reason' : string } } |
  { 'SlippageExceeded' : { 'expected' : bigint, 'received' : bigint } } |
  { 'UnsupportedToken' : { 'token' : TokenId } };
export interface IncreaseLiquidityArgs {
  'amount0_desired' : bigint,
  'pool_id' : Principal,
  'amount1_desired' : bigint,
  'position_id' : bigint,
}
export interface InitArgs {
  'pry_ledger' : Principal,
  'promo_distribution_period' : [] | [bigint],
  'icpswap_factory' : Principal,
  'admins' : Array<Principal>,
  'fee_basis_points' : [] | [bigint],
}
export interface MintPositionArgs {
  'fee' : bigint,
  'amount0_desired' : bigint,
  'token0' : Principal,
  'token1' : Principal,
  'tick_lower' : bigint,
  'pool_id' : Principal,
  'tick_upper' : bigint,
  'amount1_desired' : bigint,
}
export interface PromoBid {
  'id' : bigint,
  'added_to_pool' : boolean,
  'token_id' : TokenId,
  'refunded' : boolean,
  'created_at' : bigint,
  'is_active' : boolean,
  'bid_amount' : bigint,
  'expires_at' : bigint,
  'bidder' : Principal,
}
export interface PromoDistribution {
  'id' : bigint,
  'total_amount' : bigint,
  'recipient_count' : bigint,
  'timestamp' : bigint,
  'total_volume' : bigint,
}
export interface QuoteArgs {
  'zero_for_one' : boolean,
  'amount_in' : bigint,
  'pool_id' : Principal,
}
export interface QuoteResult {
  'amount_out' : bigint,
  'price_impact' : [] | [number],
}
export interface RemoveLimitOrderArgs {
  'pool_id' : Principal,
  'position_id' : bigint,
}
export type Result = { 'Ok' : bigint } |
  { 'Err' : Error };
export type ResultBool = { 'Ok' : boolean } |
  { 'Err' : Error };
export type ResultQuote = { 'Ok' : QuoteResult } |
  { 'Err' : Error };
export type ResultRefunds = { 'Ok' : Array<[bigint, bigint]> } |
  { 'Err' : Error };
export type ResultSwap = { 'Ok' : SwapResult } |
  { 'Err' : Error };
export type ResultTokenAmounts = { 'Ok' : TokenAmounts } |
  { 'Err' : Error };
export type ResultUnit = { 'Ok' : null } |
  { 'Err' : Error };
export interface SwapArgs {
  'token_in' : TokenId,
  'zero_for_one' : boolean,
  'amount_out_minimum' : bigint,
  'amount_in' : bigint,
  'token_out' : TokenId,
  'pool_id' : Principal,
}
export interface SwapResult {
  'token_in' : TokenId,
  'amount_out' : bigint,
  'fee_amount' : bigint,
  'token_out' : TokenId,
}
export interface TokenAmounts { 'amount0' : bigint, 'amount1' : bigint }
export interface TokenFeeBucket {
  'token_id' : TokenId,
  'accumulated_per_share' : bigint,
  'total_staked' : bigint,
  'last_updated' : bigint,
  'total_fees_collected' : bigint,
}
export type TokenId = Principal;
export interface TraderActivity {
  'activity_points' : bigint,
  'last_trade' : bigint,
  'total_volume' : bigint,
  'trade_count' : bigint,
}
export interface UpgradeArgs {
  'pry_ledger' : [] | [Principal],
  'promo_distribution_period' : [] | [bigint],
  'icpswap_factory' : [] | [Principal],
  'admins' : [] | [Array<Principal>],
  'fee_basis_points' : [] | [bigint],
}
export type UserId = Principal;
export interface UserStake {
  'reward_debt' : bigint,
  'staked_at' : bigint,
  'amount' : bigint,
}
export interface UserStakingStats {
  'staked_amount' : bigint,
  'token_id' : TokenId,
  'lifetime_rewards' : bigint,
  'pending_rewards' : bigint,
}
export interface WithdrawArgs {
  'fee' : bigint,
  'token' : Principal,
  'pool_id' : Principal,
  'amount' : bigint,
}
export interface _SERVICE {
  'add_admin' : ActorMethod<[Principal], ResultUnit>,
  'add_limit_order' : ActorMethod<[AddLimitOrderArgs], ResultBool>,
  'bid_for_exposure' : ActorMethod<[TokenId, bigint, bigint], Result>,
  'claim_bid_refunds' : ActorMethod<[], ResultRefunds>,
  'claim_position' : ActorMethod<[ClaimPositionArgs], ResultTokenAmounts>,
  'claim_rewards' : ActorMethod<[TokenId], Result>,
  'decrease_liquidity' : ActorMethod<
    [DecreaseLiquidityArgs],
    ResultTokenAmounts
  >,
  'get_active_promo_bid' : ActorMethod<[], [] | [ActivePromoBid]>,
  'get_distribution_history' : ActorMethod<
    [bigint, bigint],
    Array<PromoDistribution>
  >,
  'get_my_bids' : ActorMethod<[], Array<PromoBid>>,
  'get_my_distributions' : ActorMethod<
    [bigint, bigint],
    Array<DistributionShare>
  >,
  'get_my_promo_rewards' : ActorMethod<[], bigint>,
  'get_my_refundable_bids' : ActorMethod<[], Array<PromoBid>>,
  'get_next_distribution_time' : ActorMethod<[], bigint>,
  'get_pending_rewards' : ActorMethod<[Principal, TokenId], bigint>,
  'get_period_trader_stats' : ActorMethod<
    [],
    Array<[Principal, bigint, bigint]>
  >,
  'get_promo_pool' : ActorMethod<[], bigint>,
  'get_promoted_token' : ActorMethod<[], [] | [TokenId]>,
  'get_quote' : ActorMethod<[QuoteArgs], ResultQuote>,
  'get_stats' : ActorMethod<[], [bigint, bigint, bigint]>,
  'get_token_bucket' : ActorMethod<[TokenId], [] | [TokenFeeBucket]>,
  'get_trader_activity' : ActorMethod<[Principal], [] | [TraderActivity]>,
  'get_user_distribution_share' : ActorMethod<
    [bigint, Principal],
    [] | [DistributionShare]
  >,
  'get_user_stake' : ActorMethod<[Principal, TokenId], [] | [UserStake]>,
  'get_user_stats' : ActorMethod<[Principal, TokenId], UserStakingStats>,
  'increase_liquidity' : ActorMethod<[IncreaseLiquidityArgs], Result>,
  'mint_position' : ActorMethod<[MintPositionArgs], Result>,
  'remove_limit_order' : ActorMethod<[RemoveLimitOrderArgs], ResultBool>,
  'set_fee_basis_points' : ActorMethod<[bigint], ResultUnit>,
  'stake' : ActorMethod<[TokenId, bigint], ResultUnit>,
  'swap' : ActorMethod<[SwapArgs], ResultSwap>,
  'unstake' : ActorMethod<[TokenId, bigint], ResultUnit>,
  'withdraw' : ActorMethod<[WithdrawArgs], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

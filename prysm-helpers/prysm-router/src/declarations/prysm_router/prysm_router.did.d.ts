import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
/**
 * Error type
 */
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
/**
 * Init/Upgrade arguments
 */
export interface InitArgs {
  'pry_ledger' : Principal,
  'promo_distribution_period' : [] | [bigint],
  'icpswap_factory' : Principal,
  'admins' : Array<Principal>,
  'fee_basis_points' : [] | [bigint],
}
/**
 * Promotion types
 */
export interface PromoBid {
  'id' : bigint,
  'token_id' : TokenId,
  'created_at' : bigint,
  'is_active' : boolean,
  'bid_amount' : bigint,
  'expires_at' : bigint,
  'bidder' : Principal,
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
export type Result = { 'Ok' : bigint } |
  { 'Err' : Error };
export type ResultQuote = { 'Ok' : QuoteResult } |
  { 'Err' : Error };
export type ResultSwap = { 'Ok' : SwapResult } |
  { 'Err' : Error };
export type ResultUnit = { 'Ok' : null } |
  { 'Err' : Error };
/**
 * Swap types
 */
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
/**
 * Staking types
 */
export interface TokenFeeBucket {
  'token_id' : TokenId,
  'accumulated_per_share' : bigint,
  'total_staked' : bigint,
  'last_updated' : bigint,
  'total_fees_collected' : bigint,
}
export type TokenId = Principal;
/**
 * Trader activity
 */
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
export interface _SERVICE {
  'add_admin' : ActorMethod<[Principal], ResultUnit>,
  /**
   * Promotion functions
   */
  'bid_for_exposure' : ActorMethod<[TokenId, bigint, bigint], Result>,
  'claim_rewards' : ActorMethod<[TokenId], Result>,
  'get_pending_rewards' : ActorMethod<[Principal, TokenId], bigint>,
  'get_promo_pool' : ActorMethod<[], bigint>,
  'get_promoted_token' : ActorMethod<[], [] | [TokenId]>,
  /**
   * Swap functions
   */
  'get_quote' : ActorMethod<[QuoteArgs], ResultQuote>,
  'get_stats' : ActorMethod<[], [bigint, bigint, bigint]>,
  'get_token_bucket' : ActorMethod<[TokenId], [] | [TokenFeeBucket]>,
  'get_trader_activity' : ActorMethod<[Principal], [] | [TraderActivity]>,
  /**
   * Query functions
   */
  'get_user_stake' : ActorMethod<[Principal, TokenId], [] | [UserStake]>,
  'get_user_stats' : ActorMethod<[Principal, TokenId], UserStakingStats>,
  /**
   * Admin functions
   */
  'set_fee_basis_points' : ActorMethod<[bigint], ResultUnit>,
  /**
   * Staking functions
   */
  'stake' : ActorMethod<[TokenId, bigint], ResultUnit>,
  'swap' : ActorMethod<[SwapArgs], ResultSwap>,
  'unstake' : ActorMethod<[TokenId, bigint], ResultUnit>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

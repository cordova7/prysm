/**
 * Canister Actor IDLs Index
 */
export { PRYSM_ROUTER_IDL } from './prysm-router.idl';
export type {
  SwapArgs,
  SwapResult,
  QuoteArgs,
  QuoteResult,
  AddLimitOrderArgs,
  RemoveLimitOrderArgs,
  MintPositionArgs,
  IncreaseLiquidityArgs,
  DecreaseLiquidityArgs,
  ClaimPositionArgs,
  WithdrawArgs,
  TokenAmounts,
  UserStake,
  UserStakingStats,
  TokenFeeBucket,
  TraderActivity,
  PromoBid,
  ActivePromoBid,
  PrysmRouterError,
} from './prysm-router.idl';

export { ICPSWAP_POOL_IDL } from './icpswap-pool.idl';
export type {
  SwapArgs as PoolSwapArgs,
  DepositAndSwapArgs,
  GetCachedTokenFeeRet,
  PoolError,
  PoolResult,
} from './icpswap-pool.idl';

export { ICPSWAP_FACTORY_IDL } from './icpswap-factory.idl';
export type {
  Token,
  PoolData,
  GetPoolArgs,
  FactoryError,
} from './icpswap-factory.idl';

export { ICRC2_IDL } from '../idl/icrc2.idl';

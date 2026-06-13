/**
 * ICPSwap Pool Canister IDL
 * Based on ICPSwap documentation
 */
import { IDL } from '@dfinity/candid';

export const ICPSWAP_POOL_IDL: IDL.InterfaceFactory = ({ IDL }) => {
  // Token type
  const Token = IDL.Record({
    address: IDL.Text,
    standard: IDL.Text,
  });

  // Minimal metadata return (records are width-subtypes in Candid, so extra fields are OK)
  const PoolMetadata = IDL.Record({
    token0: Token,
    token1: Token,
  });

  // Error type
  const Error = IDL.Variant({
    CommonError: IDL.Null,
    InsufficientFunds: IDL.Null,
    InternalError: IDL.Text,
    UnsupportedToken: IDL.Text,
  });

  // Result types
  const Result = IDL.Variant({
    ok: IDL.Nat,
    err: Error,
  });

  const Result_Metadata = IDL.Variant({
    ok: PoolMetadata,
    err: Error,
  });

  const Result_Balance = IDL.Variant({
    ok: IDL.Record({
      balance0: IDL.Nat,
      balance1: IDL.Nat,
    }),
    err: Error,
  });

  const GetCachedTokenFeeRet = IDL.Record({
    token0Fee: IDL.Nat,
    token1Fee: IDL.Nat,
  });

  // Deposit/Withdraw args
  const DepositArgs = IDL.Record({
    fee: IDL.Nat,
    token: IDL.Text,
    amount: IDL.Nat,
  });

  const WithdrawArgs = IDL.Record({
    fee: IDL.Nat,
    token: IDL.Text,
    amount: IDL.Nat,
  });

  // Position types
  const UserPositionInfo = IDL.Record({
    id: IDL.Nat,
    tickLower: IDL.Int,
    tickUpper: IDL.Int,
    liquidity: IDL.Nat,
    tokensOwed0: IDL.Nat,
    tokensOwed1: IDL.Nat,
    feeGrowthInside0LastX128: IDL.Nat,
    feeGrowthInside1LastX128: IDL.Nat,
  });

  const UserPositionWithTokenAmount = IDL.Record({
    id: IDL.Nat,
    tickLower: IDL.Int,
    tickUpper: IDL.Int,
    liquidity: IDL.Nat,
    tokensOwed0: IDL.Nat,
    tokensOwed1: IDL.Nat,
    feeGrowthInside0LastX128: IDL.Nat,
    feeGrowthInside1LastX128: IDL.Nat,
    token0Amount: IDL.Nat,
    token1Amount: IDL.Nat,
  });

  const RefreshIncomeResult = IDL.Record({
    tokensOwed0: IDL.Nat,
    tokensOwed1: IDL.Nat,
  });

  const Result_UserPositions = IDL.Variant({
    ok: IDL.Vec(UserPositionInfo),
    err: Error,
  });

  const Result_UserPosition = IDL.Variant({
    ok: UserPositionInfo,
    err: Error,
  });

  const Result_UserPositionWithTokenAmount = IDL.Variant({
    ok: UserPositionWithTokenAmount,
    err: Error,
  });

  const Result_RefreshIncome = IDL.Variant({
    ok: RefreshIncomeResult,
    err: Error,
  });

  const Result_Principal = IDL.Variant({
    ok: IDL.Principal,
    err: Error,
  });

  const Result_Bool = IDL.Variant({
    ok: IDL.Bool,
    err: Error,
  });

  // Swap args
  const SwapArgs = IDL.Record({
    amountIn: IDL.Text,
    zeroForOne: IDL.Bool,
    amountOutMinimum: IDL.Text,
  });

  // DepositFromAndSwap args (ICRC-2 one-step swap)
  const DepositAndSwapArgs = IDL.Record({
    amountIn: IDL.Text,
    zeroForOne: IDL.Bool,
    amountOutMinimum: IDL.Text,
    tokenInFee: IDL.Nat,
    tokenOutFee: IDL.Nat,
  });

  return IDL.Service({
    // Pool info
    token0: IDL.Func([], [IDL.Text], ['query']),
    token1: IDL.Func([], [IDL.Text], ['query']),
    fee: IDL.Func([], [IDL.Nat], ['query']),
    getCachedTokenFee: IDL.Func([], [GetCachedTokenFeeRet], ['query']),
    metadata: IDL.Func([], [Result_Metadata], ['query']),

    // Quote
    quote: IDL.Func([SwapArgs], [Result], ['query']),
    quoteForAll: IDL.Func([SwapArgs], [Result], ['query']),

    // Standard workflow (ICRC-1)
    deposit: IDL.Func([DepositArgs], [Result], []),
    swap: IDL.Func([SwapArgs], [Result], []),
    withdraw: IDL.Func([WithdrawArgs], [Result], []),

    // ICRC-2 one-step workflow
    depositFrom: IDL.Func([DepositArgs], [Result], []),
    depositFromAndSwap: IDL.Func([DepositAndSwapArgs], [Result], []),

    // User balance
    getUserUnusedBalance: IDL.Func([IDL.Principal], [Result_Balance], ['query']),

    // Position management
    getUserPositions: IDL.Func([IDL.Nat, IDL.Nat], [Result_UserPositions], ['query']),
    getUserPosition: IDL.Func([IDL.Nat], [Result_UserPosition], ['query']),
    getUserPositionWithTokenAmount: IDL.Func([IDL.Nat], [Result_UserPositionWithTokenAmount], ['query']),
    getUserPositionIds: IDL.Func([], [IDL.Vec(IDL.Nat)], ['query']),
    refreshIncome: IDL.Func([IDL.Nat], [Result_RefreshIncome], []),
    batchRefreshIncome: IDL.Func([IDL.Vec(IDL.Nat)], [IDL.Vec(Result_RefreshIncome)], []),

    // Position ownership
    getUserByPositionId: IDL.Func([IDL.Nat], [Result_Principal], ['query']),
    checkOwnerOfUserPosition: IDL.Func([IDL.Principal, IDL.Nat], [Result_Bool], ['query']),
  });
};

// TypeScript types
export interface SwapArgs {
  amountIn: string;
  zeroForOne: boolean;
  amountOutMinimum: string;
}

export interface DepositAndSwapArgs {
  amountIn: string;
  zeroForOne: boolean;
  amountOutMinimum: string;
  tokenInFee: bigint;
  tokenOutFee: bigint;
}

export interface GetCachedTokenFeeRet {
  token0Fee: bigint;
  token1Fee: bigint;
}

export type PoolError =
  | { CommonError: null }
  | { InsufficientFunds: null }
  | { InternalError: string }
  | { UnsupportedToken: string };

export type PoolResult =
  | { ok: bigint }
  | { err: PoolError };

export type PoolMetadataResult =
  | { ok: { token0: { address: string; standard: string }; token1: { address: string; standard: string } } }
  | { err: PoolError };

export interface UserPositionInfo {
  id: bigint;
  tickLower: bigint;
  tickUpper: bigint;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
}

export interface UserPositionWithTokenAmount extends UserPositionInfo {
  token0Amount: bigint;
  token1Amount: bigint;
}

export interface RefreshIncomeResult {
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export type UserPositionsResult =
  | { ok: UserPositionInfo[] }
  | { err: PoolError };

export type UserPositionResult =
  | { ok: UserPositionInfo }
  | { err: PoolError };

export type UserPositionWithTokenAmountResult =
  | { ok: UserPositionWithTokenAmount }
  | { err: PoolError };

export type RefreshIncomeResultType =
  | { ok: RefreshIncomeResult }
  | { err: PoolError };

export type UserBalanceResult =
  | { ok: { balance0: bigint; balance1: bigint } }
  | { err: PoolError };

export interface DepositArgs {
  fee: bigint;
  token: string;
  amount: bigint;
}

export interface WithdrawArgs {
  fee: bigint;
  token: string;
  amount: bigint;
}

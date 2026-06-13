/**
 * ICPSwap Factory Canister IDL
 * For pool discovery
 */
import { IDL } from '@dfinity/candid';

export const ICPSWAP_FACTORY_IDL: IDL.InterfaceFactory = ({ IDL }) => {
  // Token type
  const Token = IDL.Record({
    address: IDL.Text,
    standard: IDL.Text,
  });

  // Pool data
  const PoolData = IDL.Record({
    fee: IDL.Nat,
    key: IDL.Text,
    tickSpacing: IDL.Int,
    token0: Token,
    token1: Token,
    canisterId: IDL.Principal,
  });

  // Error type
  const Error = IDL.Variant({
    CommonError: IDL.Null,
    InternalError: IDL.Text,
    UnsupportedToken: IDL.Text,
    InsufficientFunds: IDL.Null,
  });

  // Result types
  const Result_Pool = IDL.Variant({
    ok: PoolData,
    err: Error,
  });

  const Result_Pools = IDL.Variant({
    ok: IDL.Vec(PoolData),
    err: Error,
  });

  // Get pool args
  const GetPoolArgs = IDL.Record({
    fee: IDL.Nat,
    token0: Token,
    token1: Token,
  });

  return IDL.Service({
    // Get a specific pool
    getPool: IDL.Func([GetPoolArgs], [Result_Pool], ['query']),

    // Get all pools
    getPools: IDL.Func([], [Result_Pools], ['query']),
  });
};

// TypeScript types
export interface Token {
  address: string;
  standard: string;
}

export interface PoolData {
  fee: bigint;
  key: string;
  tickSpacing: bigint;
  token0: Token;
  token1: Token;
  canisterId: Principal;
}

export interface GetPoolArgs {
  fee: bigint;
  token0: Token;
  token1: Token;
}

export type FactoryError =
  | { CommonError: null }
  | { InternalError: string }
  | { UnsupportedToken: string }
  | { InsufficientFunds: null };

export type PoolResult =
  | { ok: PoolData }
  | { err: FactoryError };

import { Principal } from '@dfinity/principal';

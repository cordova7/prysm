/**
 * ICRC-2 Token Standard Candid Interface
 * Includes ICRC-1 base methods + ICRC-2 approve/transfer_from
 */
import { IDL } from '@dfinity/candid';

export const ICRC2_IDL: IDL.InterfaceFactory = ({ IDL }) => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });

  const MetadataValue = IDL.Variant({
    Int: IDL.Int,
    Nat: IDL.Nat,
    Blob: IDL.Vec(IDL.Nat8),
    Text: IDL.Text,
  });

  const StandardRecord = IDL.Record({
    url: IDL.Text,
    name: IDL.Text,
  });

  // ICRC-1 Transfer
  const TransferArg = IDL.Record({
    to: Account,
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat,
  });

  const TransferError = IDL.Variant({
    GenericError: IDL.Record({
      message: IDL.Text,
      error_code: IDL.Nat,
    }),
    TemporarilyUnavailable: IDL.Null,
    BadBurn: IDL.Record({ min_burn_amount: IDL.Nat }),
    Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
    BadFee: IDL.Record({ expected_fee: IDL.Nat }),
    CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
    TooOld: IDL.Null,
    InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
  });

  const TransferResult = IDL.Variant({
    Ok: IDL.Nat,
    Err: TransferError,
  });

  // ICRC-2 Allowance
  const AllowanceArgs = IDL.Record({
    account: Account,
    spender: Account,
  });

  const Allowance = IDL.Record({
    allowance: IDL.Nat,
    expires_at: IDL.Opt(IDL.Nat64),
  });

  // ICRC-2 Approve
  const ApproveArgs = IDL.Record({
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat,
    expected_allowance: IDL.Opt(IDL.Nat),
    expires_at: IDL.Opt(IDL.Nat64),
    spender: Account,
  });

  const ApproveError = IDL.Variant({
    GenericError: IDL.Record({
      message: IDL.Text,
      error_code: IDL.Nat,
    }),
    TemporarilyUnavailable: IDL.Null,
    Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
    BadFee: IDL.Record({ expected_fee: IDL.Nat }),
    AllowanceChanged: IDL.Record({ current_allowance: IDL.Nat }),
    CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
    TooOld: IDL.Null,
    Expired: IDL.Record({ ledger_time: IDL.Nat64 }),
    InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
  });

  const ApproveResult = IDL.Variant({
    Ok: IDL.Nat,
    Err: ApproveError,
  });

  // ICRC-2 Transfer From
  const TransferFromArgs = IDL.Record({
    to: Account,
    fee: IDL.Opt(IDL.Nat),
    spender_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    from: Account,
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat,
  });

  const TransferFromError = IDL.Variant({
    GenericError: IDL.Record({
      message: IDL.Text,
      error_code: IDL.Nat,
    }),
    TemporarilyUnavailable: IDL.Null,
    InsufficientAllowance: IDL.Record({ allowance: IDL.Nat }),
    BadBurn: IDL.Record({ min_burn_amount: IDL.Nat }),
    Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
    BadFee: IDL.Record({ expected_fee: IDL.Nat }),
    CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
    TooOld: IDL.Null,
    InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
  });

  const TransferFromResult = IDL.Variant({
    Ok: IDL.Nat,
    Err: TransferFromError,
  });

  return IDL.Service({
    // ICRC-1 Query Methods
    icrc1_name: IDL.Func([], [IDL.Text], ['query']),
    icrc1_symbol: IDL.Func([], [IDL.Text], ['query']),
    icrc1_decimals: IDL.Func([], [IDL.Nat8], ['query']),
    icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
    icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
    icrc1_minting_account: IDL.Func([], [IDL.Opt(Account)], ['query']),
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),
    icrc1_metadata: IDL.Func(
      [],
      [IDL.Vec(IDL.Tuple(IDL.Text, MetadataValue))],
      ['query']
    ),
    icrc1_supported_standards: IDL.Func(
      [],
      [IDL.Vec(StandardRecord)],
      ['query']
    ),

    // ICRC-1 Update Methods
    icrc1_transfer: IDL.Func([TransferArg], [TransferResult], []),

    // ICRC-2 Query Methods
    icrc2_allowance: IDL.Func([AllowanceArgs], [Allowance], ['query']),

    // ICRC-2 Update Methods
    icrc2_approve: IDL.Func([ApproveArgs], [ApproveResult], []),
    icrc2_transfer_from: IDL.Func([TransferFromArgs], [TransferFromResult], []),
  });
};

// Type exports for TypeScript usage
export interface Account {
  owner: Principal;
  subaccount: [] | [Uint8Array];
}

export interface ApproveArgs {
  fee: [] | [bigint];
  memo: [] | [Uint8Array];
  from_subaccount: [] | [Uint8Array];
  created_at_time: [] | [bigint];
  amount: bigint;
  expected_allowance: [] | [bigint];
  expires_at: [] | [bigint];
  spender: Account;
}

export interface TransferFromArgs {
  to: Account;
  fee: [] | [bigint];
  spender_subaccount: [] | [Uint8Array];
  from: Account;
  memo: [] | [Uint8Array];
  created_at_time: [] | [bigint];
  amount: bigint;
}

export type ApproveResult =
  | { Ok: bigint }
  | { Err: ApproveError };

export type ApproveError =
  | { GenericError: { message: string; error_code: bigint } }
  | { TemporarilyUnavailable: null }
  | { Duplicate: { duplicate_of: bigint } }
  | { BadFee: { expected_fee: bigint } }
  | { AllowanceChanged: { current_allowance: bigint } }
  | { CreatedInFuture: { ledger_time: bigint } }
  | { TooOld: null }
  | { Expired: { ledger_time: bigint } }
  | { InsufficientFunds: { balance: bigint } };

export type TransferFromResult =
  | { Ok: bigint }
  | { Err: TransferFromError };

export type TransferFromError =
  | { GenericError: { message: string; error_code: bigint } }
  | { TemporarilyUnavailable: null }
  | { InsufficientAllowance: { allowance: bigint } }
  | { BadBurn: { min_burn_amount: bigint } }
  | { Duplicate: { duplicate_of: bigint } }
  | { BadFee: { expected_fee: bigint } }
  | { CreatedInFuture: { ledger_time: bigint } }
  | { TooOld: null }
  | { InsufficientFunds: { balance: bigint } };

// Import Principal type
import { Principal } from '@dfinity/principal';

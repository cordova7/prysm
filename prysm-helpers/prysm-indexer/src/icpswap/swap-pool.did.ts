/**
 * SwapPool canister Candid interface
 */
export const SwapPoolIDL = ({ IDL }: any) => {
  const Error = IDL.Variant({
    CommonError: IDL.Null,
    InsufficientFunds: IDL.Null,
    InternalError: IDL.Text,
    UnsupportedToken: IDL.Text,
  });

  const Token = IDL.Record({
    address: IDL.Principal,
    standard: IDL.Text,
  });

  const SwapStatus = IDL.Variant({
    Completed: IDL.Null,
    Created: IDL.Null,
    Failed: IDL.Null,
    DepositCreditCompleted: IDL.Null,
    DepositTransferCompleted: IDL.Null,
    PreSwapCompleted: IDL.Null,
    SwapCompleted: IDL.Null,
    WithdrawCreditCompleted: IDL.Null,
  });

  const SwapInfo = IDL.Record({
    amountIn: IDL.Nat,
    amountInFee: IDL.Nat,
    amountOut: IDL.Nat,
    amountOutFee: IDL.Nat,
    err: IDL.Opt(IDL.Text),
    status: SwapStatus,
    tokenIn: Token,
    tokenOut: Token,
  });

  const Action = IDL.Variant({
    AddLimitOrder: IDL.Unknown,
    AddLiquidity: IDL.Unknown,
    Claim: IDL.Unknown,
    DecreaseLiquidity: IDL.Unknown,
    Deposit: IDL.Unknown,
    ExecuteLimitOrder: IDL.Unknown,
    OneStepSwap: IDL.Unknown,
    Refund: IDL.Unknown,
    RemoveLimitOrder: IDL.Unknown,
    Swap: SwapInfo,
    TransferPosition: IDL.Unknown,
    Withdraw: IDL.Unknown,
  });

  const Transaction = IDL.Record({
    action: Action,
    canisterId: IDL.Principal,
    id: IDL.Nat,
    owner: IDL.Principal,
    timestamp: IDL.Int,
  });

  const Result_16 = IDL.Variant({
    err: Error,
    ok: IDL.Vec(IDL.Record({ 0: IDL.Nat, 1: Transaction })),
  });

  const PoolToken = IDL.Record({
    address: IDL.Text,
    standard: IDL.Text,
  });

  const PoolMetadata = IDL.Record({
    fee: IDL.Nat,
    key: IDL.Text,
    liquidity: IDL.Nat,
    maxLiquidityPerTick: IDL.Nat,
    nextPositionId: IDL.Nat,
    sqrtPriceX96: IDL.Nat,
    tick: IDL.Int,
    token0: PoolToken,
    token1: PoolToken,
  });

  const Result_7 = IDL.Variant({
    err: Error,
    ok: PoolMetadata,
  });

  return IDL.Service({
    getTransactionsByOwner: IDL.Func([IDL.Principal], [Result_16], ['query']),
    metadata: IDL.Func([], [Result_7], ['query']),
  });
};

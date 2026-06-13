export const idlFactory = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'pry_ledger' : IDL.Principal,
    'promo_distribution_period' : IDL.Opt(IDL.Nat64),
    'icpswap_factory' : IDL.Principal,
    'admins' : IDL.Vec(IDL.Principal),
    'fee_basis_points' : IDL.Opt(IDL.Nat64),
  });
  const TokenId = IDL.Principal;
  const Error = IDL.Variant({
    'InsufficientAllowance' : IDL.Record({
      'required' : IDL.Nat,
      'allowance' : IDL.Nat,
    }),
    'PoolNotFound' : IDL.Null,
    'InvalidArguments' : IDL.Record({ 'reason' : IDL.Text }),
    'InsufficientBalance' : IDL.Record({
      'available' : IDL.Nat,
      'required' : IDL.Nat,
    }),
    'CanisterCallFailed' : IDL.Record({
      'method' : IDL.Text,
      'canister' : IDL.Principal,
      'reason' : IDL.Text,
    }),
    'Unauthorized' : IDL.Null,
    'TransferFailed' : IDL.Record({ 'reason' : IDL.Text }),
    'InternalError' : IDL.Record({ 'reason' : IDL.Text }),
    'SlippageExceeded' : IDL.Record({
      'expected' : IDL.Nat,
      'received' : IDL.Nat,
    }),
    'UnsupportedToken' : IDL.Record({ 'token' : TokenId }),
  });
  const ResultUnit = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : Error });
  const Result = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : Error });
  const QuoteArgs = IDL.Record({
    'zero_for_one' : IDL.Bool,
    'amount_in' : IDL.Nat,
    'pool_id' : IDL.Principal,
  });
  const QuoteResult = IDL.Record({
    'amount_out' : IDL.Nat,
    'price_impact' : IDL.Opt(IDL.Float64),
  });
  const ResultQuote = IDL.Variant({ 'Ok' : QuoteResult, 'Err' : Error });
  const TokenFeeBucket = IDL.Record({
    'token_id' : TokenId,
    'accumulated_per_share' : IDL.Nat,
    'total_staked' : IDL.Nat,
    'last_updated' : IDL.Nat64,
    'total_fees_collected' : IDL.Nat,
  });
  const TraderActivity = IDL.Record({
    'activity_points' : IDL.Nat,
    'last_trade' : IDL.Nat64,
    'total_volume' : IDL.Nat,
    'trade_count' : IDL.Nat64,
  });
  const UserStake = IDL.Record({
    'reward_debt' : IDL.Nat,
    'staked_at' : IDL.Nat64,
    'amount' : IDL.Nat,
  });
  const UserStakingStats = IDL.Record({
    'staked_amount' : IDL.Nat,
    'token_id' : TokenId,
    'lifetime_rewards' : IDL.Nat,
    'pending_rewards' : IDL.Nat,
  });
  const SwapArgs = IDL.Record({
    'token_in' : TokenId,
    'zero_for_one' : IDL.Bool,
    'amount_out_minimum' : IDL.Nat,
    'amount_in' : IDL.Nat,
    'token_out' : TokenId,
    'pool_id' : IDL.Principal,
  });
  const SwapResult = IDL.Record({
    'token_in' : TokenId,
    'amount_out' : IDL.Nat,
    'fee_amount' : IDL.Nat,
    'token_out' : TokenId,
  });
  const ResultSwap = IDL.Variant({ 'Ok' : SwapResult, 'Err' : Error });
  return IDL.Service({
    'add_admin' : IDL.Func([IDL.Principal], [ResultUnit], []),
    'bid_for_exposure' : IDL.Func([TokenId, IDL.Nat, IDL.Nat64], [Result], []),
    'claim_rewards' : IDL.Func([TokenId], [Result], []),
    'get_pending_rewards' : IDL.Func(
        [IDL.Principal, TokenId],
        [IDL.Nat],
        ['query'],
      ),
    'get_promo_pool' : IDL.Func([], [IDL.Nat], ['query']),
    'get_promoted_token' : IDL.Func([], [IDL.Opt(TokenId)], ['query']),
    'get_quote' : IDL.Func([QuoteArgs], [ResultQuote], []),
    'get_stats' : IDL.Func([], [IDL.Nat, IDL.Nat64, IDL.Nat64], ['query']),
    'get_token_bucket' : IDL.Func(
        [TokenId],
        [IDL.Opt(TokenFeeBucket)],
        ['query'],
      ),
    'get_trader_activity' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(TraderActivity)],
        ['query'],
      ),
    'get_user_stake' : IDL.Func(
        [IDL.Principal, TokenId],
        [IDL.Opt(UserStake)],
        ['query'],
      ),
    'get_user_stats' : IDL.Func(
        [IDL.Principal, TokenId],
        [UserStakingStats],
        ['query'],
      ),
    'set_fee_basis_points' : IDL.Func([IDL.Nat64], [ResultUnit], []),
    'stake' : IDL.Func([TokenId, IDL.Nat], [ResultUnit], []),
    'swap' : IDL.Func([SwapArgs], [ResultSwap], []),
    'unstake' : IDL.Func([TokenId, IDL.Nat], [ResultUnit], []),
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'pry_ledger' : IDL.Principal,
    'promo_distribution_period' : IDL.Opt(IDL.Nat64),
    'icpswap_factory' : IDL.Principal,
    'admins' : IDL.Vec(IDL.Principal),
    'fee_basis_points' : IDL.Opt(IDL.Nat64),
  });
  return [InitArgs];
};

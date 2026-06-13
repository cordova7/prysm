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
  const AddLimitOrderArgs = IDL.Record({
    'tick_limit' : IDL.Int,
    'pool_id' : IDL.Principal,
    'position_id' : IDL.Nat,
  });
  const ResultBool = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : Error });
  const Result = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : Error });
  const ResultRefunds = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat)),
    'Err' : Error,
  });
  const ClaimPositionArgs = IDL.Record({
    'pool_id' : IDL.Principal,
    'position_id' : IDL.Nat,
  });
  const TokenAmounts = IDL.Record({ 'amount0' : IDL.Nat, 'amount1' : IDL.Nat });
  const ResultTokenAmounts = IDL.Variant({
    'Ok' : TokenAmounts,
    'Err' : Error,
  });
  const DecreaseLiquidityArgs = IDL.Record({
    'liquidity' : IDL.Nat,
    'pool_id' : IDL.Principal,
    'position_id' : IDL.Nat,
  });
  const ActivePromoBid = IDL.Record({
    'id' : IDL.Nat64,
    'token_id' : TokenId,
    'created_at' : IDL.Nat64,
    'bid_amount' : IDL.Nat,
    'expires_at' : IDL.Nat64,
  });
  const PromoDistribution = IDL.Record({
    'id' : IDL.Nat64,
    'total_amount' : IDL.Nat,
    'recipient_count' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'total_volume' : IDL.Nat,
  });
  const PromoBid = IDL.Record({
    'id' : IDL.Nat64,
    'added_to_pool' : IDL.Bool,
    'token_id' : TokenId,
    'refunded' : IDL.Bool,
    'created_at' : IDL.Nat64,
    'is_active' : IDL.Bool,
    'bid_amount' : IDL.Nat,
    'expires_at' : IDL.Nat64,
    'bidder' : IDL.Principal,
  });
  const DistributionShare = IDL.Record({
    'recipient' : IDL.Principal,
    'distribution_id' : IDL.Nat64,
    'volume' : IDL.Nat,
    'claimed' : IDL.Bool,
    'share_amount' : IDL.Nat,
  });
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
  const IncreaseLiquidityArgs = IDL.Record({
    'amount0_desired' : IDL.Nat,
    'pool_id' : IDL.Principal,
    'amount1_desired' : IDL.Nat,
    'position_id' : IDL.Nat,
  });
  const MintPositionArgs = IDL.Record({
    'fee' : IDL.Nat,
    'amount0_desired' : IDL.Nat,
    'token0' : IDL.Principal,
    'token1' : IDL.Principal,
    'tick_lower' : IDL.Int,
    'pool_id' : IDL.Principal,
    'tick_upper' : IDL.Int,
    'amount1_desired' : IDL.Nat,
  });
  const RemoveLimitOrderArgs = IDL.Record({
    'pool_id' : IDL.Principal,
    'position_id' : IDL.Nat,
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
  const WithdrawArgs = IDL.Record({
    'fee' : IDL.Nat,
    'token' : IDL.Principal,
    'pool_id' : IDL.Principal,
    'amount' : IDL.Nat,
  });
  return IDL.Service({
    'add_admin' : IDL.Func([IDL.Principal], [ResultUnit], []),
    'add_limit_order' : IDL.Func([AddLimitOrderArgs], [ResultBool], []),
    'bid_for_exposure' : IDL.Func([TokenId, IDL.Nat, IDL.Nat64], [Result], []),
    'claim_bid_refunds' : IDL.Func([], [ResultRefunds], []),
    'claim_position' : IDL.Func([ClaimPositionArgs], [ResultTokenAmounts], []),
    'claim_rewards' : IDL.Func([TokenId], [Result], []),
    'decrease_liquidity' : IDL.Func(
        [DecreaseLiquidityArgs],
        [ResultTokenAmounts],
        [],
      ),
    'get_active_promo_bid' : IDL.Func([], [IDL.Opt(ActivePromoBid)], ['query']),
    'get_distribution_history' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(PromoDistribution)],
        ['query'],
      ),
    'get_my_bids' : IDL.Func([], [IDL.Vec(PromoBid)], ['query']),
    'get_my_distributions' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(DistributionShare)],
        ['query'],
      ),
    'get_my_promo_rewards' : IDL.Func([], [IDL.Nat], ['query']),
    'get_my_refundable_bids' : IDL.Func([], [IDL.Vec(PromoBid)], ['query']),
    'get_next_distribution_time' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_pending_rewards' : IDL.Func(
        [IDL.Principal, TokenId],
        [IDL.Nat],
        ['query'],
      ),
    'get_period_trader_stats' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat, IDL.Nat64))],
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
    'get_user_distribution_share' : IDL.Func(
        [IDL.Nat64, IDL.Principal],
        [IDL.Opt(DistributionShare)],
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
    'increase_liquidity' : IDL.Func([IncreaseLiquidityArgs], [Result], []),
    'mint_position' : IDL.Func([MintPositionArgs], [Result], []),
    'remove_limit_order' : IDL.Func([RemoveLimitOrderArgs], [ResultBool], []),
    'set_fee_basis_points' : IDL.Func([IDL.Nat64], [ResultUnit], []),
    'stake' : IDL.Func([TokenId, IDL.Nat], [ResultUnit], []),
    'swap' : IDL.Func([SwapArgs], [ResultSwap], []),
    'unstake' : IDL.Func([TokenId, IDL.Nat], [ResultUnit], []),
    'withdraw' : IDL.Func([WithdrawArgs], [Result], []),
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

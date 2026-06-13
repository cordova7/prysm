//! PRYSM Router Canister
//!
//! This canister handles:
//! - Swap execution through ICPSwap with 1% fee collection
//! - Staking PRY on tokens to earn trading fees
//! - Bid for exposure (promoted token placement)
//! - Trader activity tracking for promo pool distribution

use candid::{CandidType, Nat, Principal};
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use serde::{Deserialize, Serialize};

mod types;
mod storage;

use types::*;
use storage::*;

const ICP_LEDGER_ID_TEXT: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";

// ============================================================================
// ICPSwap pool interop types
// ============================================================================

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum IcpswapPoolError {
    CommonError,
    InternalError(String),
    UnsupportedToken(String),
    InsufficientFunds,
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum IcpswapResultNat {
    #[serde(rename = "ok")]
    Ok(Nat),
    #[serde(rename = "err")]
    Err(IcpswapPoolError),
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum IcpswapResultBool {
    #[serde(rename = "ok")]
    Ok(bool),
    #[serde(rename = "err")]
    Err(IcpswapPoolError),
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
struct IcpswapAmounts {
    pub amount0: Nat,
    pub amount1: Nat,
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum IcpswapResultAmounts {
    #[serde(rename = "ok")]
    Ok(IcpswapAmounts),
    #[serde(rename = "err")]
    Err(IcpswapPoolError),
}

// ============================================================================
// ICRC interop types (ICRC-1/2)
// ============================================================================

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum Icrc1TransferError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum Icrc2ApproveError {
    BadFee { expected_fee: Nat },
    InsufficientFunds { balance: Nat },
    AllowanceChanged { current_allowance: Nat },
    Expired { ledger_time: u64 },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum Icrc2TransferFromError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    InsufficientAllowance { allowance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum Icrc1TransferResult {
    Ok(Nat),
    Err(Icrc1TransferError),
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum Icrc2ApproveResult {
    Ok(Nat),
    Err(Icrc2ApproveError),
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
enum Icrc2TransferFromResult {
    Ok(Nat),
    Err(Icrc2TransferFromError),
}

// ============================================================================
// Initialization
// ============================================================================

#[init]
fn init(args: InitArgs) {
    update_config(|config| {
        config.pry_ledger = Some(args.pry_ledger);
        config.icpswap_factory = Some(args.icpswap_factory);
        config.admins = args.admins;
        config.fee_basis_points = args.fee_basis_points.unwrap_or(FEE_BASIS_POINTS);
        config.promo_pool.distribution_period = args.promo_distribution_period.unwrap_or(86400); // 24h default
    });
}

#[pre_upgrade]
fn pre_upgrade() {
    // Stable structures automatically persist to stable memory
    ic_cdk::println!("Pre-upgrade: State persisted to stable memory automatically");
}

#[post_upgrade]
fn post_upgrade(args: Option<UpgradeArgs>) {
    // Stable structures automatically restore from stable memory
    if let Some(args) = args {
        update_config(|config| {
            if let Some(pry_ledger) = args.pry_ledger {
                config.pry_ledger = Some(pry_ledger);
            }
            if let Some(icpswap_factory) = args.icpswap_factory {
                config.icpswap_factory = Some(icpswap_factory);
            }
            if let Some(admins) = args.admins {
                config.admins = admins;
            }
            if let Some(fee_basis_points) = args.fee_basis_points {
                config.fee_basis_points = fee_basis_points;
            }
            if let Some(period) = args.promo_distribution_period {
                config.promo_pool.distribution_period = period;
            }
        });
    }
    ic_cdk::println!("Post-upgrade: State restored from stable memory");
}

// ============================================================================
// Admin Functions
// ============================================================================

fn is_admin(principal: Principal) -> bool {
    get_config(|config| config.admins.contains(&principal))
}

#[update]
fn set_fee_basis_points(new_fee: u64) -> Result<()> {
    let caller = ic_cdk::caller();
    if !is_admin(caller) {
        return Err(Error::Unauthorized);
    }
    if new_fee > 1000 {
        return Err(Error::InvalidArguments {
            reason: "Fee cannot exceed 10%".to_string(),
        });
    }
    update_config(|config| {
        config.fee_basis_points = new_fee;
    });
    Ok(())
}

#[update]
fn add_admin(admin: Principal) -> Result<()> {
    let caller = ic_cdk::caller();
    if !is_admin(caller) {
        return Err(Error::Unauthorized);
    }
    update_config(|config| {
        if !config.admins.contains(&admin) {
            config.admins.push(admin);
        }
    });
    Ok(())
}

// ============================================================================
// Promo Pool Distribution
// ============================================================================

/// Check if distribution period has elapsed and distribute promo pool to active traders
async fn check_and_distribute_promo_pool() -> Result<Option<u64>> {
    // Check if distribution should occur
    let should_distribute = get_config(|config| {
        let now = ic_cdk::api::time();
        let elapsed = now.saturating_sub(config.promo_pool.last_distribution);
        let period_nanos = config.promo_pool.distribution_period * 1_000_000_000;

        elapsed >= period_nanos && config.promo_pool.total_balance > Nat::from(0u64)
    });

    if !should_distribute {
        return Ok(None);
    }

    // Collect eligible traders and their volumes
    let mut total_volume = Nat::from(0u64);
    let mut eligible_traders = Vec::new();

    TRADER_ACTIVITY.with(|map| {
        for (user, activity) in map.borrow().iter() {
            if activity.activity_points > Nat::from(0u64) {
                total_volume = total_volume.clone() + activity.activity_points.clone();
                eligible_traders.push((user, activity.activity_points.clone()));
            }
        }
    });

    let (pool_balance, pry_ledger) = get_config(|config| {
        let pry = config.pry_ledger.ok_or(Error::InternalError {
            reason: "PRY ledger not configured".to_string()
        })?;
        Ok::<_, Error>((config.promo_pool.total_balance.clone(), pry))
    })?;

    // Edge case: No active traders
    if total_volume == Nat::from(0u64) || eligible_traders.is_empty() {
        update_config(|config| {
            config.promo_pool.last_distribution = ic_cdk::api::time();
        });
        return Ok(None);
    }

    // Create distribution record
    let distribution_id = update_config(|config| {
        let id = config.next_distribution_id;
        config.next_distribution_id += 1;
        id
    });

    let distribution = PromoDistribution {
        id: distribution_id,
        timestamp: ic_cdk::api::time(),
        total_amount: pool_balance.clone(),
        total_volume: total_volume.clone(),
        recipient_count: eligible_traders.len() as u64,
    };

    DISTRIBUTION_HISTORY.with(|map| {
        map.borrow_mut().insert(distribution_id, distribution);
    });

    // Calculate and distribute shares
    for (trader, volume) in eligible_traders {
        // Calculate share: (trader_volume / total_volume) * pool_balance
        let share = (volume.clone() * pool_balance.clone()) / total_volume.clone();

        if share > Nat::from(0u64) {
            // Transfer PRY to trader
            let transfer_result = icrc1_transfer_with_fee(
                pry_ledger,
                Account::new(trader, None),
                share.clone(),
            )
            .await;

            let claimed = transfer_result.is_ok();

            // Record share
            let share_key = DistributionShareKey::new(distribution_id, trader);
            let share_record = DistributionShare {
                distribution_id,
                recipient: trader,
                volume: volume.clone(),
                share_amount: share.clone(),
                claimed,
            };

            DISTRIBUTION_SHARES.with(|map| {
                map.borrow_mut().insert(share_key, share_record);
            });

            // Update user's total promo rewards if transfer succeeded
            if claimed {
                USER_PROMO_REWARDS.with(|map| {
                    let mut map = map.borrow_mut();
                    let current: Nat = map.get(&trader).map(|n| n.0.clone()).unwrap_or(Nat::from(0u64));
                    let new_total = current + share.clone();
                    map.insert(trader, StorableNat(new_total));
                });
            }
        }
    }

    // Reset promo pool and activity points
    update_config(|config| {
        config.promo_pool.total_balance = Nat::from(0u64);
        config.promo_pool.last_distribution = ic_cdk::api::time();
    });

    // Reset activity points for next period
    TRADER_ACTIVITY.with(|map| {
        let mut map = map.borrow_mut();
        // Collect updates first to avoid borrow conflicts
        let updates: Vec<(Principal, TraderActivity)> = map.iter()
            .map(|(user, mut activity)| {
                activity.activity_points = Nat::from(0u64);
                (user, activity)
            })
            .collect();

        // Apply updates
        for (user, activity) in updates {
            map.insert(user, activity);
        }
    });

    Ok(Some(distribution_id))
}

// ============================================================================
// Swap Functions
// ============================================================================

/// Get a swap quote from ICPSwap pool
#[update]
async fn get_quote(args: QuoteArgs) -> Result<QuoteResult> {
    // ICPSwap pools expect a record with camelCase fields and string amounts.
    #[derive(CandidType, Deserialize, Serialize)]
    struct IcpswapQuoteArgs {
        #[serde(rename = "zeroForOne")]
        zero_for_one: bool,
        #[serde(rename = "amountIn")]
        amount_in: String,
        #[serde(rename = "amountOutMinimum")]
        amount_out_minimum: String,
    }

    let quote_args = IcpswapQuoteArgs {
        zero_for_one: args.zero_for_one,
        amount_in: args.amount_in.to_string(),
        amount_out_minimum: "0".to_string(),
    };

    let result: std::result::Result<(IcpswapResultNat,), _> =
        ic_cdk::call(args.pool_id, "quote", (quote_args,)).await;

    match result {
        Ok((IcpswapResultNat::Ok(amount_out),)) => Ok(QuoteResult {
            amount_out,
            price_impact: None, // TODO: Calculate price impact
        }),
        Ok((IcpswapResultNat::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: args.pool_id,
            method: "quote".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: args.pool_id,
            method: "quote".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

/// Execute a swap through ICPSwap
/// Requires prior ICRC-2 approval from the user
#[update]
async fn swap(args: SwapArgs) -> Result<SwapResult> {
    let caller = ic_cdk::caller();
    let router_principal = ic_cdk::id();

    // Check and distribute promo pool if period elapsed
    let _distribution_id = check_and_distribute_promo_pool().await?;

    let is_icp_in = is_icp_token(&args.token_in);
    let is_icp_out = is_icp_token(&args.token_out);

    // Calculate fee (input fee unless output is ICP)
    let fee_amount_in = calculate_fee(&args.amount_in);
    let amount_after_fee = if is_icp_out {
        args.amount_in.clone()
    } else {
        args.amount_in.clone() - fee_amount_in.clone()
    };

    // 1. Fetch ledger fees for input/output tokens
    let token_in_ledger_fee = icrc1_fee(args.token_in).await?;
    let token_out_ledger_fee = icrc1_fee(args.token_out).await?;

    // 2. Fetch pool-provided token fees (token0Fee/token1Fee)
    let (token0_fee, token1_fee) = icpswap_get_cached_token_fees(args.pool_id).await?;
    let (pool_token_in_fee, pool_token_out_fee) = if args.zero_for_one {
        (token0_fee, token1_fee)
    } else {
        (token1_fee, token0_fee)
    };

    // 3. Transfer tokens from user to router using ICRC-2 transfer_from
    let _transfer_result = icrc2_transfer_from(
        args.token_in,
        Account::new(caller, None),
        Account::new(router_principal, None),
        args.amount_in.clone(),
        token_in_ledger_fee.clone(),
    )
    .await?;

    // 4. Approve ICPSwap pool to spend our tokens (amount + pool token fee)
    let approve_amount = amount_after_fee.clone() + pool_token_in_fee.clone();
    let _approve_result = icrc2_approve(
        args.token_in,
        Account::new(args.pool_id, None),
        approve_amount,
        token_in_ledger_fee.clone(),
    )
    .await?;

    // 5. Call depositFromAndSwap on ICPSwap pool
    let swap_result = icpswap_deposit_and_swap(
        args.pool_id,
        args.zero_for_one,
        amount_after_fee.clone(),
        args.amount_out_minimum.clone(),
        pool_token_in_fee,
        pool_token_out_fee.clone(),
    )
    .await;

    let swap_result = match swap_result {
        Ok(amount_out) => amount_out,
        Err(err) => {
            // Attempt refund to the caller if pool swap failed
            let refund_result = icrc1_transfer(
                args.token_in,
                Account::new(caller, None),
                args.amount_in.clone(),
                token_in_ledger_fee.clone(),
            )
            .await;

            return match refund_result {
                Ok(_) => Err(err),
                Err(refund_err) => Err(Error::TransferFailed {
                    reason: format!("Swap failed: {:?}. Refund failed: {:?}", err, refund_err),
                }),
            };
        }
    };

    // 6. Transfer output tokens to user (apply ICP router fee + ledger fee)
    let mut fee_amount = fee_amount_in.clone();
    let net_received = if pool_token_out_fee > Nat::from(0u64) {
        if swap_result <= pool_token_out_fee {
            record_pending_refund(caller, args.token_out, swap_result.clone());
            return Err(Error::TransferFailed {
                reason: "Swap output does not cover pool output fee".to_string(),
            });
        }
        swap_result.clone() - pool_token_out_fee.clone()
    } else {
        swap_result.clone()
    };
    let fee_out_icp = if is_icp_out {
        calculate_fee(&net_received)
    } else {
        Nat::from(0u64)
    };
    if is_icp_out {
        fee_amount = fee_out_icp.clone();
    }

    let total_out_deductions = fee_out_icp.clone() + token_out_ledger_fee.clone();
    if net_received <= total_out_deductions {
        record_pending_refund(caller, args.token_out, net_received.clone());
        return Err(Error::TransferFailed {
            reason: "Output amount does not cover router + ledger fees".to_string(),
        });
    }
    let amount_out_to_user = net_received.clone() - total_out_deductions.clone();

    icrc1_transfer(
        args.token_out,
        Account::new(caller, None),
        amount_out_to_user.clone(),
        token_out_ledger_fee.clone(),
    )
    .await
    .map_err(|err| {
        record_pending_refund(caller, args.token_out, amount_out_to_user.clone());
        Error::TransferFailed {
            reason: format!("Output transfer failed: {:?}", err),
        }
    })?;

    // 5. Update fee bucket for the token
    if is_icp_out {
        update_fee_bucket(args.token_out, fee_amount.clone());
    } else {
        update_fee_bucket(args.token_in, fee_amount.clone());
    }

    // 6. Update trader activity
    let activity_points = if is_icp_in || is_icp_out {
        fee_amount.clone()
    } else {
        Nat::from(0u64)
    };
    update_trader_activity(caller, activity_points);

    // 7. Update stats
    update_config(|config| {
        config.total_fees_collected = config.total_fees_collected.clone() + fee_amount.clone();
        config.total_trades += 1;
    });

    Ok(SwapResult {
        amount_out: swap_result,
        fee_amount,
        token_in: args.token_in,
        token_out: args.token_out,
    })
}

/// Get pending refund amount for caller (if any).
#[query]
fn get_pending_refund(token: Principal) -> Nat {
    let caller = ic_cdk::caller();
    let key = UserTokenKey::new(caller, token);
    PENDING_REFUNDS.with(|map| {
        map.borrow()
            .get(&key)
            .map(|n| n.0.clone())
            .unwrap_or_else(|| Nat::from(0u64))
    })
}

/// Withdraw pending refund held by the router.
#[update]
async fn withdraw_pending_refund(token: Principal) -> Result<Nat> {
    let caller = ic_cdk::caller();
    let key = UserTokenKey::new(caller, token);

    let pending: Nat = PENDING_REFUNDS.with(|map| {
        map.borrow()
            .get(&key)
            .map(|n| n.0.clone())
            .unwrap_or_else(|| Nat::from(0u64))
    });

    if pending == Nat::from(0u64) {
        return Err(Error::InvalidArguments {
            reason: "No pending refund".to_string(),
        });
    }

    let fee = icrc1_fee(token).await?;
    if pending <= fee {
        return Err(Error::InvalidArguments {
            reason: "Pending amount does not cover ledger fee".to_string(),
        });
    }

    icrc1_transfer(token, Account::new(caller, None), pending.clone(), fee).await?;

    // Clear pending refund only after successful transfer
    PENDING_REFUNDS.with(|map| {
        map.borrow_mut().remove(&key);
    });

    Ok(pending)
}

/// Withdraw tokens held by the router (in case downstream transfer failed).
#[update]
async fn withdraw_from_router(token: Principal, amount: Nat) -> Result<Nat> {
    let caller = ic_cdk::caller();
    let router = ic_cdk::id();

    if amount == Nat::from(0u64) {
        return Err(Error::InvalidArguments {
            reason: "Amount must be greater than zero".to_string(),
        });
    }

    // Check router balance for token
    let balance: Nat = icrc1_balance_of(token, Account::new(router, None)).await?;
    if balance < amount.clone() {
        return Err(Error::InsufficientBalance {
            available: balance,
            required: amount,
        });
    }

    let fee = icrc1_fee(token).await?;
    if amount <= fee {
        return Err(Error::InvalidArguments {
            reason: "Amount does not cover ledger fee".to_string(),
        });
    }

    // Transfer from router to caller
    icrc1_transfer(token, Account::new(caller, None), amount, fee).await
}

// ============================================================================
// ICPSwap Pool Actions (Limit Orders, Liquidity, Claim)
// ============================================================================

#[update]
async fn add_limit_order(args: AddLimitOrderArgs) -> Result<bool> {
    let result = icpswap_add_limit_order(args.pool_id, args.position_id, args.tick_limit).await?;
    Ok(result)
}

#[update]
async fn remove_limit_order(args: RemoveLimitOrderArgs) -> Result<bool> {
    let result = icpswap_remove_limit_order(args.pool_id, args.position_id).await?;
    Ok(result)
}

#[update]
async fn mint_position(args: MintPositionArgs) -> Result<Nat> {
    let result = icpswap_mint(
        args.pool_id,
        args.fee,
        args.tick_lower,
        args.tick_upper,
        args.token0,
        args.token1,
        args.amount0_desired,
        args.amount1_desired,
    )
    .await?;
    Ok(result)
}

#[update]
async fn increase_liquidity(args: IncreaseLiquidityArgs) -> Result<Nat> {
    let result = icpswap_increase_liquidity(
        args.pool_id,
        args.position_id,
        args.amount0_desired,
        args.amount1_desired,
    )
    .await?;
    Ok(result)
}

#[update]
async fn decrease_liquidity(args: DecreaseLiquidityArgs) -> Result<TokenAmounts> {
    let result =
        icpswap_decrease_liquidity(args.pool_id, args.position_id, args.liquidity).await?;
    Ok(result)
}

#[update]
async fn claim_position(args: ClaimPositionArgs) -> Result<TokenAmounts> {
    let result = icpswap_claim(args.pool_id, args.position_id).await?;
    Ok(result)
}

#[update]
async fn withdraw(args: WithdrawArgs) -> Result<Nat> {
    let caller = ic_cdk::caller();

    // Clone amount before using it to avoid move errors
    let amount = args.amount.clone();
    let result = icpswap_withdraw(args.pool_id, args.token, args.amount, args.fee).await?;

    // Transfer withdrawn tokens to user
    icrc1_transfer_with_fee(
        args.token,
        Account::new(caller, None),
        amount,
    )
    .await?;

    Ok(result)
}

// ============================================================================
// Staking Functions
// ============================================================================

/// Stake PRY on a token to earn fees from swaps of that token
#[update]
async fn stake(token_id: TokenId, amount: Nat) -> Result<()> {
    let caller = ic_cdk::caller();
    let router = ic_cdk::id();
    let pry_ledger = get_config(|config| {
        config.pry_ledger.ok_or_else(|| Error::InternalError {
            reason: "PRY ledger not configured".to_string(),
        })
    })?;

    // Transfer PRY from user to router (use ledger fee)
    let pry_fee = icrc1_fee(pry_ledger).await?;
    icrc2_transfer_from(
        pry_ledger,
        Account::new(caller, None),
        Account::new(router, None),
        amount.clone(),
        pry_fee,
    )
    .await?;

    let key = UserTokenKey::new(caller, token_id);

    // Get or create bucket
    let mut bucket = TOKEN_BUCKETS.with(|map| {
        map.borrow().get(&token_id).unwrap_or(TokenFeeBucket {
            token_id,
            total_fees_collected: Nat::from(0u64),
            total_staked: Nat::from(0u64),
            accumulated_per_share: Nat::from(0u64),
            last_updated: ic_cdk::api::time(),
        })
    });

    // Get or create stake
    let mut stake = USER_STAKES.with(|map| {
        map.borrow().get(&key).unwrap_or_default()
    });

    // If user has existing stake, claim pending rewards first
    if stake.amount > Nat::from(0u64) {
        let pending = calculate_pending_rewards(&stake, &bucket);
        if pending > Nat::from(0u64) {
            // Add to lifetime rewards
            LIFETIME_REWARDS.with(|map| {
                let mut map = map.borrow_mut();
                let lifetime: Nat = map.get(&key).map(|n| n.0.clone()).unwrap_or(Nat::from(0u64));
                map.insert(key.clone(), StorableNat(lifetime + pending));
            });
        }
    }

    // Update stake
    stake.amount = stake.amount.clone() + amount.clone();
    stake.reward_debt = (stake.amount.clone() * bucket.accumulated_per_share.clone())
        / Nat::from(PRECISION);
    stake.staked_at = ic_cdk::api::time();

    // Update bucket
    bucket.total_staked = bucket.total_staked.clone() + amount;
    bucket.last_updated = ic_cdk::api::time();

    // Save updates
    USER_STAKES.with(|map| {
        map.borrow_mut().insert(key, stake);
    });

    TOKEN_BUCKETS.with(|map| {
        map.borrow_mut().insert(token_id, bucket);
    });

    Ok(())
}

/// Unstake PRY from a token
#[update]
async fn unstake(token_id: TokenId, amount: Nat) -> Result<()> {
    let caller = ic_cdk::caller();
    let _router = ic_cdk::id();
    let pry_ledger = get_config(|config| {
        config.pry_ledger.ok_or_else(|| Error::InternalError {
            reason: "PRY ledger not configured".to_string(),
        })
    })?;

    let key = UserTokenKey::new(caller, token_id);

    // Verify stake exists and has enough
    let stake = USER_STAKES.with(|map| map.borrow().get(&key));
    let bucket = TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id));

    let (_stake_amount, pending_rewards) = match (stake, bucket) {
        (Some(stake), Some(bucket)) => {
            if stake.amount < amount {
                return Err(Error::InsufficientBalance {
                    available: stake.amount.clone(),
                    required: amount.clone(),
                });
            } else {
                let pending = calculate_pending_rewards(&stake, &bucket);
                (stake.amount.clone(), pending)
            }
        }
        _ => {
            return Err(Error::InsufficientBalance {
                available: Nat::from(0u64),
                required: amount.clone(),
            });
        }
    };

    // Transfer PRY back to user
    icrc1_transfer_with_fee(
        pry_ledger,
        Account::new(caller, None),
        amount.clone(),
    )
    .await?;

    // Transfer pending rewards if any
    if pending_rewards > Nat::from(0u64) {
        icrc1_transfer_with_fee(
            pry_ledger,
            Account::new(caller, None),
            pending_rewards.clone(),
        )
        .await?;
    }

    // Update state
    let mut bucket = TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id).unwrap());
    let mut stake = USER_STAKES.with(|map| map.borrow().get(&key).unwrap());

    stake.amount = stake.amount.clone() - amount.clone();
    stake.reward_debt = (stake.amount.clone() * bucket.accumulated_per_share.clone())
        / Nat::from(PRECISION);
    stake.staked_at = ic_cdk::api::time();

    bucket.total_staked = bucket.total_staked.clone() - amount;
    bucket.last_updated = ic_cdk::api::time();

    // Save updates
    USER_STAKES.with(|map| {
        map.borrow_mut().insert(key.clone(), stake);
    });

    TOKEN_BUCKETS.with(|map| {
        map.borrow_mut().insert(token_id, bucket);
    });

    // Update lifetime rewards
    if pending_rewards > Nat::from(0u64) {
        LIFETIME_REWARDS.with(|map| {
            let mut map = map.borrow_mut();
            let lifetime: Nat = map.get(&key).map(|n| n.0.clone()).unwrap_or(Nat::from(0u64));
            map.insert(key, StorableNat(lifetime + pending_rewards));
        });
    }

    Ok(())
}

/// Claim accumulated staking rewards for a token
#[update]
async fn claim_rewards(token_id: TokenId) -> Result<Nat> {
    let caller = ic_cdk::caller();
    let pry_ledger = get_config(|config| {
        config.pry_ledger.ok_or_else(|| Error::InternalError {
            reason: "PRY ledger not configured".to_string(),
        })
    })?;

    let key = UserTokenKey::new(caller, token_id);

    // Calculate pending rewards
    let stake = USER_STAKES.with(|map| map.borrow().get(&key));
    let bucket = TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id));

    let pending = match (stake, bucket) {
        (Some(stake), Some(bucket)) => calculate_pending_rewards(&stake, &bucket),
        _ => Nat::from(0u64),
    };

    if pending == Nat::from(0u64) {
        return Ok(Nat::from(0u64));
    }

    // Transfer rewards
    icrc1_transfer_with_fee(
        pry_ledger,
        Account::new(caller, None),
        pending.clone(),
    )
    .await?;

    // Update reward debt
    let stake = USER_STAKES.with(|map| map.borrow().get(&key));
    let bucket = TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id));

    if let (Some(mut stake), Some(bucket)) = (stake, bucket) {
        stake.reward_debt = (stake.amount.clone() * bucket.accumulated_per_share.clone())
            / Nat::from(PRECISION);

        USER_STAKES.with(|map| {
            map.borrow_mut().insert(key.clone(), stake);
        });

        // Update lifetime rewards
        LIFETIME_REWARDS.with(|map| {
            let mut map = map.borrow_mut();
            let lifetime: Nat = map.get(&key).map(|n| n.0.clone()).unwrap_or(Nat::from(0u64));
            map.insert(key, StorableNat(lifetime + pending.clone()));
        });
    }

    Ok(pending)
}

// ============================================================================
// Promotion Functions
// ============================================================================

/// Bid PRY for promoted token placement
#[update]
async fn bid_for_exposure(token_id: TokenId, amount: Nat, duration_hours: u64) -> Result<Nat> {
    let caller = ic_cdk::caller();
    let router = ic_cdk::id();
    let pry_ledger = get_config(|config| {
        config.pry_ledger.ok_or_else(|| Error::InternalError {
            reason: "PRY ledger not configured".to_string(),
        })
    })?;

    // Transfer PRY from bidder to router (use ledger fee)
    let pry_fee = icrc1_fee(pry_ledger).await?;
    icrc2_transfer_from(
        pry_ledger,
        Account::new(caller, None),
        Account::new(router, None),
        amount.clone(),
        pry_fee,
    )
    .await?;

    // Create bid
    let bid_id = update_config(|config| {
        let id = config.next_bid_id;
        config.next_bid_id += 1;
        id
    });

    let now = ic_cdk::api::time();
    let expires_at = now + (duration_hours * 3600 * 1_000_000_000);

    let bid = PromoBid {
        id: bid_id,
        bidder: caller,
        token_id,
        bid_amount: amount.clone(),
        created_at: now,
        expires_at,
        is_active: false,
        refunded: false,
        added_to_pool: false,
    };

    PROMO_BIDS.with(|map| {
        map.borrow_mut().insert(bid_id, bid);
    });

    // NOTE: Bid amount is NOT added to promo pool immediately
    // Only winning bids are added to pool when they become active

    // Determine new winner and process refunds
    update_promo_winner().await;

    Ok(Nat::from(bid_id))
}

/// Get the currently promoted token
#[query]
fn get_promoted_token() -> Option<TokenId> {
    PROMO_BIDS.with(|map| {
        let now = ic_cdk::api::time();
        map.borrow()
            .iter()
            .map(|(_, bid)| bid)
            .filter(|b| b.is_active && b.expires_at > now)
            .max_by_key(|b| b.bid_amount.clone())
            .map(|b| b.token_id)
    })
}

/// Get the currently winning bid details (public view)
#[query]
fn get_active_promo_bid() -> Option<ActivePromoBid> {
    PROMO_BIDS.with(|map| {
        let now = ic_cdk::api::time();
        map.borrow()
            .iter()
            .map(|(_, bid)| bid)
            .filter(|b| b.is_active && b.expires_at > now && !b.refunded)
            .max_by_key(|b| b.bid_amount.clone())
            .map(|b| ActivePromoBid {
                id: b.id,
                token_id: b.token_id,
                bid_amount: b.bid_amount.clone(),
                created_at: b.created_at,
                expires_at: b.expires_at,
            })
    })
}

/// Get promo pool balance
#[query]
fn get_promo_pool() -> Nat {
    get_config(|config| config.promo_pool.total_balance.clone())
}

/// Claim refund for losing or expired bids (50% refund)
#[update]
async fn claim_bid_refunds() -> Result<Vec<(u64, Nat)>> {
    let caller = ic_cdk::caller();
    let pry_ledger = get_config(|config| {
        config.pry_ledger.ok_or_else(|| Error::InternalError {
            reason: "PRY ledger not configured".to_string(),
        })
    })?;

    let mut refunds = Vec::new();

    // Collect bids eligible for refund
    // Eligible: non-winning bids that have been processed (added_to_pool = true)
    let refundable_bids: Vec<(u64, PromoBid)> = PROMO_BIDS.with(|map| {
        map.borrow()
            .iter()
            .filter(|(_, bid)| {
                bid.bidder == caller
                    && !bid.refunded
                    && bid.added_to_pool  // 50% was already added to pool
                    && !bid.is_active     // Not the current winner
            })
            .collect()
    });

    if refundable_bids.is_empty() {
        return Ok(refunds);
    }

    // Process each refund - return 50% of bid amount
    for (bid_id, bid) in refundable_bids {
        // Calculate 50% refund amount
        let refund_amount = bid.bid_amount.clone() / Nat::from(2u64);

        // Transfer 50% PRY back to bidder
        match icrc1_transfer_with_fee(
            pry_ledger,
            Account::new(caller, None),
            refund_amount.clone(),
        )
        .await
        {
            Ok(_) => {
                // Mark as refunded
                PROMO_BIDS.with(|map| {
                    let mut map = map.borrow_mut();
                    if let Some(mut bid) = map.get(&bid_id) {
                        bid.refunded = true;
                        map.insert(bid_id, bid);
                    }
                });

                refunds.push((bid_id, refund_amount));
            }
            Err(e) => {
                ic_cdk::println!("Failed to refund bid {}: {:?}", bid_id, e);
                // Continue with other refunds
            }
        }
    }

    Ok(refunds)
}

/// Get all refundable bids for the caller (50% refund available)
#[query]
fn get_my_refundable_bids() -> Vec<PromoBid> {
    let caller = ic_cdk::caller();

    PROMO_BIDS.with(|map| {
        map.borrow()
            .iter()
            .map(|(_, bid)| bid)
            .filter(|bid| {
                bid.bidder == caller
                    && !bid.refunded
                    && bid.added_to_pool  // 50% was added to pool
                    && !bid.is_active     // Not the current winner
            })
            .collect()
    })
}

/// Get all refundable bids for a specific user (public view)
#[query]
fn get_user_refundable_bids(user: Principal) -> Vec<PromoBid> {
    PROMO_BIDS.with(|map| {
        map.borrow()
            .iter()
            .map(|(_, bid)| bid)
            .filter(|bid| {
                bid.bidder == user
                    && !bid.refunded
                    && bid.added_to_pool
                    && !bid.is_active
            })
            .collect()
    })
}

/// Get all bids placed by the caller
#[query]
fn get_my_bids() -> Vec<PromoBid> {
    let caller = ic_cdk::caller();

    PROMO_BIDS.with(|map| {
        map.borrow()
            .iter()
            .map(|(_, bid)| bid)
            .filter(|bid| bid.bidder == caller)
            .collect()
    })
}

/// Get all bids placed by a specific user (public view)
#[query]
fn get_user_bids(user: Principal) -> Vec<PromoBid> {
    PROMO_BIDS.with(|map| {
        map.borrow()
            .iter()
            .map(|(_, bid)| bid)
            .filter(|bid| bid.bidder == user)
            .collect()
    })
}

// ============================================================================
// Query Functions
// ============================================================================

/// Get user's stake on a token
#[query]
fn get_user_stake(user: Principal, token_id: TokenId) -> Option<UserStake> {
    USER_STAKES.with(|map| {
        map.borrow().get(&UserTokenKey::new(user, token_id))
    })
}

/// Get pending rewards for a user on a token
#[query]
fn get_pending_rewards(user: Principal, token_id: TokenId) -> Nat {
    let key = UserTokenKey::new(user, token_id);
    let stake = USER_STAKES.with(|map| map.borrow().get(&key));
    let bucket = TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id));

    match (stake, bucket) {
        (Some(stake), Some(bucket)) => calculate_pending_rewards(&stake, &bucket),
        _ => Nat::from(0u64),
    }
}

/// Get token fee bucket info
#[query]
fn get_token_bucket(token_id: TokenId) -> Option<TokenFeeBucket> {
    TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id))
}

/// Get trader activity
#[query]
fn get_trader_activity(user: Principal) -> Option<TraderActivity> {
    TRADER_ACTIVITY.with(|map| map.borrow().get(&user))
}

/// Get user staking stats
#[query]
fn get_user_stats(user: Principal, token_id: TokenId) -> UserStakingStats {
    let key = UserTokenKey::new(user, token_id);

    let staked_amount = USER_STAKES.with(|map| {
        map.borrow()
            .get(&key)
            .map(|s| s.amount.clone())
            .unwrap_or(Nat::from(0u64))
    });

    let stake = USER_STAKES.with(|map| map.borrow().get(&key));
    let bucket = TOKEN_BUCKETS.with(|map| map.borrow().get(&token_id));

    let pending = match (stake, bucket) {
        (Some(stake), Some(bucket)) => calculate_pending_rewards(&stake, &bucket),
        _ => Nat::from(0u64),
    };

    let lifetime = LIFETIME_REWARDS.with(|map| {
        map.borrow()
            .get(&key)
            .map(|n| n.0.clone())
            .unwrap_or(Nat::from(0u64))
    });

    UserStakingStats {
        token_id,
        staked_amount,
        pending_rewards: pending,
        lifetime_rewards: lifetime,
    }
}

/// Get canister stats
#[query]
fn get_stats() -> (Nat, u64, u64) {
    get_config(|config| {
        (
            config.total_fees_collected.clone(),
            config.total_trades,
            config.fee_basis_points,
        )
    })
}

/// Get distribution history (paginated)
#[query]
fn get_distribution_history(offset: u64, limit: u64) -> Vec<PromoDistribution> {
    DISTRIBUTION_HISTORY.with(|map| {
        let mut distributions: Vec<_> = map.borrow()
            .iter()
            .map(|(_, dist)| dist)
            .collect();

        // Sort by id descending (most recent first)
        distributions.sort_by(|a, b| b.id.cmp(&a.id));

        distributions
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect()
    })
}

/// Get user's share in a specific distribution
#[query]
fn get_user_distribution_share(distribution_id: u64, user: Principal) -> Option<DistributionShare> {
    DISTRIBUTION_SHARES.with(|map| {
        map.borrow().get(&DistributionShareKey::new(distribution_id, user))
    })
}

/// Get caller's total promo rewards received
#[query]
fn get_my_promo_rewards() -> Nat {
    let caller = ic_cdk::caller();
    USER_PROMO_REWARDS.with(|map| {
        map.borrow()
            .get(&caller)
            .map(|n| n.0.clone())
            .unwrap_or(Nat::from(0u64))
    })
}

/// Get promo rewards for a specific user (public view)
#[query]
fn get_user_promo_rewards(user: Principal) -> Nat {
    USER_PROMO_REWARDS.with(|map| {
        map.borrow()
            .get(&user)
            .map(|n| n.0.clone())
            .unwrap_or(Nat::from(0u64))
    })
}

/// Get all distributions where caller received rewards (paginated)
#[query]
fn get_my_distributions(offset: u64, limit: u64) -> Vec<DistributionShare> {
    let caller = ic_cdk::caller();
    DISTRIBUTION_SHARES.with(|map| {
        map.borrow()
            .iter()
            .filter(|(key, _)| key.user == caller)
            .map(|(_, share)| share)
            .skip(offset as usize)
            .take(limit as usize)
            .collect()
    })
}

/// Get all distributions where a user received rewards (paginated, public view)
#[query]
fn get_user_distributions(user: Principal, offset: u64, limit: u64) -> Vec<DistributionShare> {
    DISTRIBUTION_SHARES.with(|map| {
        map.borrow()
            .iter()
            .filter(|(key, _)| key.user == user)
            .map(|(_, share)| share)
            .skip(offset as usize)
            .take(limit as usize)
            .collect()
    })
}

/// Get next distribution time (nanoseconds)
#[query]
fn get_next_distribution_time() -> u64 {
    get_config(|config| {
        let period_nanos = config.promo_pool.distribution_period * 1_000_000_000;
        config.promo_pool.last_distribution + period_nanos
    })
}

/// Get current period trader stats (for transparency)
#[query]
fn get_period_trader_stats() -> Vec<(Principal, Nat, u64)> {
    TRADER_ACTIVITY.with(|map| {
        map.borrow()
            .iter()
            .filter(|(_, activity)| activity.activity_points > Nat::from(0u64))
            .map(|(user, activity)| {
                (user, activity.activity_points.clone(), activity.trade_count)
            })
            .collect()
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

fn calculate_fee(amount: &Nat) -> Nat {
    get_config(|config| {
        (amount.clone() * Nat::from(config.fee_basis_points)) / Nat::from(BASIS_POINTS_DIVISOR)
    })
}

fn calculate_pending_rewards(stake: &UserStake, bucket: &TokenFeeBucket) -> Nat {
    if stake.amount == Nat::from(0u64) {
        return Nat::from(0u64);
    }

    let accumulated = (stake.amount.clone() * bucket.accumulated_per_share.clone())
        / Nat::from(PRECISION);

    if accumulated > stake.reward_debt {
        accumulated - stake.reward_debt.clone()
    } else {
        Nat::from(0u64)
    }
}

fn update_fee_bucket(token_id: TokenId, fee_amount: Nat) {
    TOKEN_BUCKETS.with(|map| {
        let mut map = map.borrow_mut();
        let mut bucket = map.get(&token_id).unwrap_or(TokenFeeBucket {
            token_id,
            total_fees_collected: Nat::from(0u64),
            total_staked: Nat::from(0u64),
            accumulated_per_share: Nat::from(0u64),
            last_updated: ic_cdk::api::time(),
        });

        if bucket.total_staked > Nat::from(0u64) {
            let reward_per_share =
                (fee_amount.clone() * Nat::from(PRECISION)) / bucket.total_staked.clone();
            bucket.accumulated_per_share =
                bucket.accumulated_per_share.clone() + reward_per_share;
        }

        bucket.total_fees_collected = bucket.total_fees_collected.clone() + fee_amount;
        bucket.last_updated = ic_cdk::api::time();

        map.insert(token_id, bucket);
    });
}

fn is_icp_token(token: &Principal) -> bool {
    token.to_text() == ICP_LEDGER_ID_TEXT
}

fn update_trader_activity(user: UserId, volume: Nat) {
    TRADER_ACTIVITY.with(|map| {
        let mut map = map.borrow_mut();
        let mut activity = map.get(&user).unwrap_or_default();
        activity.total_volume = activity.total_volume.clone() + volume.clone();
        activity.trade_count += 1;
        activity.last_trade = ic_cdk::api::time();
        activity.activity_points = activity.activity_points.clone() + volume;
        map.insert(user, activity);
    });
}

fn record_pending_refund(user: Principal, token: Principal, amount: Nat) {
    let key = UserTokenKey::new(user, token);
    PENDING_REFUNDS.with(|map| {
        let mut map = map.borrow_mut();
        let current: Nat = map.get(&key).map(|n| n.0.clone()).unwrap_or(Nat::from(0u64));
        map.insert(key, StorableNat(current + amount));
    });
}

async fn update_promo_winner() {
    let now = ic_cdk::api::time();

    PROMO_BIDS.with(|map| {
        let mut map = map.borrow_mut();

        // Step 1: Collect all bids and find the winning bid
        let all_bids: Vec<(u64, PromoBid)> = map.iter().collect();

        let winner_id = all_bids
            .iter()
            .filter(|(_, bid)| bid.expires_at > now && !bid.refunded)
            .max_by_key(|(_, bid)| bid.bid_amount.clone())
            .map(|(id, _)| *id);

        // Step 2: Process each bid
        let mut updates: Vec<(u64, PromoBid)> = Vec::new();

        for (id, mut bid) in all_bids {
            let is_winner = Some(id) == winner_id;

            // Deactivate all first
            bid.is_active = false;

            // Process based on bid state
            if bid.refunded {
                // Already refunded, skip
                updates.push((id, bid));
            } else if is_winner {
                // This is the winning bid - add 100% to pool
                bid.is_active = true;

                if !bid.added_to_pool {
                    update_config(|config| {
                        config.promo_pool.total_balance =
                            config.promo_pool.total_balance.clone() + bid.bid_amount.clone();
                    });
                    bid.added_to_pool = true;
                }

                updates.push((id, bid));
            } else {
                // Non-winning bid (active loser or expired) - add 50% to pool, 50% refundable
                if !bid.added_to_pool {
                    // Add 50% of bid to promo pool
                    let half_amount = bid.bid_amount.clone() / Nat::from(2u64);
                    update_config(|config| {
                        config.promo_pool.total_balance =
                            config.promo_pool.total_balance.clone() + half_amount;
                    });
                    bid.added_to_pool = true;
                }

                updates.push((id, bid));
            }
        }

        // Apply all updates
        for (id, bid) in updates {
            map.insert(id, bid);
        }
    });
}

// ============================================================================
// ICRC Token Interaction Helpers
// ============================================================================

async fn icrc2_transfer_from(
    token: Principal,
    from: Account,
    to: Account,
    amount: Nat,
    fee: Nat,
) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct TransferFromArgs {
        from: Account,
        to: Account,
        amount: Nat,
        fee: Option<Nat>,
        memo: Option<serde_bytes::ByteBuf>,
        created_at_time: Option<u64>,
        spender_subaccount: Option<[u8; 32]>,
    }

    let args = TransferFromArgs {
        from,
        to,
        amount,
        fee: Some(fee),
        memo: None,
        created_at_time: None,
        spender_subaccount: None,
    };

    let result: std::result::Result<(Icrc2TransferFromResult,), _> =
        ic_cdk::call(token, "icrc2_transfer_from", (args,)).await;

    match result {
        Ok((Icrc2TransferFromResult::Ok(block_index),)) => Ok(block_index),
        Ok((Icrc2TransferFromResult::Err(e),)) => Err(Error::TransferFailed {
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: token,
            method: "icrc2_transfer_from".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icrc2_approve(token: Principal, spender: Account, amount: Nat, fee: Nat) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct ApproveArgs {
        spender: Account,
        amount: Nat,
        fee: Option<Nat>,
        memo: Option<serde_bytes::ByteBuf>,
        from_subaccount: Option<[u8; 32]>,
        created_at_time: Option<u64>,
        expected_allowance: Option<Nat>,
        expires_at: Option<u64>,
    }

    let args = ApproveArgs {
        spender,
        amount,
        fee: Some(fee),
        memo: None,
        from_subaccount: None,
        created_at_time: None,
        expected_allowance: None,
        expires_at: None,
    };

    let result: std::result::Result<(Icrc2ApproveResult,), _> =
        ic_cdk::call(token, "icrc2_approve", (args,)).await;

    match result {
        Ok((Icrc2ApproveResult::Ok(block_index),)) => Ok(block_index),
        Ok((Icrc2ApproveResult::Err(e),)) => Err(Error::TransferFailed {
            reason: format!("Approve failed: {:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: token,
            method: "icrc2_approve".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icrc1_transfer(
    token: Principal,
    to: Account,
    amount: Nat,
    fee: Nat,
) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct TransferArgs {
        to: Account,
        amount: Nat,
        fee: Option<Nat>,
        memo: Option<serde_bytes::ByteBuf>,
        from_subaccount: Option<[u8; 32]>,
        created_at_time: Option<u64>,
    }

    let args = TransferArgs {
        to,
        amount,
        fee: Some(fee),
        memo: None,
        from_subaccount: None,
        created_at_time: None,
    };

    let result: std::result::Result<(Icrc1TransferResult,), _> =
        ic_cdk::call(token, "icrc1_transfer", (args,)).await;

    match result {
        Ok((Icrc1TransferResult::Ok(block_index),)) => Ok(block_index),
        Ok((Icrc1TransferResult::Err(e),)) => Err(Error::TransferFailed {
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: token,
            method: "icrc1_transfer".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icrc1_balance_of(token: Principal, account: Account) -> Result<Nat> {
    let result: std::result::Result<(Nat,), _> =
        ic_cdk::call(token, "icrc1_balance_of", (account,)).await;

    match result {
        Ok((balance,)) => Ok(balance),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: token,
            method: "icrc1_balance_of".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icrc1_transfer_with_fee(
    token: Principal,
    to: Account,
    amount: Nat,
) -> Result<Nat> {
    let fee = icrc1_fee(token).await?;
    icrc1_transfer(token, to, amount, fee).await
}

async fn icpswap_deposit_and_swap(
    pool: Principal,
    zero_for_one: bool,
    amount_in: Nat,
    amount_out_minimum: Nat,
    token_in_fee: Nat,
    token_out_fee: Nat,
) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct DepositAndSwapArgs {
        #[serde(rename = "zeroForOne")]
        zero_for_one: bool,
        #[serde(rename = "amountIn")]
        amount_in: String,
        #[serde(rename = "amountOutMinimum")]
        amount_out_minimum: String,
        #[serde(rename = "tokenInFee")]
        token_in_fee: Nat,
        #[serde(rename = "tokenOutFee")]
        token_out_fee: Nat,
    }

    let args = DepositAndSwapArgs {
        zero_for_one,
        amount_in: amount_in.to_string(),
        amount_out_minimum: amount_out_minimum.to_string(),
        token_in_fee,
        token_out_fee,
    };

    let result: std::result::Result<(IcpswapResultNat,), _> =
        ic_cdk::call(pool, "depositFromAndSwap", (args,)).await;

    match result {
        Ok((IcpswapResultNat::Ok(amount_out),)) => Ok(amount_out),
        Ok((IcpswapResultNat::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "depositFromAndSwap".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "depositFromAndSwap".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icrc1_fee(token: Principal) -> Result<Nat> {
    let result: std::result::Result<(Nat,), _> = ic_cdk::call(token, "icrc1_fee", ()).await;
    match result {
        Ok((fee,)) => Ok(fee),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: token,
            method: "icrc1_fee".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_get_cached_token_fees(pool: Principal) -> Result<(Nat, Nat)> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct GetCachedTokenFeeRet {
        #[serde(rename = "token0Fee")]
        token_0_fee: Nat,
        #[serde(rename = "token1Fee")]
        token_1_fee: Nat,
    }

    let result: std::result::Result<(GetCachedTokenFeeRet,), _> =
        ic_cdk::call(pool, "getCachedTokenFee", ()).await;

    match result {
        Ok((ret,)) => Ok((ret.token_0_fee, ret.token_1_fee)),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "getCachedTokenFee".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_add_limit_order(
    pool: Principal,
    position_id: Nat,
    tick_limit: candid::Int,
) -> Result<bool> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct LimitOrderArgs {
        #[serde(rename = "positionId")]
        position_id: Nat,
        #[serde(rename = "tickLimit")]
        tick_limit: candid::Int,
    }

    let args = LimitOrderArgs {
        position_id,
        tick_limit,
    };

    let result: std::result::Result<(IcpswapResultBool,), _> =
        ic_cdk::call(pool, "addLimitOrder", (args,)).await;

    match result {
        Ok((IcpswapResultBool::Ok(ok),)) => Ok(ok),
        Ok((IcpswapResultBool::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "addLimitOrder".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "addLimitOrder".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_remove_limit_order(pool: Principal, position_id: Nat) -> Result<bool> {
    let result: std::result::Result<(IcpswapResultBool,), _> =
        ic_cdk::call(pool, "removeLimitOrder", (position_id,)).await;

    match result {
        Ok((IcpswapResultBool::Ok(ok),)) => Ok(ok),
        Ok((IcpswapResultBool::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "removeLimitOrder".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "removeLimitOrder".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_mint(
    pool: Principal,
    fee: Nat,
    tick_lower: candid::Int,
    tick_upper: candid::Int,
    token0: Principal,
    token1: Principal,
    amount0_desired: Nat,
    amount1_desired: Nat,
) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct MintArgs {
        #[serde(rename = "fee")]
        fee: Nat,
        #[serde(rename = "tickUpper")]
        tick_upper: candid::Int,
        #[serde(rename = "token0")]
        token0: String,
        #[serde(rename = "token1")]
        token1: String,
        #[serde(rename = "amount0Desired")]
        amount0_desired: String,
        #[serde(rename = "amount1Desired")]
        amount1_desired: String,
        #[serde(rename = "tickLower")]
        tick_lower: candid::Int,
    }

    let args = MintArgs {
        fee,
        tick_upper,
        token0: token0.to_string(),
        token1: token1.to_string(),
        amount0_desired: amount0_desired.to_string(),
        amount1_desired: amount1_desired.to_string(),
        tick_lower,
    };

    let result: std::result::Result<(IcpswapResultNat,), _> =
        ic_cdk::call(pool, "mint", (args,)).await;

    match result {
        Ok((IcpswapResultNat::Ok(value),)) => Ok(value),
        Ok((IcpswapResultNat::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "mint".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "mint".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_increase_liquidity(
    pool: Principal,
    position_id: Nat,
    amount0_desired: Nat,
    amount1_desired: Nat,
) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct IncreaseLiquidityArgs {
        #[serde(rename = "positionId")]
        position_id: Nat,
        #[serde(rename = "amount0Desired")]
        amount0_desired: String,
        #[serde(rename = "amount1Desired")]
        amount1_desired: String,
    }

    let args = IncreaseLiquidityArgs {
        position_id,
        amount0_desired: amount0_desired.to_string(),
        amount1_desired: amount1_desired.to_string(),
    };

    let result: std::result::Result<(IcpswapResultNat,), _> =
        ic_cdk::call(pool, "increaseLiquidity", (args,)).await;

    match result {
        Ok((IcpswapResultNat::Ok(value),)) => Ok(value),
        Ok((IcpswapResultNat::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "increaseLiquidity".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "increaseLiquidity".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_decrease_liquidity(
    pool: Principal,
    position_id: Nat,
    liquidity: Nat,
) -> Result<TokenAmounts> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct DecreaseLiquidityArgs {
        #[serde(rename = "liquidity")]
        liquidity: String,
        #[serde(rename = "positionId")]
        position_id: Nat,
    }

    let args = DecreaseLiquidityArgs {
        liquidity: liquidity.to_string(),
        position_id,
    };

    let result: std::result::Result<(IcpswapResultAmounts,), _> =
        ic_cdk::call(pool, "decreaseLiquidity", (args,)).await;

    match result {
        Ok((IcpswapResultAmounts::Ok(amounts),)) => Ok(TokenAmounts {
            amount0: amounts.amount0,
            amount1: amounts.amount1,
        }),
        Ok((IcpswapResultAmounts::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "decreaseLiquidity".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "decreaseLiquidity".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_claim(pool: Principal, position_id: Nat) -> Result<TokenAmounts> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct ClaimArgs {
        #[serde(rename = "positionId")]
        position_id: Nat,
    }

    let args = ClaimArgs { position_id };

    let result: std::result::Result<(IcpswapResultAmounts,), _> =
        ic_cdk::call(pool, "claim", (args,)).await;

    match result {
        Ok((IcpswapResultAmounts::Ok(amounts),)) => Ok(TokenAmounts {
            amount0: amounts.amount0,
            amount1: amounts.amount1,
        }),
        Ok((IcpswapResultAmounts::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "claim".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "claim".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

async fn icpswap_withdraw(
    pool: Principal,
    token: Principal,
    amount: Nat,
    fee: Nat,
) -> Result<Nat> {
    #[derive(CandidType, Deserialize, Serialize)]
    struct PoolWithdrawArgs {
        fee: Nat,
        token: String,
        amount: Nat,
    }

    let args = PoolWithdrawArgs {
        fee,
        token: token.to_string(),
        amount,
    };

    let result: std::result::Result<(IcpswapResultNat,), _> =
        ic_cdk::call(pool, "withdraw", (args,)).await;

    match result {
        Ok((IcpswapResultNat::Ok(value),)) => Ok(value),
        Ok((IcpswapResultNat::Err(e),)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "withdraw".to_string(),
            reason: format!("{:?}", e),
        }),
        Err((code, msg)) => Err(Error::CanisterCallFailed {
            canister: pool,
            method: "withdraw".to_string(),
            reason: format!("{:?}: {}", code, msg),
        }),
    }
}

// Export candid interface
ic_cdk::export_candid!();

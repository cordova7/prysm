//! Core types for the PRYSM Router Canister

use candid::{CandidType, Deserialize, Nat, Principal};
use serde::Serialize;

/// Type alias for token identifiers (canister principals)
pub type TokenId = Principal;

/// Type alias for user identifiers
pub type UserId = Principal;

/// Precision multiplier for accumulated reward calculations (1e18)
pub const PRECISION: u128 = 1_000_000_000_000_000_000;

/// Fee percentage in basis points (100 = 1%)
pub const FEE_BASIS_POINTS: u64 = 100;
pub const BASIS_POINTS_DIVISOR: u64 = 10_000;

// ============================================================================
// ICRC Types
// ============================================================================

/// ICRC-1 Account
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Hash)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

impl Account {
    pub fn new(owner: Principal, subaccount: Option<[u8; 32]>) -> Self {
        Self { owner, subaccount }
    }
}

// ============================================================================
// Swap Types
// ============================================================================

/// Arguments for executing a swap
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SwapArgs {
    /// Input token canister ID
    pub token_in: TokenId,
    /// Output token canister ID
    pub token_out: TokenId,
    /// Amount of input token (in smallest unit)
    pub amount_in: Nat,
    /// Minimum expected output (slippage protection)
    pub amount_out_minimum: Nat,
    /// ICPSwap pool canister ID
    pub pool_id: Principal,
    /// Whether token_in is token0 in the pool
    pub zero_for_one: bool,
}

/// Result of a successful swap
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SwapResult {
    /// Amount of output tokens received by user
    pub amount_out: Nat,
    /// Fee amount retained by PRYSM (in input token)
    pub fee_amount: Nat,
    /// Input token
    pub token_in: TokenId,
    /// Output token
    pub token_out: TokenId,
}

/// Arguments for getting a quote
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct QuoteArgs {
    pub pool_id: Principal,
    pub zero_for_one: bool,
    pub amount_in: Nat,
}

/// Quote result
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct QuoteResult {
    pub amount_out: Nat,
    pub price_impact: Option<f64>,
}

// ============================================================================
// ICPSwap Pool Action Types
// ============================================================================

/// Add a limit order on an existing position
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AddLimitOrderArgs {
    pub pool_id: Principal,
    pub position_id: Nat,
    pub tick_limit: candid::Int,
}

/// Remove a limit order by position id
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct RemoveLimitOrderArgs {
    pub pool_id: Principal,
    pub position_id: Nat,
}

/// Mint a new position in the pool
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MintPositionArgs {
    pub pool_id: Principal,
    pub fee: Nat,
    pub tick_lower: candid::Int,
    pub tick_upper: candid::Int,
    pub token0: Principal,
    pub token1: Principal,
    pub amount0_desired: Nat,
    pub amount1_desired: Nat,
}

/// Increase liquidity for an existing position
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct IncreaseLiquidityArgs {
    pub pool_id: Principal,
    pub position_id: Nat,
    pub amount0_desired: Nat,
    pub amount1_desired: Nat,
}

/// Decrease liquidity for an existing position
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DecreaseLiquidityArgs {
    pub pool_id: Principal,
    pub position_id: Nat,
    pub liquidity: Nat,
}

/// Claim fees for a position
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ClaimPositionArgs {
    pub pool_id: Principal,
    pub position_id: Nat,
}

/// Withdraw unused balance from pool
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct WithdrawArgs {
    pub pool_id: Principal,
    pub token: Principal,
    pub amount: Nat,
    pub fee: Nat,
}

/// Liquidity action result (amounts of token0/token1)
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TokenAmounts {
    pub amount0: Nat,
    pub amount1: Nat,
}

// ============================================================================
// Staking Types
// ============================================================================

/// Per-token fee bucket for staking rewards
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TokenFeeBucket {
    /// Token this bucket is for
    pub token_id: TokenId,
    /// Total fees collected for this token (in PRY)
    pub total_fees_collected: Nat,
    /// Total PRY staked on this token
    pub total_staked: Nat,
    /// Accumulated reward per share (scaled by PRECISION)
    pub accumulated_per_share: Nat,
    /// Last update timestamp
    pub last_updated: u64,
}

/// User's stake on a specific token
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct UserStake {
    /// Amount of PRY staked
    pub amount: Nat,
    /// Reward debt for accumulated reward calculation
    pub reward_debt: Nat,
    /// Timestamp when stake was created/last modified
    pub staked_at: u64,
}

/// User's staking stats (query response)
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct UserStakingStats {
    pub token_id: TokenId,
    pub staked_amount: Nat,
    pub pending_rewards: Nat,
    pub lifetime_rewards: Nat,
}

// ============================================================================
// Trader Activity Types
// ============================================================================

/// Tracking trader activity for promo pool distribution
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct TraderActivity {
    /// Total ICP fee equivalent for this user
    pub total_volume: Nat,
    /// Number of trades executed
    pub trade_count: u64,
    /// Timestamp of last trade
    pub last_trade: u64,
    /// Activity points for current distribution period (ICP fee equivalent)
    pub activity_points: Nat,
}

// ============================================================================
// Promotion Types
// ============================================================================

/// A bid for promoted token placement
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct PromoBid {
    /// Unique bid ID
    pub id: u64,
    /// Principal who placed the bid
    pub bidder: Principal,
    /// Token being promoted
    pub token_id: TokenId,
    /// Amount of PRY bid
    pub bid_amount: Nat,
    /// When the bid was created
    pub created_at: u64,
    /// When the promotion expires
    pub expires_at: u64,
    /// Whether this bid is currently winning
    pub is_active: bool,
    /// Whether bid has been refunded
    pub refunded: bool,
    /// Whether bid amount was added to promo pool
    pub added_to_pool: bool,
}

/// Public view of the current winning bid
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct ActivePromoBid {
    /// Unique bid ID
    pub id: u64,
    /// Token being promoted
    pub token_id: TokenId,
    /// Amount of PRY bid
    pub bid_amount: Nat,
    /// When the bid was created
    pub created_at: u64,
    /// When the promotion expires
    pub expires_at: u64,
}

/// Promotion pool state
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct PromoPool {
    /// Total PRY in the promo pool
    pub total_balance: Nat,
    /// Timestamp of last distribution
    pub last_distribution: u64,
    /// Distribution period in seconds (e.g., 86400 for daily)
    pub distribution_period: u64,
}

/// Record of a promo pool distribution event
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct PromoDistribution {
    /// Unique distribution ID
    pub id: u64,
    /// Timestamp when distribution occurred
    pub timestamp: u64,
    /// Total amount of PRY distributed
    pub total_amount: Nat,
    /// Total trading volume in the period
    pub total_volume: Nat,
    /// Number of recipients who received rewards
    pub recipient_count: u64,
}

/// Individual recipient's share in a distribution
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct DistributionShare {
    /// Distribution this share belongs to
    pub distribution_id: u64,
    /// Principal who received the share
    pub recipient: Principal,
    /// Trading volume that earned this share
    pub volume: Nat,
    /// Amount of PRY received
    pub share_amount: Nat,
    /// Whether the transfer was successful
    pub claimed: bool,
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum Error {
    /// Not authorized to perform this action
    Unauthorized,
    /// Insufficient balance
    InsufficientBalance { available: Nat, required: Nat },
    /// Insufficient allowance for transfer
    InsufficientAllowance { allowance: Nat, required: Nat },
    /// Slippage exceeded
    SlippageExceeded { expected: Nat, received: Nat },
    /// Token transfer failed
    TransferFailed { reason: String },
    /// Invalid arguments
    InvalidArguments { reason: String },
    /// Pool not found
    PoolNotFound,
    /// Token not supported
    UnsupportedToken { token: TokenId },
    /// Canister call failed
    CanisterCallFailed { canister: Principal, method: String, reason: String },
    /// Generic internal error
    InternalError { reason: String },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Unauthorized => write!(f, "Unauthorized"),
            Error::InsufficientBalance { available, required } => {
                write!(f, "Insufficient balance: {} available, {} required", available, required)
            }
            Error::InsufficientAllowance { allowance, required } => {
                write!(f, "Insufficient allowance: {} approved, {} required", allowance, required)
            }
            Error::SlippageExceeded { expected, received } => {
                write!(f, "Slippage exceeded: expected {}, received {}", expected, received)
            }
            Error::TransferFailed { reason } => write!(f, "Transfer failed: {}", reason),
            Error::InvalidArguments { reason } => write!(f, "Invalid arguments: {}", reason),
            Error::PoolNotFound => write!(f, "Pool not found"),
            Error::UnsupportedToken { token } => write!(f, "Unsupported token: {}", token),
            Error::CanisterCallFailed { canister, method, reason } => {
                write!(f, "Call to {}.{} failed: {}", canister, method, reason)
            }
            Error::InternalError { reason } => write!(f, "Internal error: {}", reason),
        }
    }
}

pub type Result<T> = std::result::Result<T, Error>;

// ============================================================================
// Init/Upgrade Args
// ============================================================================

/// Arguments for canister initialization
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct InitArgs {
    /// PRY ledger canister ID (ICP ledger as placeholder)
    pub pry_ledger: Principal,
    /// ICPSwap factory canister ID
    pub icpswap_factory: Principal,
    /// Admin principals who can modify settings
    pub admins: Vec<Principal>,
    /// Fee percentage in basis points (default 100 = 1%)
    pub fee_basis_points: Option<u64>,
    /// Promo pool distribution period in seconds
    pub promo_distribution_period: Option<u64>,
}

/// Arguments for canister upgrade
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpgradeArgs {
    pub pry_ledger: Option<Principal>,
    pub icpswap_factory: Option<Principal>,
    pub admins: Option<Vec<Principal>>,
    pub fee_basis_points: Option<u64>,
    pub promo_distribution_period: Option<u64>,
}

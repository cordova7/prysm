//! Stable storage utilities for the PRYSM Router
//!
//! This module provides stable memory storage for persistent state
//! across canister upgrades using ic-stable-structures.

use candid::{CandidType, Decode, Encode, Nat, Principal};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{
    DefaultMemoryImpl, StableBTreeMap, StableCell, Storable,
};
use ic_stable_structures::storable::Bound;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cell::RefCell;

use crate::types::*;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// ============================================================================
// Memory IDs for different stable storage areas
// ============================================================================

const CONFIG_MEM_ID: MemoryId = MemoryId::new(0);
const TOKEN_BUCKETS_MEM_ID: MemoryId = MemoryId::new(1);
const USER_STAKES_MEM_ID: MemoryId = MemoryId::new(2);
const LIFETIME_REWARDS_MEM_ID: MemoryId = MemoryId::new(3);
const TRADER_ACTIVITY_MEM_ID: MemoryId = MemoryId::new(4);
const PROMO_BIDS_MEM_ID: MemoryId = MemoryId::new(5);
const DISTRIBUTION_HISTORY_MEM_ID: MemoryId = MemoryId::new(6);
const DISTRIBUTION_SHARES_MEM_ID: MemoryId = MemoryId::new(7);
const USER_PROMO_REWARDS_MEM_ID: MemoryId = MemoryId::new(8);
const PENDING_REFUNDS_MEM_ID: MemoryId = MemoryId::new(9);

// ============================================================================
// Wrapper Types for Storable Implementation
// ============================================================================

/// Wrapper for Nat to implement Storable (newtype pattern to avoid orphan rules)
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct StorableNat(pub Nat);

impl From<Nat> for StorableNat {
    fn from(n: Nat) -> Self {
        StorableNat(n)
    }
}

impl From<StorableNat> for Nat {
    fn from(s: StorableNat) -> Self {
        s.0
    }
}

impl Storable for StorableNat {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(&self.0).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        StorableNat(Decode!(bytes.as_ref(), Nat).unwrap())
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ============================================================================
// Compound Keys
// ============================================================================

/// Key for user stakes: (user_principal, token_principal)
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UserTokenKey {
    pub user: Principal,
    pub token: Principal,
}

impl UserTokenKey {
    pub fn new(user: Principal, token: Principal) -> Self {
        Self { user, token }
    }
}

impl Storable for UserTokenKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

/// Key for distribution shares: (distribution_id, user_principal)
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DistributionShareKey {
    pub distribution_id: u64,
    pub user: Principal,
}

impl DistributionShareKey {
    pub fn new(distribution_id: u64, user: Principal) -> Self {
        Self { distribution_id, user }
    }
}

impl Storable for DistributionShareKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ============================================================================
// Config Structure (stored in StableCell)
// ============================================================================

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub pry_ledger: Option<Principal>,
    pub icpswap_factory: Option<Principal>,
    pub admins: Vec<Principal>,
    pub fee_basis_points: u64,
    pub promo_pool: PromoPool,
    pub total_fees_collected: Nat,
    pub total_trades: u64,
    pub next_bid_id: u64,
    pub next_distribution_id: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            pry_ledger: None,
            icpswap_factory: None,
            admins: Vec::new(),
            fee_basis_points: FEE_BASIS_POINTS,
            promo_pool: PromoPool::default(),
            total_fees_collected: Nat::from(0u64),
            total_trades: 0,
            next_bid_id: 0,
            next_distribution_id: 0,
        }
    }
}

impl Storable for Config {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ============================================================================
// Storable Implementations for Value Types
// ============================================================================

impl Storable for TokenFeeBucket {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for UserStake {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for TraderActivity {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for PromoBid {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for PromoDistribution {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for DistributionShare {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// Note: Nat, Principal, and u64 already have Storable implementations in ic-stable-structures
// No need to implement them here (orphan rule)

// ============================================================================
// Thread-Local Storage
// ============================================================================

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Configuration stored in StableCell
    pub static CONFIG: RefCell<StableCell<Config, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(CONFIG_MEM_ID)),
            Config::default()
        ).expect("Failed to initialize CONFIG")
    );

    // Token fee buckets: TokenId -> TokenFeeBucket
    pub static TOKEN_BUCKETS: RefCell<StableBTreeMap<Principal, TokenFeeBucket, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(TOKEN_BUCKETS_MEM_ID))
            )
        );

    // User stakes: UserTokenKey -> UserStake
    pub static USER_STAKES: RefCell<StableBTreeMap<UserTokenKey, UserStake, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(USER_STAKES_MEM_ID))
            )
        );

    // Lifetime rewards: UserTokenKey -> StorableNat
    pub static LIFETIME_REWARDS: RefCell<StableBTreeMap<UserTokenKey, StorableNat, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(LIFETIME_REWARDS_MEM_ID))
            )
        );

    // Trader activity: Principal -> TraderActivity
    pub static TRADER_ACTIVITY: RefCell<StableBTreeMap<Principal, TraderActivity, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(TRADER_ACTIVITY_MEM_ID))
            )
        );

    // Promo bids: u64 -> PromoBid
    pub static PROMO_BIDS: RefCell<StableBTreeMap<u64, PromoBid, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(PROMO_BIDS_MEM_ID))
            )
        );

    // Distribution history: u64 -> PromoDistribution
    pub static DISTRIBUTION_HISTORY: RefCell<StableBTreeMap<u64, PromoDistribution, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_HISTORY_MEM_ID))
            )
        );

    // Distribution shares: DistributionShareKey -> DistributionShare
    pub static DISTRIBUTION_SHARES: RefCell<StableBTreeMap<DistributionShareKey, DistributionShare, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_SHARES_MEM_ID))
            )
        );

    // User promo rewards: Principal -> StorableNat
    pub static USER_PROMO_REWARDS: RefCell<StableBTreeMap<Principal, StorableNat, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(USER_PROMO_REWARDS_MEM_ID))
            )
        );

    // Pending refunds: UserTokenKey -> StorableNat
    pub static PENDING_REFUNDS: RefCell<StableBTreeMap<UserTokenKey, StorableNat, Memory>> =
        RefCell::new(
            StableBTreeMap::init(
                MEMORY_MANAGER.with(|m| m.borrow().get(PENDING_REFUNDS_MEM_ID))
            )
        );
}

// ============================================================================
// Helper Functions for Config Access
// ============================================================================

pub fn get_config<R>(f: impl FnOnce(&Config) -> R) -> R {
    CONFIG.with(|c| f(&c.borrow().get()))
}

pub fn update_config<R>(f: impl FnOnce(&mut Config) -> R) -> R {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().clone();
        let result = f(&mut config);
        cell.set(config).expect("Failed to update CONFIG");
        result
    })
}

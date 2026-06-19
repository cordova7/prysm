# PRYSM Router

Rust canister for token routing and liquidity aggregation on the Internet Computer.

## Overview

A high-performance on-chain router that aggregates liquidity from multiple DEXs and finds optimal swap paths for users.

## Features

- **Multi-hop Routing** - Find best paths through multiple tokens
- **Liquidity Aggregation** - Combine liquidity from multiple sources
- **Best Price Optimization** - Maximize swap output amounts
- **Gas Optimization** - Minimize transaction costs
- **Candid Interface** - Standard ICP interface for integration

## Tech Stack

- **Rust** - Systems programming language
- **Candid** - Interface Definition Language for ICP
- **ic-agent** - Rust SDK for Internet Computer
- **serde** - Serialization framework

## Getting Started

### Prerequisites

- Rust 1.96+
- dfx SDK
- Cargo

### Installation

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install dfx
sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"

# Build the canister
cargo build --release
```

## Deployment

### Local Deployment

```bash
# Start local ICP replica
dfx start --background

# Deploy canister
dfx deploy prysm-router
```

### Mainnet Deployment

```bash
# Configure wallet
dfx identity use wallet
dfx ledger --network ic balance

# Deploy to mainnet
dfx deploy --network ic prysm-router
```

## Interface

### Candid Interface

```candid
service prysm_router : {
  // Get best swap route for a token pair
  get_route : (from_token: text, to_token: text, amount: nat) -> (vec RouteStep);

  // Execute a swap
  swap : (from_token: text, to_token: text, amount: nat, min_receive: nat) -> (SwapResult);

  // Get supported tokens
  get_supported_tokens : () -> (vec TokenInfo);

  // Get pool liquidity
  get_pool_liquidity : (token: text) -> (LiquidityInfo);
}
```

### Rust API

```rust
use prysm_router::{Router, Token, Route};

let router = Router::new();
let route = router.find_best_route(
    &Token::icp(),
    &Token::from_text("xxx"),
    1_000_000,
).await?;
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRYSM Router                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Route Engine                        │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │  Path   │  │  Price  │  │   Gas   │             │   │
│  │  │ Finder  │  │ Compare │  │Optimizer│             │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘             │   │
│  │       └───────────┼────────────┘                    │   │
│  │                   ▼                                 │   │
│  │         ┌───────────────┐                          │   │
│  │         │ Best Route    │                          │   │
│  │         │ Selector      │                          │   │
│  │         └───────┬───────┘                          │   │
│  └─────────────────┼───────────────────────────────────┘   │
│                    ▼                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               DEX Adapters                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ ICPSwap  │  │ KongSwap │  │  ICPEx   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Canister Settings

Edit `dfx.json`:

```json
{
  "canisters": {
    "prysm_router": {
      "type": "rust",
      "package": "prysm_router",
      "candid": "prysm_router.did"
    }
  }
}
```

## Testing

```bash
# Run unit tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_best_route
```

## Security Considerations

- All arithmetic operations use checked math to prevent overflow
- Slippage protection is enforced on all swaps
- Rate limiting on public endpoints
- Secure key management for production deployments

## License

MIT
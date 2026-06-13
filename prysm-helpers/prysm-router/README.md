# PRYSM Router

Rust canister for token routing and liquidity aggregation on the Internet Computer. Acts as the backend router for the PRYSM platform, routing swap requests to ICPSwap and other DEX canisters.

## Setup

```bash
# Start local replica
dfx start --background

# Deploy locally
dfx deploy

# Deploy to mainnet
dfx deploy --network ic
```

## Canister Interface

See `prysm_router.did` for the Candid interface.

## Tech Stack

- Rust
- `ic-cdk` for ICP canister development
- `dfx` SDK

## License

MIT
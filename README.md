# PRYSM

A token platform on the Internet Computer — including an ICPSwap aggregator frontend, a blockchain indexer, and a token routing canister.

## Projects

| Project | Description |
|---------|-------------|
| [prysm-app](./prysm-app) | Next.js frontend for PRYSM — token swaps, portfolio tracking, promotions, and analytics |
| [prysm-helpers/prysm-indexer](./prysm-helpers/prysm-indexer) | Node.js indexer that extracts holder data, funding sources, and trading analytics from ICP canisters |
| [prysm-helpers/prysm-router](./prysm-helpers/prysm-router) | Rust canister for token routing and liquidity aggregation on the Internet Computer |

## Prerequisites

- Node.js 18+
- Rust 1.96+ (for `prysm-router`)
- `dfx` SDK (for canister deployment)
- Supabase project (for data storage)

## Setup

See individual project READMEs for setup instructions.

## License

MIT
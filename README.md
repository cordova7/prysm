# PRYSM

> A full-stack token platform on the Internet Computer. Featuring an ICPSwap aggregator frontend, blockchain indexer, and token routing canister.

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Frontend: Next.js" src="https://img.shields.io/badge/Frontend-Next.js-000000">
  <img alt="Indexer: Node.js" src="https://img.shields.io/badge/Indexer-Node.js-339933">
  <img alt="Canister: Rust" src="https://img.shields.io/badge/Canister-Rust-orange">
  <img alt="Platform: ICP" src="https://img.shields.io/badge/Platform-Internet%20Computer-3B00B9">
</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/cordova7/prysm?style=social">
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/cordova7/prysm?style=social">
  <img alt="GitHub issues" src="https://img.shields.io/github/issues/cordova7/prysm">
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/cordova7/prysm">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/cordova7/prysm/main/HOMEPAGE.png" alt="Prysm screenshot" width="900">
</p>

---

## Topics

`nextjs` `rust` `internet-computer` `defi` `token-swap` `blockchain-indexer` `icp` `cryptocurrency` `web3`

---

## Overview

PRYSM is a comprehensive token platform built on the Internet Computer blockchain. The platform consists of three main components:

| Component | Technology | Description |
|-----------|------------|-------------|
| [prysm-app](./prysm-app) | Next.js | ICPSwap aggregator frontend for token swaps and portfolio tracking |
| [prysm-indexer](./prysm-helpers/prysm-indexer) | Node.js | Blockchain indexer for holder data, funding sources, and trading analytics |
| [prysm-router](./prysm-helpers/prysm-router) | Rust | Canister for token routing and liquidity aggregation |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         PRYSM Platform                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  prysm-app   │  │prysm-indexer │  │ prysm-router │        │
│  │   (Next.js)  │  │  (Node.js)   │  │    (Rust)    │        │
│  │              │  │              │  │              │        │
│  │  - Token UI  │  │  - Holders   │  │  - Routing   │        │
│  │  - Portfolio │  │  - Funding   │  │  - Liquidity │        │
│  │  - Analytics │  │  - Analytics │  │  - Aggregation│       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                │
│         └──────────────────┼──────────────────┘                │
│                            │                                   │
│  ┌─────────────────────────┴───────────────────────────┐      │
│  │              Internet Computer                      │      │
│  │         (ICPSwap, Canisters, Ledgers)                │      │
│  └─────────────────────────────────────────────────────┘      │
│                            │                                   │
│                   ┌────────┴────────┐                          │
│                   │   Supabase     │                          │
│                   │  (Data Store)  │                          │
│                   └────────────────┘                          │
└────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js 18+** - For prysm-app and prysm-indexer
- **Rust 1.96+** - For prysm-router
- **dfx SDK** - [Install guide](https://internetcomputer.org/docs/current/developer-docs/getting-started/install)
- **Supabase project** - For data storage

### Installation

```bash
# Clone the repository
git clone https://github.com/cordova7/prysm.git
cd prysm

# Install frontend dependencies
cd prysm-app
npm install

# Install indexer dependencies
cd ../prysm-helpers/prysm-indexer
npm install

# Build canister
cd ../prysm-router
cargo build --release
```

## Components

### prysm-app

Next.js frontend for the PRYSM platform.

**Features:**
- Token swap interface (ICPSwap aggregator)
- Portfolio tracking dashboard
- Promotions and analytics
- Real-time price data
- Wallet integration

**Setup:**
```bash
cd prysm-app
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### prysm-indexer

Node.js blockchain indexer that extracts and analyzes on-chain data.

**Features:**
- Holder data extraction
- Funding source tracking
- Trading analytics
- Pool synchronization
- Incremental updates

**Setup:**
```bash
cd prysm-helpers/prysm-indexer
cp .env.example .env
# Configure database and RPC endpoints
npm run start
```

### prysm-router

Rust canister for token routing and liquidity aggregation on the Internet Computer.

**Features:**
- Multi-hop token routing
- Liquidity aggregation across DEXs
- Best price optimization
- Gas optimization

**Setup:**
```bash
cd prysm-helpers/prysm-router
dfx deploy prysm-router
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, React 18, TypeScript | User interface |
| Styling | Tailwind CSS | Modern responsive design |
| State | React Context, SWR | Client-side state management |
| Backend | Node.js, TypeScript | Indexer service |
| Canister | Rust, Candid | On-chain logic |
| Database | Supabase | Data persistence |
| Blockchain | Internet Computer | Decentralized backend |

## Project Structure

```
prysm/
├── prysm-app/                    # Next.js frontend
│   ├── app/                      # App Router pages
│   ├── components/               # React components
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom hooks
│   ├── lib/                      # Utilities
│   ├── data/                     # Static data
│   ├── types/                    # TypeScript types
│   └── supabase/                 # Database client
│
├── prysm-helpers/                # Backend utilities
│   ├── prysm-indexer/            # Blockchain indexer
│   │   ├── src/
│   │   │   ├── ic/              # IC data sources
│   │   │   ├── icpswap/         # DEX integration
│   │   │   ├── rosetta/         # Rosetta API
│   │   │   └── trading/         # Trading analytics
│   │   └── tests/               # Test suites
│   │
│   └── prysm-router/            # Rust canister
│       ├── src/
│       │   └── prysm_router/    # Canister logic
│       └── canister_ids.json    # Deployed canister IDs
│
├── CONTRIBUTING.md               # Contribution guidelines
├── CHANGELOG.md                  # Version history
└── LICENSE                       # MIT license
```

## Development

```bash
# Start local ICP replica
dfx start --background

# Deploy canister
cd prysm-helpers/prysm-router
dfx deploy

# Run frontend
cd ../../prysm-app
npm run dev

# Run indexer
cd ../prysm-helpers/prysm-indexer
npm run dev
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

> **Note**: This project involves financial transactions. Always:
- Test on testnet before production
- Never commit secrets to version control
- Use environment variables for sensitive configuration
- Review canister code before deployment

## License

MIT - See [LICENSE](./LICENSE).

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cordova7/prysm&type=Date)](https://star-history.com/#cordova7/prysm&Date)
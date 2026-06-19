# PRYSM Indexer

Node.js blockchain indexer for the Internet Computer - extracts holder data, funding sources, and trading analytics.

## Overview

A high-performance indexer that monitors the Internet Computer blockchain, extracts meaningful data from canisters, and stores it in Supabase for efficient querying by the PRYSM frontend.

## Features

- **Holder Discovery** - Track token holders and their balances
- **Funding Source Analysis** - Identify where token purchases originate
- **Trading Analytics** - Volume, liquidity, and price metrics
- **Pool Synchronization** - Keep pool data up-to-date
- **Incremental Updates** - Efficient sync using block heights

## Tech Stack

- **Node.js** - Runtime environment
- **TypeScript** - Type-safe development
- **Supabase** - PostgreSQL database
- **ic-agent** - Internet Computer SDK
- **Rosetta API** - Blockchain data access
- **Jest** - Testing framework

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (via Supabase)
- Access to ICP mainnet or testnet

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/prysm

# ICP Configuration
ICP_NETWORK=mainnet
IC_RPC_URL=https://ic0.app

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_service_role_key

# Indexer Settings
SYNC_INTERVAL_MS=60000
BATCH_SIZE=100
```

## Usage

### Start Indexing

```bash
# Start the indexer
npm run start

# Start with specific modules
npm run start -- --module=holders

# Start in watch mode (development)
npm run dev
```

### Command Line Options

```bash
# Index specific canister
npm run start -- --canister=aaaaa-aa

# Resume from block height
npm run start -- --from-block=12345678

# Run once and exit
npm run start -- --once
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PRYSM Indexer                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │ IC Sources  │    │  Rosetta    │    │  ICPSwap    │   │
│  │             │    │   API       │    │   Client    │   │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                    ┌────────┴────────┐                     │
│                    │   Ingestion     │                     │
│                    │     Layer       │                     │
│                    └────────┬────────┘                     │
│                             │                               │
│                    ┌────────┴────────┐                     │
│                    │   Analytics     │                     │
│                    │     Engine      │                     │
│                    └────────┬────────┘                     │
│                             │                               │
│                    ┌────────┴────────┐                     │
│                    │    Supabase     │                     │
│                    │   (Storage)      │                     │
│                    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Modules

### Holder Discovery (`src/holder-discovery/`)

Tracks token holders and their balances across canisters.

### Funding Analysis (`src/funding/`)

Analyzes transaction sources and funding patterns.

### Trading Analytics (`src/trading/`)

Computes trading metrics and price data.

### Pool Sync (`src/icpswap/`)

Synchronizes liquidity pool data from ICPSwap.

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=icpswap

# Watch mode
npm run test:watch
```

## Database Schema

See `schema.sql` for the complete database schema.

## License

MIT
# PRYSM — Getting Started

A Next.js frontend for the PRYSM token platform on the Internet Computer — ICPSwap aggregator with portfolio tracking, holder analytics, and token promotions.

## Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) account (free tier works)
- [dfx](https://internetcomputer.org/docs/current/developer-docs/getting-started/install) 0.23+
- [Internet Identity](https://identity.internetcomputer.org) (for auth — create one at the URL printed by `dfx identity get-window-origin`)

## Setup

### 1. Clone & install

```bash
git clone <repo-url> prysm
cd prysm/prysm-app
npm install
```

### 2. Supabase

Create a new Supabase project at [supabase.com](https://supabase.com), then run the migrations:

```bash
# In prysm-app/
npx supabase db push
```

Or manually via the Supabase SQL editor — copy the contents of these files in order:
1. `supabase-migrations/20241101_001_initial_schema.sql`
2. `supabase-migrations/20241116_002_token_indexer.sql`

If you already have a database, the `IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` guards mean it's safe to run both migrations on an existing schema — they won't recreate what's already there.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API |
| `NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID` | Deploy the router canister, or use the public one |
| `NEXT_PUBLIC_ICPSWAP_SWAPFACTORY_CANISTER_ID` | `4mmnk-kiaaa-aaaag-qbllq-cai` (ICPSwap mainnet) |
| `NEXT_PUBLIC_IC_HOST` | `https://icp0.io` |

Optional:
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry error monitoring
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- `NEXT_PUBLIC_ICPSWAP_API_BASE_URL` — defaults to `https://api.icpswap.com`

### 4. Local ICP identity

```bash
dfx identity new prysm-dev
dfx identity use prysm-dev
dfx identity get-principal   # You'll use this as your wallet principal
```

Make sure your identity has ICP balance for testing swaps:
```bash
dfx ledger balance   # Should show ICP
```

If you need ICP on mainnet, use the [ICP faucet](https://faucet.dfinity.org) or transfer from an exchange.

### 5. Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click "Sign in with Internet Identity" — a browser window will open for II authentication.

## Database Schema

The schema is split into two migrations:

- **`20241101_001_initial_schema`** — core tables: tokens, token_charts, token_logos, comments, site_visits
- **`20241116_002_token_indexer`** — token indexer tables: holder snapshots, trading analytics, wallet clusters, funding edges, ICPSwap pools, Rosetta blocks

All tables use Row Level Security (RLS) — public read, service role write. The `schema.sql` file at the root is a merged reference copy.

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- @dfinity/agent + @dfinity/ledger-icp (ICP canister calls)
- Supabase (auth + Postgres + realtime)
- Recharts + lightweight-charts (charts)
- Internet Identity (wallet-less auth)

## Project Structure

```
prysm-app/
├── supabase-migrations/       # Ordered DB migrations
├── app/                       # Next.js App Router pages
├── components/                # Shared UI components
├── contexts/                  # React contexts (auth, theme)
├── data/                      # Supabase client + queries
├── hooks/                     # Custom React hooks
├── lib/                       # Utilities, formatters, ICPSwap API client
└── types/                     # TypeScript types
```
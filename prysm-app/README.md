# PRYSM App

Next.js frontend for the PRYSM token platform on the Internet Computer — an ICPSwap aggregator with portfolio tracking, trading analytics, and token promotions.

## Features

- **Token Swaps** — ICPSwap integration for swapping ICP and ICRC-1 tokens
- **Portfolio Tracking** — Holdings, transaction history, and P&L analytics
- **Promotions** — Token distribution campaigns and distribution history
- **Trading Analytics** — Token holder data, funding sources, and trading activity
- **Internet Identity** — Seamless wallet-less login via ICP Internet Identity

## Setup

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and ICPSwap credentials

# Start development server
npm run dev
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Required (canister IDs)
NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID=your_router_canister_id
NEXT_PUBLIC_ICPSWAP_SWAPFACTORY_CANISTER_ID=4mmnk-kiaaa-aaaag-qbllq-cai
NEXT_PUBLIC_IC_HOST=https://icp0.io

# Optional
NEXT_PUBLIC_SENTRY_DSN=          # Error monitoring
UPSTASH_REDIS_REST_URL=          # Rate limiting
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_ICPSWAP_API_BASE_URL=https://api.icpswap.com
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- @dfinity/agent + @dfinity/ledger-icp
- Supabase (auth + database)
- Recharts / lightweight-charts
- Internet Identity (II) for authentication

## License

MIT
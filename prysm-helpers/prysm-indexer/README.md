# PRYSM Indexer

Node.js indexer that extracts holder data, funding sources, and trading analytics from the Internet Computer's token canisters. Feeds data into Supabase for the PRYSM platform.

## Features

- Fetches token holder lists from ICRC-1 ledger canisters
- Tracks funding sources by tracing ICP deposits to token accounts
- Computes trading analytics (volume, unique holders, distribution curves)
- Scheduled runs via `node-cron` for continuous data updates

## Setup

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Build
npm run build

# Run
npm start
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_IC_HOST=https://icp0.io
NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai
```

## Tech Stack

- Node.js (ESM)
- TypeScript
- @dfinity/agent + @dfinity/ledger-icp
- @supabase/supabase-js
- node-cron for scheduled indexing
- Jest for testing

## License

MIT
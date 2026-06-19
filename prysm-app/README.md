# PRYSM App

Next.js frontend for the PRYSM token platform on the Internet Computer.

## Overview

A modern, responsive frontend for token swaps and portfolio tracking, powered by ICPSwap aggregator and real-time blockchain data.

## Features

- **Token Swaps** - Aggregate liquidity across ICPSwap and other DEXs
- **Portfolio Tracking** - Monitor your token holdings and transaction history
- **Analytics Dashboard** - Trading insights and performance metrics
- **Promotions** - Featured tokens and promotional banners
- **Wallet Integration** - Connect with Plug, Stoic, or other ICP wallets

## Tech Stack

- **Next.js 14** - App Router with React Server Components
- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Supabase** - Database and authentication
- **SWR** - Data fetching and caching

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project (or use local Supabase)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required: NEXT_PUBLIC_SUPABASE_URL
# Required: NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional APIs
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
prysm-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── api/               # API routes
│
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── swap/             # Swap-related components
│   └── portfolio/         # Portfolio components
│
├── contexts/              # React contexts
│   └── WalletContext.tsx  # Wallet state management
│
├── hooks/                 # Custom React hooks
│   ├── useSwap.ts        # Swap functionality
│   └── usePortfolio.ts   # Portfolio data
│
├── lib/                   # Utilities
│   ├── supabase.ts       # Supabase client
│   └── icp.ts            # ICP utilities
│
├── types/                 # TypeScript definitions
└── public/                # Static assets
```

## Key Components

### Swap Interface

```tsx
import { SwapWidget } from '@/components/swap/SwapWidget';

export default function SwapPage() {
  return <SwapWidget />;
}
```

### Portfolio Dashboard

```tsx
import { PortfolioOverview } from '@/components/portfolio/Overview';

export default function PortfolioPage() {
  return <PortfolioOverview />;
}
```

## Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## License

MIT
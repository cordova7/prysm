# Contributing to PRYSM

Thank you for your interest in contributing!

## Project Structure

PRYSM is a monorepo with three main components:

- **prysm-app** - Next.js frontend for token swaps and portfolio tracking
- **prysm-helpers/prysm-indexer** - Node.js blockchain indexer
- **prysm-helpers/prysm-router** - Rust canister for token routing

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/prysm.git`
3. Install dependencies:
   - Node.js 18+ for prysm-app and prysm-indexer
   - Rust 1.96+ for prysm-router
   - dfx SDK for canister deployment
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

```bash
# Frontend (prysm-app)
cd prysm-app
npm install
npm run dev

# Indexer (prysm-indexer)
cd prysm-helpers/prysm-indexer
npm install
npm run start

# Canister (prysm-router)
cd prysm-helpers/prysm-router
cargo build
dfx deploy
```

## Code Style

- **Frontend**: TypeScript, follow ESLint/Prettier config
- **Indexer**: TypeScript, async/await patterns
- **Canister**: Rust, follow rustfmt guidelines

## Testing

- Write tests for all new functionality
- Test on testnet before production
- Never test with real funds

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Request a review from a maintainer
4. Once approved, your PR will be merged

## Questions?

Feel free to open an issue for any questions!
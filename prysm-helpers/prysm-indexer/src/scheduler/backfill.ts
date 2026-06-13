import { HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createLedgerAdapter } from '../ic/ledger-adapter/index.js';
import { BalanceOnlyAdapter } from '../ic/ledger-adapter/balance-only.js';
import { discoverHolders, discoverHoldersFromIcpswap } from '../indexer/holder-discovery.js';
import { snapshotHolderBalances } from '../balances/snapshot.js';
import { traceWalletFunding } from '../funding/trace.js';
import { clusterWallets } from '../funding/cluster.js';
import { computeTradingAnalytics } from '../trading/analytics.js';
import { IndexerDatabase } from '../supabase/client.js';
import { RosettaHttpClient } from '../rosetta/client.js';
import { ICPSwapClient } from '../icpswap/client.js';
import { syncPools } from './sync-pools.js';
import { IndexerConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { FundingTrace } from '../funding/trace.js';

/**
 * Run backfill indexing (full historical indexing)
 */
export async function runBackfill(
  agent: HttpAgent,
  db: IndexerDatabase,
  rosetta: RosettaHttpClient,
  config: IndexerConfig,
  tokenCanisterId?: string
): Promise<void> {
  logger.separator();
  logger.info('Starting backfill indexing');
  logger.separator();

  // Get tokens to index
  let tokens;
  if (tokenCanisterId) {
    const token = await db.getToken(tokenCanisterId);
    if (!token) {
      throw new Error(`Token not found: ${tokenCanisterId}`);
    }
    tokens = [token];
  } else {
    tokens = await db.getAllTokensToIndex();
  }

  logger.info(`Indexing ${tokens.length} token(s)`);

  // Ensure pools are synced
  let pools = await db.getICPSwapPools();
  if (pools.length === 0) {
    logger.warn('No ICPSwap pools found. Syncing pools now...');
    await syncPools(agent, db);
    pools = await db.getICPSwapPools();
    if (pools.length === 0) {
      throw new Error('No ICPSwap pools found after sync');
    }
  }

  logger.info(`Using ${pools.length} pools for exclusion`);

  let rosettaReady = false;
  if (config.enableFundingTrace) {
    rosettaReady = true;
    try {
      await rosetta.init();
    } catch (error) {
      rosettaReady = false;
      logger.warn(`Rosetta init failed, skipping funding trace: ${error}`);
    }
  }

  // Process each token
  for (const token of tokens) {
    try {
      await indexToken(
        token.token_ledger_id,
        agent,
        db,
        rosetta,
        config,
        rosettaReady
      );
    } catch (error) {
      logger.error(`Failed to index token ${token.token_ledger_id}: ${error}`);

      // Update checkpoint with error
      await db.setTokenIndexerCheckpoint({
        token_canister_id: token.token_ledger_id,
        last_tx_index_processed: 0,
        total_tx_count: 0,
        last_run_at: new Date().toISOString(),
        run_mode: 'backfill',
        status: 'failed',
        notes: `Error: ${error}`,
      });

      // Continue with next token
      continue;
    }
  }

  logger.separator();
  logger.info('Backfill complete');
  logger.separator();
}

/**
 * Index a single token (full pipeline)
 */
async function indexToken(
  tokenCanisterId: string,
  agent: HttpAgent,
  db: IndexerDatabase,
  rosetta: RosettaHttpClient,
  config: IndexerConfig,
  rosettaReady: boolean
): Promise<void> {
  logger.separator();
  logger.info(`Indexing token: ${tokenCanisterId}`);
  logger.separator();

  // 1. Discover holders from ICPSwap (does not require ledger adapter)
  logger.info('Discovering holders from ICPSwap...');
  const swapHolders = await discoverHoldersFromIcpswap(tokenCanisterId, agent, db, config);

  // 2. Create ledger adapter (required for full backfill)
  let adapter = null;
  try {
    logger.info('Creating ledger adapter...');
    adapter = await createLedgerAdapter(agent, tokenCanisterId, db);
  } catch (error) {
    logger.warn(
      `Ledger adapter unavailable for ${tokenCanisterId}, continuing with ICPSwap-only holders: ${error}`
    );
  }

  // 3. Discover holders (ledger + ICPSwap)
  logger.info('Discovering holders...');
  const holders = new Set<string>();
  if (adapter) {
    const ledgerHolders = await discoverHolders(tokenCanisterId, adapter, db, config, 'backfill');
    for (const principal of ledgerHolders) {
      holders.add(principal);
    }
  }
  for (const principal of swapHolders) {
    holders.add(principal);
  }

  if (holders.size === 0) {
    logger.warn('No holders found, skipping remaining steps');
    return;
  }

  // 4. Snapshot balances (fallback to balance-only when ledger adapter is unavailable)
  if (adapter) {
    logger.info('Snapshotting balances...');
    await snapshotHolderBalances(tokenCanisterId, holders, adapter, db, config);
  } else {
    logger.info('Snapshotting balances with balance-only adapter...');
    const balanceAdapter = new BalanceOnlyAdapter(agent, tokenCanisterId);
    await snapshotHolderBalances(tokenCanisterId, holders, balanceAdapter, db, config);
  }

  // 5. Trace funding sources
  if (rosettaReady && config.enableFundingTrace) {
    logger.info('Tracing funding sources...');
    const traces = new Map<string, FundingTrace>();
    const principalAccountIds = new Map<string, string>();
    const fundingEdges = [];

    for (const principalText of holders) {
      try {
        const principal = Principal.fromText(principalText);
        const accountId = rosetta.principalToAccountId(principal);
        principalAccountIds.set(principalText, accountId);
        const trace = await traceWalletFunding(principal, rosetta, config);
        traces.set(principalText, trace);
        fundingEdges.push(...trace.edges);
      } catch (error: any) {
        if (error?.message?.startsWith('ROSETTA_')) {
          logger.warn(`Rosetta unavailable, aborting funding trace: ${error}`);
          rosettaReady = false;
          break;
        }
        logger.error(`Failed to trace funding for ${principalText}: ${error}`);
      }
    }

    if (rosettaReady) {
      logger.info(`Traced funding for ${traces.size} holders`);

      // 5. Persist funding edges
      if (fundingEdges.length > 0) {
        logger.info(`Upserting ${fundingEdges.length} funding edges...`);
        await db.upsertFundingEdges(fundingEdges);
      }

      // 6. Cluster wallets
      logger.info('Clustering wallets...');
      await clusterWallets(traces, db, principalAccountIds);
    } else {
      logger.warn('Skipping funding trace and clustering because Rosetta is unavailable');
    }
  } else if (!config.enableFundingTrace) {
    logger.warn('Skipping funding trace and clustering because it is disabled');
  } else {
    logger.warn('Skipping funding trace and clustering because Rosetta is unavailable');
  }

  // 6. Compute trading analytics
  logger.info('Computing trading analytics...');
  const icpswap = new ICPSwapClient(agent);
  await computeTradingAnalytics(tokenCanisterId, holders, icpswap, db, config);

  logger.separator();
  logger.info(`Token ${tokenCanisterId} indexed successfully`);
  logger.separator();
}

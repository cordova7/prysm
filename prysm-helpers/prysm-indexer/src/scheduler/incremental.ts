import { HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createLedgerAdapter } from '../ic/ledger-adapter/index.js';
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
 * Run incremental indexing (new transactions only)
 */
export async function runIncremental(
  agent: HttpAgent,
  db: IndexerDatabase,
  rosetta: RosettaHttpClient,
  config: IndexerConfig,
  tokenCanisterId?: string
): Promise<void> {
  logger.separator();
  logger.info('Starting incremental indexing');
  logger.separator();

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

  logger.info(`Indexing ${tokens.length} token(s) incrementally`);

  let pools = await db.getICPSwapPools();
  if (pools.length === 0) {
    logger.warn('No ICPSwap pools found. Syncing pools now...');
    await syncPools(agent, db);
    pools = await db.getICPSwapPools();
    if (pools.length === 0) {
      throw new Error('No ICPSwap pools found after sync');
    }
  }

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

  for (const token of tokens) {
    try {
      await indexTokenUpdate(
        token.token_ledger_id,
        agent,
        db,
        rosetta,
        config,
        'incremental',
        rosettaReady
      );
    } catch (error) {
      logger.error(`Failed to index token ${token.token_ledger_id}: ${error}`);

      await db.setTokenIndexerCheckpoint({
        token_canister_id: token.token_ledger_id,
        last_tx_index_processed: 0,
        total_tx_count: 0,
        last_run_at: new Date().toISOString(),
        run_mode: 'incremental',
        status: 'failed',
        notes: `Error: ${error}`,
      });
    }
  }

  logger.separator();
  logger.info('Incremental indexing complete');
  logger.separator();
}

/**
 * Run daily indexing (incremental + refresh snapshots)
 */
export async function runDaily(
  agent: HttpAgent,
  db: IndexerDatabase,
  rosetta: RosettaHttpClient,
  config: IndexerConfig,
  tokenCanisterId?: string
): Promise<void> {
  logger.separator();
  logger.info('Starting daily indexing');
  logger.separator();

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

  logger.info(`Indexing ${tokens.length} token(s) daily`);

  let pools = await db.getICPSwapPools();
  if (pools.length === 0) {
    logger.warn('No ICPSwap pools found. Syncing pools now...');
    await syncPools(agent, db);
    pools = await db.getICPSwapPools();
    if (pools.length === 0) {
      throw new Error('No ICPSwap pools found after sync');
    }
  }

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

  for (const token of tokens) {
    try {
      await indexTokenUpdate(
        token.token_ledger_id,
        agent,
        db,
        rosetta,
        config,
        'daily',
        rosettaReady
      );
    } catch (error) {
      logger.error(`Failed to index token ${token.token_ledger_id}: ${error}`);

      await db.setTokenIndexerCheckpoint({
        token_canister_id: token.token_ledger_id,
        last_tx_index_processed: 0,
        total_tx_count: 0,
        last_run_at: new Date().toISOString(),
        run_mode: 'daily',
        status: 'failed',
        notes: `Error: ${error}`,
      });
    }
  }

  logger.separator();
  logger.info('Daily indexing complete');
  logger.separator();
}

async function indexTokenUpdate(
  tokenCanisterId: string,
  agent: HttpAgent,
  db: IndexerDatabase,
  rosetta: RosettaHttpClient,
  config: IndexerConfig,
  runMode: 'incremental' | 'daily',
  rosettaReady: boolean
): Promise<void> {
  logger.separator();
  logger.info(`Indexing token: ${tokenCanisterId}`);
  logger.separator();

  const adapter = await createLedgerAdapter(agent, tokenCanisterId, db);

  logger.info('Discovering holders...');
  const newHolders = await discoverHolders(tokenCanisterId, adapter, db, config, runMode);
  const swapHolders = await discoverHoldersFromIcpswap(tokenCanisterId, agent, db, config);
  for (const principal of swapHolders) {
    newHolders.add(principal);
  }

  const allAccounts = await db.getAccountsSeen(tokenCanisterId);
  const allHolders = new Set(allAccounts.map((account) => account.owner_principal));
  for (const principal of swapHolders) {
    allHolders.add(principal);
  }

  if (allHolders.size === 0) {
    logger.warn('No holders found, skipping remaining steps');
    return;
  }

  logger.info('Snapshotting balances...');
  await snapshotHolderBalances(tokenCanisterId, allHolders, adapter, db, config);

  if (newHolders.size > 0 && rosettaReady && config.enableFundingTrace) {
    logger.info('Tracing funding sources...');
    const traces = new Map<string, FundingTrace>();
    const principalAccountIds = new Map<string, string>();
    const fundingEdges = [];

    for (const principalText of newHolders) {
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
      if (fundingEdges.length > 0) {
        logger.info(`Upserting ${fundingEdges.length} funding edges...`);
        await db.upsertFundingEdges(fundingEdges);
      }

      logger.info('Clustering wallets...');
      await clusterWallets(traces, db, principalAccountIds);
    } else {
      logger.warn('Skipping funding trace and clustering because Rosetta is unavailable');
    }
  } else if (newHolders.size > 0 && !config.enableFundingTrace) {
    logger.warn('Skipping funding trace and clustering because it is disabled');
  } else if (newHolders.size > 0) {
    logger.warn('Skipping funding trace and clustering because Rosetta is unavailable');
  }

  logger.info('Computing trading analytics...');
  const icpswap = new ICPSwapClient(agent);
  await computeTradingAnalytics(tokenCanisterId, allHolders, icpswap, db, config);

  logger.info(`Token ${tokenCanisterId} indexed successfully (${runMode})`);
}

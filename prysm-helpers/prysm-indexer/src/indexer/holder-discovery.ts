// import { Principal } from '@dfinity/principal';
import { ILedgerAdapter } from '../ic/ledger-adapter/types.js';
import { fetchTxPageWithAdaptivePaging } from '../ic/ledger-adapter/index.js';
import { IndexerDatabase } from '../supabase/client.js';
import { IndexerConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { TokenAccountSeen } from '../supabase/types.js';
import { ICPSwapInfoClient } from '../icpswap/swapinfo.js';
import { HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

/**
 * Discover holders from transaction history
 */
export async function discoverHolders(
  tokenCanisterId: string,
  adapter: ILedgerAdapter,
  db: IndexerDatabase,
  config: IndexerConfig,
  runMode: 'backfill' | 'incremental' | 'daily' = 'backfill'
): Promise<Set<string>> {
  logger.info(`Discovering holders for token ${tokenCanisterId}`);

  // 1. Get checkpoint
  let checkpoint = await db.getTokenIndexerCheckpoint(tokenCanisterId);
  let lastProcessedIndex = BigInt(checkpoint?.last_tx_index_processed || 0);

  // 2. Get pool canisters to exclude
  const pools = await db.getICPSwapPools();
  const poolCanisterIds = new Set(pools.map((pool) => pool.pool_canister_id));
  logger.info(`Excluding ${poolCanisterIds.size} pool canisters`);

  // 3. Get total transaction count
  const totalTxCount = await adapter.getTotalTxCount();
  logger.info(`Total transactions: ${totalTxCount}`);

  if (totalTxCount === 0n) {
    logger.warn('No transactions found');
    return new Set();
  }

  // 4. Reset checkpoint if it claims completion but no accounts were ever recorded
  if (runMode === 'backfill' && checkpoint && lastProcessedIndex >= totalTxCount) {
    const existingAccounts = await db.getAccountsSeen(tokenCanisterId, true);
    const hasLedgerAccounts = existingAccounts.some(
      (account) => account.first_seen_tx_index !== undefined && account.first_seen_tx_index !== null
    );
    if (!hasLedgerAccounts) {
      logger.warn('Checkpoint marked complete but no ledger accounts seen; restarting from 0');
      lastProcessedIndex = 0n;
    }
  }

  // 5. If already fully processed, return holders from stored accounts
  if (lastProcessedIndex >= totalTxCount) {
    const existingAccounts = await db.getAccountsSeen(tokenCanisterId, false);
    const holders = new Set(existingAccounts.map((account) => account.owner_principal));
    logger.info(`Using ${holders.size} existing holders from database`);
    return holders;
  }

  // 6. Initialize holders set and accounts seen
  const holders = new Set<string>();
  const accountsSeen = new Map<string, TokenAccountSeen>();

  // 7. Process transactions in pages
  let currentIndex: bigint = lastProcessedIndex;
  const pageSize = config.txPageSizeDefault;
  const updateCheckpointInterval = 10000; // Update every 10k txs

  while (currentIndex < totalTxCount) {
    try {
      // Fetch transaction page with adaptive paging
      const remaining = Number(totalTxCount - currentIndex);
      const length = Math.min(pageSize, remaining);
      const page = await fetchTxPageWithAdaptivePaging(
        adapter,
        currentIndex,
        length,
        db
      );

      // Process each transaction
      for (const tx of page.transactions) {
        const principals = extractPrincipalsFromTx(tx);

        for (const principal of principals) {
          const isPool = poolCanisterIds.has(principal);
          const isSystem = isSystemAccount(principal);

          // Record account seen
          const existing = accountsSeen.get(principal);
          if (existing) {
            existing.last_seen_tx_index = Number(tx.index);
          } else {
            accountsSeen.set(principal, {
              token_canister_id: tokenCanisterId,
              owner_principal: principal,
              first_seen_tx_index: Number(tx.index),
              last_seen_tx_index: Number(tx.index),
              is_excluded_pool: isPool,
              is_system: isSystem,
            });
          }

          // Add to holders if not pool and not system
          if (!isPool && !isSystem) {
            holders.add(principal);
          }
        }
      }

      // Update current index
      currentIndex += BigInt(page.transactions.length);

      // Log progress
      logger.progress(
        'Processing transactions',
        Number(currentIndex),
        Number(totalTxCount)
      );

      // Update checkpoint periodically
      if (
        Number(currentIndex) % updateCheckpointInterval === 0 ||
        currentIndex >= totalTxCount
      ) {
        await db.setTokenIndexerCheckpoint({
          token_canister_id: tokenCanisterId,
          last_tx_index_processed: Number(currentIndex),
          total_tx_count: Number(totalTxCount),
          last_run_at: new Date().toISOString(),
          run_mode: runMode,
          status: currentIndex >= totalTxCount ? 'completed' : 'running',
          ledger_api_type: adapter.apiType,
        });

        logger.info(`Checkpoint updated: ${currentIndex} / ${totalTxCount}`);
      }

      // If no more transactions, break
      if (!page.hasMore || page.transactions.length === 0) {
        break;
      }
    } catch (error) {
      logger.error(`Error processing transactions at index ${currentIndex}: ${error}`);

      // Update checkpoint with error
      await db.setTokenIndexerCheckpoint({
        token_canister_id: tokenCanisterId,
        last_tx_index_processed: Number(currentIndex),
        total_tx_count: Number(totalTxCount),
        last_run_at: new Date().toISOString(),
        run_mode: runMode,
        status: 'failed',
        notes: `Error: ${error}`,
        ledger_api_type: adapter.apiType,
      });

      throw error;
    }
  }

  // 8. Batch upsert accounts seen
  const accountsSeenList = Array.from(accountsSeen.values());
  logger.info(`Upserting ${accountsSeenList.length} accounts seen`);
  await db.upsertAccountsSeen(accountsSeenList);

  // 9. Final checkpoint update
  await db.setTokenIndexerCheckpoint({
    token_canister_id: tokenCanisterId,
    last_tx_index_processed: Number(totalTxCount),
    total_tx_count: Number(totalTxCount),
    last_run_at: new Date().toISOString(),
    run_mode: runMode,
    status: 'completed',
    ledger_api_type: adapter.apiType,
  });

  logger.info(`Discovered ${holders.size} holders`);
  return holders;
}

/**
 * Discover holders from ICPSwap transaction data.
 */
export async function discoverHoldersFromIcpswap(
  tokenCanisterId: string,
  agent: HttpAgent,
  db: IndexerDatabase,
  config: IndexerConfig
): Promise<Set<string>> {
  logger.info(`Discovering holders from ICPSwap for token ${tokenCanisterId}`);

  const pools = await db.getPoolsForToken(tokenCanisterId);
  if (pools.length === 0) {
    logger.warn('No ICPSwap pools found for token');
    return new Set();
  }

  const swapInfo = new ICPSwapInfoClient(agent, config.icpswapBaseIndexCanisterId);
  const storages = await swapInfo.listBaseStorages();

  if (storages.length === 0) {
    logger.warn('No ICPSwap base storages available');
    return new Set();
  }

  const holders = new Set<string>();
  const accountsSeen = new Map<string, TokenAccountSeen>();

  for (const pool of pools) {
    for (const storageId of storages) {
      let offset = 0;
      const limit = config.icpswapTxPageSize;

      while (true) {
        let page;
        try {
          page = await swapInfo.getPoolTransactions(
            storageId,
            pool.pool_canister_id,
            offset,
            limit
          );
        } catch (error) {
          logger.warn(
            `Failed to fetch ICPSwap txs for pool ${pool.pool_canister_id} from ${storageId}: ${error}`
          );
          break;
        }

        for (const tx of page.content) {
          const principals = collectPrincipalTexts([
            tx.from,
            tx.to,
            tx.recipient,
            tx.sender,
            tx.maker,
          ]);

          for (const principalText of principals) {
            if (!isPrincipalText(principalText)) {
              continue;
            }

            holders.add(principalText);
            if (!accountsSeen.has(principalText)) {
              accountsSeen.set(principalText, {
                token_canister_id: tokenCanisterId,
                owner_principal: principalText,
                is_excluded_pool: false,
                is_system: false,
              });
            }
          }
        }

        offset += Number(page.content.length);
        if (page.content.length === 0 || BigInt(offset) >= page.totalElements) {
          break;
        }
      }
    }
  }

  const accountsSeenList = Array.from(accountsSeen.values());
  logger.info(`Upserting ${accountsSeenList.length} ICPSwap accounts seen`);
  await db.upsertAccountsSeen(accountsSeenList);

  logger.info(`Discovered ${holders.size} ICPSwap holders`);
  return holders;
}

function isPrincipalText(value: string): boolean {
  try {
    Principal.fromText(value);
    return true;
  } catch {
    return false;
  }
}

function collectPrincipalTexts(values: Array<string | string[] | null | undefined>): string[] {
  const results: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) results.push(entry);
      }
      continue;
    }
    results.push(value);
  }
  return results;
}

/**
 * Extract principals from transaction
 */
function extractPrincipalsFromTx(tx: any): string[] {
  const principals: string[] = [];

  // Extract from 'from' account
  if (tx.from?.owner) {
    principals.push(tx.from.owner);
  }

  // Extract from 'to' account (or approve spender when normalized into "to")
  if (tx.to?.owner) {
    principals.push(tx.to.owner);
  }

  return principals;
}

/**
 * Check if principal is a system account
 */
function isSystemAccount(principal: string): boolean {
  const systemAccounts = [
    'aaaaa-aa', // IC management canister
    '2vxsx-fae', // NNS governance
    'rrkah-fqaaa-aaaaa-aaaaq-cai', // NNS ledger
  ];

  return systemAccounts.includes(principal);
}

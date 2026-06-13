import { HttpAgent } from '@dfinity/agent';
import { ICPSwapClient } from '../icpswap/client.js';
import { IndexerDatabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import type { ICPSwapPool } from '../supabase/types.js';

/**
 * Sync ICPSwap pools to database
 */
export async function syncPools(agent: HttpAgent, db: IndexerDatabase): Promise<void> {
  logger.info('Syncing ICPSwap pools to database');

  const icpswap = new ICPSwapClient(agent);

  // Fetch all pools from REST API
  const pools = await icpswap.getAllPools();

  // Convert to database format
  const dbPools: ICPSwapPool[] = pools.map((pool) => ({
    pool_canister_id: pool.canisterId,
    token0_canister_id: pool.token0Id,
    token1_canister_id: pool.token1Id,
    pool_fee: pool.fee,
    tvl_usd: pool.tvlUSD,
    volume_24h_usd: pool.volumeUSD1d,
    last_updated: new Date().toISOString(),
  }));

  // Batch upsert
  await db.upsertICPSwapPools(dbPools);

  logger.info(`Synced ${dbPools.length} pools to database`);
}

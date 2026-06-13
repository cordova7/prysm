import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import { ILedgerAdapter } from '../ic/ledger-adapter/types.js';
import { IndexerDatabase } from '../supabase/client.js';
import { IndexerConfig } from '../config/index.js';
import { Semaphore } from '../utils/semaphore.js';
import { logger } from '../utils/logger.js';
import type { TokenHolderSnapshot } from '../supabase/types.js';

// ICP Ledger Canister ID
const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';

/**
 * Query ICP balance for a principal
 */
async function queryICPBalance(principal: Principal, agent: HttpAgent): Promise<bigint> {
  try {
    const idlFactory = ({ IDL }: any) => IDL.Service({
      icrc1_balance_of: IDL.Func(
        [IDL.Record({ owner: IDL.Principal, subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) })],
        [IDL.Nat],
        ['query']
      ),
    });

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(ICP_LEDGER_ID),
    }) as any;

    const balance: bigint = await actor.icrc1_balance_of({
      owner: principal,
      subaccount: [],
    });

    return BigInt(balance.toString());
  } catch (error) {
    logger.debug(`Failed to query ICP balance for ${principal.toString()}: ${error}`);
    return 0n;
  }
}

/**
 * Snapshot holder balances and compute % supply
 */
export async function snapshotHolderBalances(
  tokenCanisterId: string,
  holders: Set<string>,
  adapter: ILedgerAdapter,
  db: IndexerDatabase,
  config: IndexerConfig
): Promise<void> {
  logger.info(`Snapshotting balances for ${holders.size} holders`);

  // 1. Get total supply and decimals
  const totalSupply = await adapter.totalSupply();
  const decimals = await adapter.decimals();

  logger.info(`Total supply: ${totalSupply}, Decimals: ${decimals}`);

  // Create agent for ICP balance queries
  const agent = new HttpAgent({ host: config.icHost });
  if (config.icHost.includes('localhost') || config.icHost.includes('127.0.0.1')) {
    await agent.fetchRootKey();
  }

  if (totalSupply === 0n) {
    logger.warn('Total supply is 0, skipping snapshots');
    return;
  }

  // 2. Query balances with concurrency control
  const semaphore = new Semaphore(config.maxConcurrencyCanister);
  const snapshots: TokenHolderSnapshot[] = [];
  const snapshotAt = new Date().toISOString();

  let processed = 0;
  const holderArray = Array.from(holders);

  const balancePromises = holderArray.map((principalText) =>
    semaphore.execute(async () => {
      try {
        const principal = Principal.fromText(principalText);
        const balance = await adapter.balanceOf(principal);

        // Also query ICP balance
        const icpBalance = await queryICPBalance(principal, agent);

        processed++;
        if (processed % 100 === 0) {
          logger.progress('Querying balances', processed, holderArray.length);
        }

        // Only include holders with balance > 0
        if (balance > 0n) {
          // Compute percent in basis points (10000 = 100%)
          const percentBps = Number((balance * 10000n) / totalSupply);

          snapshots.push({
            token_canister_id: tokenCanisterId,
            owner_principal: principalText,
            snapshot_at: snapshotAt,
            balance_raw: balance.toString(),
            total_supply_raw: totalSupply.toString(),
            percent_bps: percentBps,
            decimals,
            icp_balance_raw: icpBalance.toString(),
          });
        }
      } catch (error) {
        logger.error(`Failed to query balance for ${principalText}: ${error}`);
      }
    })
  );

  await Promise.all(balancePromises);

  // 3. Sort by balance_raw DESC (primary) and percent_bps DESC (tie-breaker), then take top 100
  snapshots.sort((a, b) => {
    const balanceDiff = BigInt(b.balance_raw) - BigInt(a.balance_raw);
    if (balanceDiff !== 0n) return balanceDiff > 0n ? 1 : -1;
    return b.percent_bps - a.percent_bps;
  });
  const top100 = snapshots.slice(0, 100);

  logger.info(`Top 100 holders captured (from ${snapshots.length} with balance > 0)`);

  // 4. Batch upsert snapshots
  await db.upsertHoldersSnapshot(top100);

  logger.info(`Snapshot complete for ${top100.length} holders`);
}

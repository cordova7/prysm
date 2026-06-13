import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { detectLedgerApiType, introspectCanister, probeLedgerApiType } from '../candid.js';
import { logger } from '../../utils/logger.js';
import { IndexerDatabase } from '../../supabase/client.js';
import { ILedgerAdapter, NormalizedTxPage } from './types.js';
import { ICRC3Adapter } from './icrc3.js';
import { GetTransactionsAdapter } from './get-transactions.js';
import { QueryBlocksAdapter } from './query-blocks.js';
import { ArchivesAdapter } from './archives.js';
import { IndexNgAdapter } from './index-ng.js';

/**
 * Create a ledger adapter based on detected API type
 */
export async function createLedgerAdapter(
  agent: HttpAgent,
  canisterId: string,
  _db: IndexerDatabase
): Promise<ILedgerAdapter> {
  logger.info(`Creating ledger adapter for ${canisterId}`);

  // 1. Introspect candid interface
  const { methods } = await introspectCanister(agent, canisterId);

  // 2. Detect API type
  let apiType = detectLedgerApiType(methods);

  if (!apiType) {
    logger.warn(`Falling back to method probing for ${canisterId}`);
    apiType = await probeLedgerApiType(agent, canisterId);
  }

  if (!apiType) {
    const overrideIndexPrincipal = getIndexCanisterOverride(canisterId);
    const indexPrincipal =
      overrideIndexPrincipal || (await tryGetIndexCanisterPrincipal(agent, canisterId));
    if (indexPrincipal) {
      logger.info(`Using index-ng canister ${indexPrincipal} for tx history`);
      return new IndexNgAdapter(agent, indexPrincipal, canisterId);
    }
    throw new Error(
      `Unsupported ledger API for ${canisterId}. ` +
      `Could not detect any of: icrc3_get_transactions, get_transactions, query_blocks, archives ` +
      `and no index canister was found (icrc106_get_index_principal).`
    );
  }

  logger.info(`Detected ledger API type: ${apiType}`);

  // 3. Create adapter based on type
  switch (apiType) {
    case 'icrc3':
      return new ICRC3Adapter(agent, canisterId);
    case 'get_transactions':
      return new GetTransactionsAdapter(agent, canisterId);
    case 'query_blocks':
      return new QueryBlocksAdapter(agent, canisterId);
    case 'archives':
      return new ArchivesAdapter(agent, canisterId);
    default:
      throw new Error(`Unsupported API type: ${apiType}`);
  }
}

function getIndexCanisterOverride(ledgerCanisterId: string): string | null {
  const single = process.env.INDEX_CANISTER_ID;
  if (single && single.trim().length > 0) {
    return single.trim();
  }

  const mapRaw = process.env.INDEX_CANISTER_MAP;
  if (!mapRaw) return null;
  try {
    const parsed = JSON.parse(mapRaw) as Record<string, string>;
    const value = parsed?.[ledgerCanisterId];
    if (value && value.trim().length > 0) return value.trim();
  } catch {}
  return null;
}

async function tryGetIndexCanisterPrincipal(
  agent: HttpAgent,
  ledgerCanisterId: string
): Promise<string | null> {
  const target = Principal.fromText(ledgerCanisterId);

  // ICRC-106 (preferred): icrc106_get_index_principal : () -> (opt principal) query
  try {
    const actor = Actor.createActor(
      ({ IDL }: any) =>
        IDL.Service({
          icrc106_get_index_principal: IDL.Func([], [IDL.Opt(IDL.Principal)], ['query']),
        }),
      { agent, canisterId: target }
    );
    const result = await (actor as any).icrc106_get_index_principal();
    const principal = Array.isArray(result) ? result[0] : result;
    if (principal) {
      return principal.toText ? principal.toText() : String(principal);
    }
  } catch {}

  // Fallback: some implementations may return principal directly
  try {
    const actor = Actor.createActor(
      ({ IDL }: any) =>
        IDL.Service({
          icrc106_get_index_principal: IDL.Func([], [IDL.Principal], ['query']),
        }),
      { agent, canisterId: target }
    );
    const principal = await (actor as any).icrc106_get_index_principal();
    if (principal) {
      return principal.toText ? principal.toText() : String(principal);
    }
  } catch {}

  return null;
}

/**
 * Fetch transaction page with adaptive paging
 */
export async function fetchTxPageWithAdaptivePaging(
  adapter: ILedgerAdapter,
  start: bigint,
  requestedLength: number,
  db: IndexerDatabase
): Promise<NormalizedTxPage> {
  // Get cached max page size from checkpoint
  const checkpoint = await db.getTokenIndexerCheckpoint(adapter.canisterId);
  let maxPageSize = checkpoint?.max_page_size || requestedLength;

  let currentLength = Math.min(requestedLength, maxPageSize);

  // Try fetching with binary backoff on errors
  while (currentLength > 0) {
    try {
      logger.debug(`Fetching ${currentLength} transactions starting from ${start}`);
      const page = await adapter.getTxPage(start, currentLength);

      // Update cached max page size if we succeeded with a larger size
      if (currentLength > (checkpoint?.max_page_size || 0)) {
        await db.setTokenIndexerCheckpoint({
          token_canister_id: adapter.canisterId,
          last_tx_index_processed: checkpoint?.last_tx_index_processed || 0,
          total_tx_count: checkpoint?.total_tx_count || 0,
          max_page_size: currentLength,
          ledger_api_type: adapter.apiType,
        });
      }

      return page;
    } catch (error) {
      logger.warn(
        `Failed to fetch ${currentLength} transactions, reducing page size`,
        error
      );

      currentLength = Math.floor(currentLength / 2);

      if (currentLength < 10) {
        throw new Error(
          `Failed to fetch transactions even with minimal page size (< 10): ${error}`
        );
      }
    }
  }

  throw new Error('Adaptive paging failed');
}

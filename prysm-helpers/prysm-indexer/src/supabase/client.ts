import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type {
  Token,
  TokenIndexerCheckpoint,
  TokenAccountSeen,
  TokenHolderSnapshot,
  WalletFundingEdge,
  WalletCluster,
  WalletClusterMember,
  HolderTradingAnalytics,
  ICPSwapPool,
  TopHolderView,
  RelatedWalletView,
  BlockRow,
  TransactionRow,
  IngestionState,
} from './types.js';

/**
 * Typed Supabase client for token indexer operations
 */
export class IndexerDatabase {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // =============================================
  // TOKEN OPERATIONS
  // =============================================

  /**
   * Get all tokens to index, ordered by ic_id DESC (newest first)
   */
  async getAllTokensToIndex(): Promise<Token[]> {
    const { data, error } = await this.client
      .from('tokens')
      .select('*')
      .order('ic_id', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch tokens: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single token by canister ID
   */
  async getToken(tokenCanisterId: string): Promise<Token | null> {
    const { data, error } = await this.client
      .from('tokens')
      .select('*')
      .eq('token_ledger_id', tokenCanisterId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch token: ${error.message}`);
    }

    return data;
  }

  // =============================================
  // CHECKPOINT OPERATIONS
  // =============================================

  /**
   * Get checkpoint for a token
   */
  async getTokenIndexerCheckpoint(tokenCanisterId: string): Promise<TokenIndexerCheckpoint | null> {
    const { data, error } = await this.client
      .from('token_indexer_checkpoints')
      .select('*')
      .eq('token_canister_id', tokenCanisterId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch checkpoint: ${error.message}`);
    }

    return data;
  }

  /**
   * Upsert checkpoint for a token
   */
  async setTokenIndexerCheckpoint(checkpoint: TokenIndexerCheckpoint): Promise<void> {
    const { error } = await this.client
      .from('token_indexer_checkpoints')
      .upsert(checkpoint, { onConflict: 'token_canister_id' });

    if (error) {
      throw new Error(`Failed to upsert checkpoint: ${error.message}`);
    }

    logger.debug(`Checkpoint updated for ${checkpoint.token_canister_id}`);
  }

  // =============================================
  // ICPSWAP POOL OPERATIONS
  // =============================================

  /**
   * Get all ICPSwap pools (for exclusion logic)
   */
  async getICPSwapPools(): Promise<ICPSwapPool[]> {
    const { data, error } = await this.client
      .from('icpswap_pools')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch ICPSwap pools: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get pools for a specific token
   */
  async getPoolsForToken(tokenCanisterId: string): Promise<ICPSwapPool[]> {
    const { data, error } = await this.client
      .from('icpswap_pools')
      .select('*')
      .or(`token0_canister_id.eq.${tokenCanisterId},token1_canister_id.eq.${tokenCanisterId}`);

    if (error) {
      throw new Error(`Failed to fetch pools for token: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Batch upsert ICPSwap pools
   */
  async upsertICPSwapPools(pools: ICPSwapPool[]): Promise<void> {
    if (pools.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < pools.length; i += BATCH_SIZE) {
      const batch = pools.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('icpswap_pools')
        .upsert(batch, { onConflict: 'pool_canister_id' });

      if (error) {
        throw new Error(`Failed to upsert ICPSwap pools: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} pools (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  // =============================================
  // ACCOUNT OPERATIONS
  // =============================================

  /**
   * Batch upsert accounts seen
   */
  async upsertAccountsSeen(accounts: TokenAccountSeen[]): Promise<void> {
    if (accounts.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('token_accounts_seen')
        .upsert(batch, { onConflict: 'token_canister_id,owner_principal' });

      if (error) {
        throw new Error(`Failed to upsert accounts seen: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} accounts seen (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  /**
   * Get all seen accounts for a token (excluding pools and system accounts by default)
   */
  async getAccountsSeen(
    tokenCanisterId: string,
    includeExcluded: boolean = false
  ): Promise<TokenAccountSeen[]> {
    let query = this.client
      .from('token_accounts_seen')
      .select('*')
      .eq('token_canister_id', tokenCanisterId);

    if (!includeExcluded) {
      query = query.eq('is_excluded_pool', false).eq('is_system', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch accounts seen: ${error.message}`);
    }

    return data || [];
  }

  // =============================================
  // HOLDER SNAPSHOT OPERATIONS
  // =============================================

  /**
   * Batch upsert holder snapshots
   */
  async upsertHoldersSnapshot(snapshots: TokenHolderSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
      const batch = snapshots.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('token_holder_snapshots')
        .upsert(batch, { onConflict: 'token_canister_id,owner_principal,snapshot_at' });

      if (error) {
        throw new Error(`Failed to upsert holder snapshots: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} holder snapshots (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  // =============================================
  // FUNDING OPERATIONS
  // =============================================

  /**
   * Batch upsert funding edges
   */
  async upsertFundingEdges(edges: WalletFundingEdge[]): Promise<void> {
    if (edges.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < edges.length; i += BATCH_SIZE) {
      const batch = edges.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('wallet_funding_edges')
        .upsert(batch, { onConflict: 'wallet_account_id,funder_account_id,block_index' });

      if (error) {
        throw new Error(`Failed to upsert funding edges: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} funding edges (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  // =============================================
  // CLUSTER OPERATIONS
  // =============================================

  /**
   * Batch upsert clusters
   */
  async upsertClusters(clusters: WalletCluster[]): Promise<void> {
    if (clusters.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < clusters.length; i += BATCH_SIZE) {
      const batch = clusters.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('wallet_clusters')
        .upsert(batch, { onConflict: 'cluster_id' });

      if (error) {
        throw new Error(`Failed to upsert clusters: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} clusters (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  /**
   * Batch upsert cluster members
   */
  async upsertClusterMembers(members: WalletClusterMember[]): Promise<void> {
    if (members.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const batch = members.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('wallet_cluster_members')
        .upsert(batch, { onConflict: 'cluster_id,wallet_account_id' });

      if (error) {
        throw new Error(`Failed to upsert cluster members: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} cluster members (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  // =============================================
  // TRADING ANALYTICS OPERATIONS
  // =============================================

  /**
   * Batch upsert trading analytics
   */
  async upsertTradingAnalytics(analytics: HolderTradingAnalytics[]): Promise<void> {
    if (analytics.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < analytics.length; i += BATCH_SIZE) {
      const batch = analytics.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('holder_trading_analytics')
        .upsert(batch, { onConflict: 'token_canister_id,owner_principal,time_window' });

      if (error) {
        throw new Error(`Failed to upsert trading analytics: ${error.message}`);
      }

      logger.debug(`Upserted ${batch.length} trading analytics (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }
  }

  // =============================================
  // VIEW OPERATIONS
  // =============================================

  /**
   * Get top holders for a token
   */
  async getTopHolders(tokenCanisterId: string, limit: number = 100): Promise<TopHolderView[]> {
    const { data, error } = await this.client
      .from('v_token_top_holders')
      .select('*')
      .eq('token_canister_id', tokenCanisterId)
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch top holders: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get related wallets for a cluster
   */
  async getRelatedWallets(clusterId: string): Promise<RelatedWalletView[]> {
    const { data, error } = await this.client
      .from('v_token_holder_related_wallets')
      .select('*')
      .eq('cluster_id', clusterId);

    if (error) {
      throw new Error(`Failed to fetch related wallets: ${error.message}`);
    }

    return data || [];
  }

  // =============================================
  // ROSETTA BLOCK INGESTION
  // =============================================

  /**
   * Upsert blocks
   */
  async upsertBlocks(blocks: BlockRow[]): Promise<void> {
    if (blocks.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
      const batch = blocks.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('blocks')
        .upsert(batch, { onConflict: 'index' });

      if (error) {
        throw new Error(`Failed to upsert blocks: ${error.message}`);
      }
    }
  }

  /**
   * Upsert transactions
   */
  async upsertTransactions(transactions: TransactionRow[]): Promise<void> {
    if (transactions.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const { error } = await this.client
        .from('transactions')
        .upsert(batch, { onConflict: 'block_index,tx_hash' });

      if (error) {
        throw new Error(`Failed to upsert transactions: ${error.message}`);
      }
    }
  }

  /**
   * Get ingestion state by id
   */
  async getIngestionState(id: string): Promise<IngestionState | null> {
    const { data, error } = await this.client
      .from('ingestion_state')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch ingestion state: ${error.message}`);
    }

    return data;
  }

  /**
   * Upsert ingestion state
   */
  async setIngestionState(state: IngestionState): Promise<void> {
    const { error } = await this.client
      .from('ingestion_state')
      .upsert(state, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to upsert ingestion state: ${error.message}`);
    }
  }

  /**
   * Get earliest inbound transfer for an account
   */
  async getEarliestInboundTransfer(
    accountId: string
  ): Promise<TransactionRow | null> {
    const { data, error } = await this.client
      .from('transactions')
      .select('block_index,tx_hash,from_account,to_account,amount_e8s,fee_e8s,memo,created_at_time')
      .eq('to_account', accountId)
      .gt('amount_e8s', 0)
      .order('block_index', { ascending: true })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch inbound transfer: ${error.message}`);
    }

    return data?.[0] || null;
  }
}

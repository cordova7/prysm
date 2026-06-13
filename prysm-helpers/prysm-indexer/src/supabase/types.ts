/**
 * Database types matching schema.sql
 */

export interface Token {
  token_ledger_id: string;
  ic_id?: number;
  controllers?: string[];
  name?: string;
  symbol?: string;
  price?: number;
  volume_24h?: number;
  price_change_24h?: number;
  liquidity?: number;
  total_supply?: number;
  market_cap?: number;
  pair?: string;
  dex?: string;
  pool_id?: string;
  first_seen?: string;
  last_updated?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TokenIndexerCheckpoint {
  token_canister_id: string;
  last_tx_index_processed: number;
  total_tx_count: number;
  last_run_at?: string;
  run_mode?: 'backfill' | 'incremental' | 'daily';
  status?: 'pending' | 'running' | 'completed' | 'failed';
  notes?: string;
  max_page_size?: number;
  ledger_api_type?: 'icrc3' | 'get_transactions' | 'query_blocks' | 'archives' | 'index-ng' | 'balance-only';
  created_at?: string;
  updated_at?: string;
}

export interface TokenAccountSeen {
  token_canister_id: string;
  owner_principal: string;
  first_seen_tx_index?: number;
  last_seen_tx_index?: number;
  is_excluded_pool?: boolean;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TokenHolderSnapshot {
  token_canister_id: string;
  owner_principal: string;
  snapshot_at: string;
  balance_raw: string;
  total_supply_raw: string;
  percent_bps: number;
  decimals: number;
  icp_balance_raw?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WalletFundingEdge {
  wallet_account_id: string;
  funder_account_id: string;
  block_index: number;
  amount_raw: string;
  tx_hash?: string;
  timestamp?: string;
  created_at?: string;
}

export interface WalletCluster {
  cluster_id: string;
  terminal_funder_account_id: string;
  label?: 'CEX' | 'unknown' | 'root';
  color_index?: number;
  heuristic_reason?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface WalletClusterMember {
  cluster_id: string;
  wallet_account_id: string;
  owner_principal?: string;
  created_at?: string;
}

export interface HolderTradingAnalytics {
  token_canister_id: string;
  owner_principal: string;
  time_window: '24h' | '7d' | 'lifetime';
  icp_in_raw?: string;
  icp_out_raw?: string;
  token_in_raw?: string;
  token_out_raw?: string;
  net_icp_raw?: string;
  net_token_raw?: string;
  pnl_proxy_icp_raw?: string;
  // New PnL tracking fields
  cost_basis_icp_raw?: string;
  avg_entry_price?: string;
  realized_pnl_icp_raw?: string;
  unrealized_pnl_icp_raw?: string;
  confidence?: 'low' | 'medium' | 'high';
  created_at?: string;
  updated_at?: string;
}

export interface ICPSwapPool {
  pool_canister_id: string;
  token0_canister_id: string;
  token1_canister_id: string;
  pool_fee?: number;
  tvl_usd?: number;
  volume_24h_usd?: number;
  last_updated?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TopHolderView {
  token_canister_id: string;
  owner_principal: string;
  snapshot_at: string;
  balance_raw: string;
  total_supply_raw: string;
  percent_bps: number;
  decimals: number;
  cluster_id?: string;
  cluster_label?: string;
  cluster_color_index?: number;
  terminal_funder_account_id?: string;
  icp_in_24h?: string;
  icp_out_24h?: string;
  net_icp_24h?: string;
  pnl_24h?: string;
  net_icp_7d?: string;
  net_icp_lifetime?: string;
}

export interface RelatedWalletView {
  cluster_id: string;
  wallet_account_id: string;
  owner_principal?: string;
  cluster_label?: string;
  terminal_funder_account_id?: string;
}

export interface BlockRow {
  index: number;
  hash: string;
  timestamp: string;
  parent_index?: number;
  parent_hash?: string;
  raw?: Record<string, any>;
  created_at?: string;
}

export interface TransactionRow {
  block_index: number;
  tx_hash: string;
  type?: string;
  from_account: string;
  to_account: string;
  amount_e8s?: string;
  fee_e8s?: string;
  memo?: string;
  created_at_time?: string;
  raw?: Record<string, any>;
  created_at?: string;
}

export interface IngestionState {
  id: string;
  last_ingested_block: number;
  updated_at?: string;
}

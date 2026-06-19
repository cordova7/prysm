-- =============================================
-- Migration: 20241116_002_token_indexer
-- Description: Token indexer tables for transaction ingestion
--   - token_indexer_checkpoints, token_accounts_seen
--   - token_holder_snapshots, holder_trading_analytics
--   - icpswap_pools, blocks, transactions, ingestion_state
--   - wallet_funding_edges, wallet_clusters, wallet_cluster_members
--   - indexes, triggers, RLS, grants, views
-- =============================================

-- =============================================
-- 1. TOKEN INDEXER CHECKPOINTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_indexer_checkpoints (
  token_canister_id TEXT PRIMARY KEY,
  last_tx_index_processed BIGINT DEFAULT 0,
  total_tx_count BIGINT DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  run_mode TEXT DEFAULT 'daily' CHECK (run_mode IN ('backfill', 'incremental', 'daily')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  notes TEXT,
  max_page_size INTEGER DEFAULT 1000,
  ledger_api_type TEXT CHECK (ledger_api_type IN ('icrc3', 'get_transactions', 'query_blocks', 'archives')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. TOKEN ACCOUNTS SEEN
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_accounts_seen (
  token_canister_id TEXT NOT NULL,
  owner_principal TEXT NOT NULL,
  first_seen_tx_index BIGINT,
  last_seen_tx_index BIGINT,
  is_excluded_pool BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (token_canister_id, owner_principal)
);

-- =============================================
-- 3. TOKEN HOLDER SNAPSHOTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_holder_snapshots (
  token_canister_id TEXT NOT NULL,
  owner_principal TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  balance_raw TEXT NOT NULL,
  total_supply_raw TEXT NOT NULL,
  percent_bps INTEGER NOT NULL,
  decimals INTEGER NOT NULL,
  icp_balance_raw TEXT DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (token_canister_id, owner_principal, snapshot_at)
);

ALTER TABLE public.token_holder_snapshots
  ADD COLUMN IF NOT EXISTS icp_balance_raw TEXT DEFAULT '0';

-- =============================================
-- 4. WALLET FUNDING EDGES
-- =============================================
CREATE TABLE IF NOT EXISTS public.wallet_funding_edges (
  wallet_account_id TEXT NOT NULL,
  funder_account_id TEXT NOT NULL,
  block_index BIGINT NOT NULL,
  amount_raw TEXT NOT NULL,
  tx_hash TEXT,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet_account_id, funder_account_id, block_index)
);

-- =============================================
-- 5. WALLET CLUSTERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.wallet_clusters (
  cluster_id TEXT PRIMARY KEY,
  terminal_funder_account_id TEXT NOT NULL,
  label TEXT DEFAULT 'unknown' CHECK (label IN ('CEX', 'unknown', 'root')),
  color_index INTEGER CHECK (color_index >= 0 AND color_index <= 15),
  heuristic_reason JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. WALLET CLUSTER MEMBERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.wallet_cluster_members (
  cluster_id TEXT NOT NULL,
  wallet_account_id TEXT NOT NULL,
  owner_principal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cluster_id, wallet_account_id)
);

-- =============================================
-- 7. HOLDER TRADING ANALYTICS
-- =============================================
CREATE TABLE IF NOT EXISTS public.holder_trading_analytics (
  token_canister_id TEXT NOT NULL,
  owner_principal TEXT NOT NULL,
  time_window TEXT NOT NULL CHECK (time_window IN ('24h', '7d', 'lifetime')),
  icp_in_raw TEXT DEFAULT '0',
  icp_out_raw TEXT DEFAULT '0',
  token_in_raw TEXT DEFAULT '0',
  token_out_raw TEXT DEFAULT '0',
  net_icp_raw TEXT DEFAULT '0',
  net_token_raw TEXT DEFAULT '0',
  pnl_proxy_icp_raw TEXT DEFAULT '0',
  cost_basis_icp_raw TEXT DEFAULT '0',
  avg_entry_price TEXT DEFAULT '0',
  realized_pnl_icp_raw TEXT DEFAULT '0',
  unrealized_pnl_icp_raw TEXT DEFAULT '0',
  confidence TEXT DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (token_canister_id, owner_principal, time_window)
);

ALTER TABLE public.holder_trading_analytics
  ADD COLUMN IF NOT EXISTS cost_basis_icp_raw TEXT DEFAULT '0';
ALTER TABLE public.holder_trading_analytics
  ADD COLUMN IF NOT EXISTS avg_entry_price TEXT DEFAULT '0';
ALTER TABLE public.holder_trading_analytics
  ADD COLUMN IF NOT EXISTS realized_pnl_icp_raw TEXT DEFAULT '0';
ALTER TABLE public.holder_trading_analytics
  ADD COLUMN IF NOT EXISTS unrealized_pnl_icp_raw TEXT DEFAULT '0';

-- =============================================
-- 8. ICPSWAP POOLS CACHE
-- =============================================
CREATE TABLE IF NOT EXISTS public.icpswap_pools (
  pool_canister_id TEXT PRIMARY KEY,
  token0_canister_id TEXT NOT NULL,
  token1_canister_id TEXT NOT NULL,
  pool_fee INTEGER,
  tvl_usd NUMERIC,
  volume_24h_usd NUMERIC,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. ROSETTA BLOCKS (ICP chain ingestion)
-- =============================================
CREATE TABLE IF NOT EXISTS public.blocks (
  index BIGINT PRIMARY KEY,
  hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  parent_index BIGINT,
  parent_hash TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. ROSETTA TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  block_index BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  type TEXT,
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount_e8s BIGINT,
  fee_e8s BIGINT,
  memo TEXT,
  created_at_time BIGINT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (block_index, tx_hash)
);

-- =============================================
-- 11. INGESTION STATE
-- =============================================
CREATE TABLE IF NOT EXISTS public.ingestion_state (
  id TEXT PRIMARY KEY,
  last_ingested_block BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_token_indexer_checkpoints_status
  ON public.token_indexer_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_token_indexer_checkpoints_last_run
  ON public.token_indexer_checkpoints(last_run_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_token_accounts_seen_token
  ON public.token_accounts_seen(token_canister_id);
CREATE INDEX IF NOT EXISTS idx_token_accounts_seen_owner
  ON public.token_accounts_seen(owner_principal);
CREATE INDEX IF NOT EXISTS idx_token_accounts_seen_pools
  ON public.token_accounts_seen(token_canister_id, is_excluded_pool) WHERE is_excluded_pool = false;

CREATE INDEX IF NOT EXISTS idx_token_holder_snapshots_token
  ON public.token_holder_snapshots(token_canister_id);
CREATE INDEX IF NOT EXISTS idx_token_holder_snapshots_owner
  ON public.token_holder_snapshots(owner_principal);
CREATE INDEX IF NOT EXISTS idx_token_holder_snapshots_snapshot_at
  ON public.token_holder_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_holder_snapshots_percent
  ON public.token_holder_snapshots(token_canister_id, percent_bps DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_funding_edges_wallet
  ON public.wallet_funding_edges(wallet_account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_edges_funder
  ON public.wallet_funding_edges(funder_account_id);

CREATE INDEX IF NOT EXISTS idx_wallet_clusters_terminal_funder
  ON public.wallet_clusters(terminal_funder_account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_clusters_label
  ON public.wallet_clusters(label);

CREATE INDEX IF NOT EXISTS idx_wallet_cluster_members_cluster
  ON public.wallet_cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_wallet_cluster_members_wallet
  ON public.wallet_cluster_members(wallet_account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_cluster_members_principal
  ON public.wallet_cluster_members(owner_principal) WHERE owner_principal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_holder_trading_analytics_token
  ON public.holder_trading_analytics(token_canister_id);
CREATE INDEX IF NOT EXISTS idx_holder_trading_analytics_owner
  ON public.holder_trading_analytics(owner_principal);
CREATE INDEX IF NOT EXISTS idx_holder_trading_analytics_time_window
  ON public.holder_trading_analytics(time_window);

CREATE INDEX IF NOT EXISTS idx_icpswap_pools_token0
  ON public.icpswap_pools(token0_canister_id);
CREATE INDEX IF NOT EXISTS idx_icpswap_pools_token1
  ON public.icpswap_pools(token1_canister_id);

CREATE INDEX IF NOT EXISTS idx_blocks_timestamp
  ON public.blocks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_block
  ON public.transactions(block_index);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash
  ON public.transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_from
  ON public.transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to
  ON public.transactions(to_account);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_token_indexer_checkpoints_updated_at ON public.token_indexer_checkpoints;
CREATE TRIGGER update_token_indexer_checkpoints_updated_at
  BEFORE UPDATE ON public.token_indexer_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_token_accounts_seen_updated_at ON public.token_accounts_seen;
CREATE TRIGGER update_token_accounts_seen_updated_at
  BEFORE UPDATE ON public.token_accounts_seen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_token_holder_snapshots_updated_at ON public.token_holder_snapshots;
CREATE TRIGGER update_token_holder_snapshots_updated_at
  BEFORE UPDATE ON public.token_holder_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallet_clusters_updated_at ON public.wallet_clusters;
CREATE TRIGGER update_wallet_clusters_updated_at
  BEFORE UPDATE ON public.wallet_clusters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_holder_trading_analytics_updated_at ON public.holder_trading_analytics;
CREATE TRIGGER update_holder_trading_analytics_updated_at
  BEFORE UPDATE ON public.holder_trading_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_icpswap_pools_updated_at ON public.icpswap_pools;
CREATE TRIGGER update_icpswap_pools_updated_at
  BEFORE UPDATE ON public.icpswap_pools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ingestion_state_updated_at ON public.ingestion_state;
CREATE TRIGGER update_ingestion_state_updated_at
  BEFORE UPDATE ON public.ingestion_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.token_indexer_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_accounts_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_holder_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_funding_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holder_trading_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icpswap_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_state ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS "Public read access for checkpoints" ON public.token_indexer_checkpoints;
CREATE POLICY "Public read access for checkpoints" ON public.token_indexer_checkpoints
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for accounts seen" ON public.token_accounts_seen;
CREATE POLICY "Public read access for accounts seen" ON public.token_accounts_seen
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for holder snapshots" ON public.token_holder_snapshots;
CREATE POLICY "Public read access for holder snapshots" ON public.token_holder_snapshots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for funding edges" ON public.wallet_funding_edges;
CREATE POLICY "Public read access for funding edges" ON public.wallet_funding_edges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for clusters" ON public.wallet_clusters;
CREATE POLICY "Public read access for clusters" ON public.wallet_clusters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for cluster members" ON public.wallet_cluster_members;
CREATE POLICY "Public read access for cluster members" ON public.wallet_cluster_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for trading analytics" ON public.holder_trading_analytics;
CREATE POLICY "Public read access for trading analytics" ON public.holder_trading_analytics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for icpswap pools" ON public.icpswap_pools;
CREATE POLICY "Public read access for icpswap pools" ON public.icpswap_pools
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage blocks" ON public.blocks;
CREATE POLICY "Service role can manage blocks" ON public.blocks
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage transactions" ON public.transactions;
CREATE POLICY "Service role can manage transactions" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage ingestion state" ON public.ingestion_state;
CREATE POLICY "Service role can manage ingestion state" ON public.ingestion_state
  FOR ALL USING (auth.role() = 'service_role');

-- Service role manage policies
DROP POLICY IF EXISTS "Service role can manage checkpoints" ON public.token_indexer_checkpoints;
CREATE POLICY "Service role can manage checkpoints" ON public.token_indexer_checkpoints
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage accounts seen" ON public.token_accounts_seen;
CREATE POLICY "Service role can manage accounts seen" ON public.token_accounts_seen
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage holder snapshots" ON public.token_holder_snapshots;
CREATE POLICY "Service role can manage holder snapshots" ON public.token_holder_snapshots
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage funding edges" ON public.wallet_funding_edges;
CREATE POLICY "Service role can manage funding edges" ON public.wallet_funding_edges
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage clusters" ON public.wallet_clusters;
CREATE POLICY "Service role can manage clusters" ON public.wallet_clusters
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage cluster members" ON public.wallet_cluster_members;
CREATE POLICY "Service role can manage cluster members" ON public.wallet_cluster_members
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage trading analytics" ON public.holder_trading_analytics;
CREATE POLICY "Service role can manage trading analytics" ON public.holder_trading_analytics
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage icpswap pools" ON public.icpswap_pools;
CREATE POLICY "Service role can manage icpswap pools" ON public.icpswap_pools
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- GRANTS
-- =============================================
GRANT SELECT ON public.token_indexer_checkpoints TO anon;
GRANT SELECT ON public.token_accounts_seen TO anon;
GRANT SELECT ON public.token_holder_snapshots TO anon;
GRANT SELECT ON public.wallet_funding_edges TO anon;
GRANT SELECT ON public.wallet_clusters TO anon;
GRANT SELECT ON public.wallet_cluster_members TO anon;
GRANT SELECT ON public.holder_trading_analytics TO anon;
GRANT SELECT ON public.icpswap_pools TO anon;

GRANT ALL ON public.blocks TO service_role;
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.ingestion_state TO service_role;

GRANT SELECT ON public.token_indexer_checkpoints TO authenticated;
GRANT SELECT ON public.token_accounts_seen TO authenticated;
GRANT SELECT ON public.token_holder_snapshots TO authenticated;
GRANT SELECT ON public.wallet_funding_edges TO authenticated;
GRANT SELECT ON public.wallet_clusters TO authenticated;
GRANT SELECT ON public.wallet_cluster_members TO authenticated;
GRANT SELECT ON public.holder_trading_analytics TO authenticated;
GRANT SELECT ON public.icpswap_pools TO authenticated;

GRANT ALL ON public.token_indexer_checkpoints TO service_role;
GRANT ALL ON public.token_accounts_seen TO service_role;
GRANT ALL ON public.token_holder_snapshots TO service_role;
GRANT ALL ON public.wallet_funding_edges TO service_role;
GRANT ALL ON public.wallet_clusters TO service_role;
GRANT ALL ON public.wallet_cluster_members TO service_role;
GRANT ALL ON public.holder_trading_analytics TO service_role;
GRANT ALL ON public.icpswap_pools TO service_role;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE public.blocks IS 'Rosetta block ingestion for ICP';
COMMENT ON TABLE public.transactions IS 'Parsed transactions from Rosetta blocks';
COMMENT ON TABLE public.ingestion_state IS 'Tracks last ingested block per source';
COMMENT ON TABLE public.token_indexer_checkpoints IS 'Tracks indexing progress and state for each token canister';
COMMENT ON TABLE public.token_accounts_seen IS 'All principals observed in token transaction history (excludes pools and system accounts)';
COMMENT ON TABLE public.token_holder_snapshots IS 'Time-series balance data for token holders with % of total supply';
COMMENT ON TABLE public.wallet_funding_edges IS 'ICP funding graph edges showing wallet-to-funder relationships';
COMMENT ON TABLE public.wallet_clusters IS 'Wallet clusters grouped by terminal funders with CEX detection';
COMMENT ON TABLE public.wallet_cluster_members IS 'Membership mapping of wallets to clusters';
COMMENT ON TABLE public.holder_trading_analytics IS 'Per-holder swap volumes and PnL proxies from ICPSwap (high confidence)';
COMMENT ON TABLE public.icpswap_pools IS 'Cached ICPSwap pool data for pool canister exclusion';

-- =============================================
-- VIEWS FOR FRONTEND
-- =============================================
CREATE OR REPLACE VIEW public.v_token_top_holders AS
SELECT
  ths.token_canister_id,
  ths.owner_principal,
  ths.snapshot_at,
  ths.balance_raw,
  ths.total_supply_raw,
  ths.percent_bps,
  ths.decimals,
  ths.icp_balance_raw,
  wcm.cluster_id,
  wc.label AS cluster_label,
  wc.color_index AS cluster_color_index,
  wc.terminal_funder_account_id,
  hta24h.icp_in_raw AS icp_in_24h,
  hta24h.icp_out_raw AS icp_out_24h,
  hta24h.net_icp_raw AS net_icp_24h,
  hta24h.pnl_proxy_icp_raw AS pnl_24h,
  hta7d.net_icp_raw AS net_icp_7d,
  htalt.net_icp_raw AS net_icp_lifetime,
  htalt.cost_basis_icp_raw,
  htalt.avg_entry_price,
  htalt.realized_pnl_icp_raw,
  htalt.unrealized_pnl_icp_raw
FROM public.token_holder_snapshots ths
LEFT JOIN public.wallet_cluster_members wcm ON ths.owner_principal = wcm.owner_principal
LEFT JOIN public.wallet_clusters wc ON wcm.cluster_id = wc.cluster_id
LEFT JOIN public.holder_trading_analytics hta24h
  ON ths.token_canister_id = hta24h.token_canister_id
  AND ths.owner_principal = hta24h.owner_principal
  AND hta24h.time_window = '24h'
LEFT JOIN public.holder_trading_analytics hta7d
  ON ths.token_canister_id = hta7d.token_canister_id
  AND ths.owner_principal = hta7d.owner_principal
  AND hta7d.time_window = '7d'
LEFT JOIN public.holder_trading_analytics htalt
  ON ths.token_canister_id = htalt.token_canister_id
  AND ths.owner_principal = htalt.owner_principal
  AND htalt.time_window = 'lifetime'
WHERE ths.snapshot_at = (
  SELECT MAX(snapshot_at)
  FROM public.token_holder_snapshots
  WHERE token_canister_id = ths.token_canister_id
)
ORDER BY ths.token_canister_id, ths.percent_bps DESC;

CREATE OR REPLACE VIEW public.v_token_holder_related_wallets AS
SELECT
  wcm.cluster_id,
  wcm.wallet_account_id,
  wcm.owner_principal,
  wc.label AS cluster_label,
  wc.terminal_funder_account_id
FROM public.wallet_cluster_members wcm
JOIN public.wallet_clusters wc ON wcm.cluster_id = wc.cluster_id;

COMMENT ON VIEW public.v_token_top_holders IS 'Top 100 holders per token with balance, cluster, and trading analytics';
COMMENT ON VIEW public.v_token_holder_related_wallets IS 'Cluster members for related wallets hover UI';

-- =============================================
-- GRANTS FOR VIEWS
-- =============================================
GRANT SELECT ON public.v_token_top_holders TO anon;
GRANT SELECT ON public.v_token_top_holders TO authenticated;
GRANT SELECT ON public.v_token_top_holders TO service_role;

GRANT SELECT ON public.v_token_holder_related_wallets TO anon;
GRANT SELECT ON public.v_token_holder_related_wallets TO authenticated;
GRANT SELECT ON public.v_token_holder_related_wallets TO service_role;
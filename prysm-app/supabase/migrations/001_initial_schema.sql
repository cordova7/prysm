-- SNPR Token Management Database Schema
-- Run this in Supabase SQL Editor

-- =============================================
-- TOKENS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.tokens (
  token_ledger_id TEXT PRIMARY KEY,
  ic_id BIGINT,
  name TEXT,
  symbol TEXT,
  price DECIMAL,
  volume_24h DECIMAL,
  price_change_24h DECIMAL,
  liquidity DECIMAL,
  total_supply DECIMAL,
  market_cap DECIMAL,
  pair TEXT,
  dex TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TOKEN CHARTS TABLE (for caching chart data)
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_charts (
  id BIGSERIAL PRIMARY KEY,
  token_ledger_id TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '24h', '7d', '30d'
  chart_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (token_ledger_id) REFERENCES public.tokens(token_ledger_id) ON DELETE CASCADE
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Primary lookup index for tokens
CREATE INDEX IF NOT EXISTS idx_tokens_token_ledger_id ON public.tokens(token_ledger_id);

-- Index for new token detection (sorted by first_seen)
CREATE INDEX IF NOT EXISTS idx_tokens_first_seen ON public.tokens(first_seen DESC);

-- Index for sorting by icId (highest first)
CREATE INDEX IF NOT EXISTS idx_tokens_ic_id ON public.tokens(ic_id DESC) WHERE ic_id IS NOT NULL;

-- Index for price-based queries
CREATE INDEX IF NOT EXISTS idx_tokens_price ON public.tokens(price DESC) WHERE price IS NOT NULL;

-- Index for volume-based queries
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON public.tokens(volume_24h DESC) WHERE volume_24h IS NOT NULL;

-- Composite index for listing tokens (icId DESC, then price)
CREATE INDEX IF NOT EXISTS idx_tokens_listing ON public.tokens(ic_id DESC NULLS LAST, price DESC NULLS LAST);

-- Indexes for token_charts table
CREATE INDEX IF NOT EXISTS idx_token_charts_token_ledger_id ON public.token_charts(token_ledger_id);
CREATE INDEX IF NOT EXISTS idx_token_charts_timeframe ON public.token_charts(timeframe);
CREATE INDEX IF NOT EXISTS idx_token_charts_expires_at ON public.token_charts(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_charts_composite ON public.token_charts(token_ledger_id, timeframe, expires_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on both tables
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_charts ENABLE ROW LEVEL SECURITY;

-- Tokens: Allow public read access
CREATE POLICY "Public read access for tokens" ON public.tokens
  FOR SELECT USING (true);

-- Tokens: Allow service role to insert, update, delete
CREATE POLICY "Service role can manage tokens" ON public.tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Token charts: Allow public read access
CREATE POLICY "Public read access for token charts" ON public.token_charts
  FOR SELECT USING (true);

-- Token charts: Allow service role to insert, update, delete
CREATE POLICY "Service role can manage token charts" ON public.token_charts
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for tokens table
DROP TRIGGER IF EXISTS update_tokens_updated_at ON public.tokens;
CREATE TRIGGER update_tokens_updated_at
  BEFORE UPDATE ON public.tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- REAL-TIME REPLICATION
-- =============================================

-- Enable real-time for tokens table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.tokens IS 'Main tokens table storing all token metadata';
COMMENT ON TABLE public.token_charts IS 'Caches chart data to reduce API calls to ICPSWAP';
COMMENT ON COLUMN public.tokens.token_ledger_id IS 'Unique token ledger identifier';
COMMENT ON COLUMN public.tokens.ic_id IS 'ICP canister ID for cross-reference (nullable)';
COMMENT ON COLUMN public.tokens.first_seen IS 'Timestamp when token was first detected';
COMMENT ON COLUMN public.tokens.last_updated IS 'Last time this token was updated from external API';
COMMENT ON COLUMN public.token_charts.expires_at IS 'When this cached chart data expires';

-- =============================================
-- INITIAL VERIFICATION QUERY
-- =============================================

-- Check table structure
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tokens', 'token_charts')
ORDER BY table_name, ordinal_position;

-- Check indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tokens', 'token_charts')
ORDER BY tablename, indexname;

-- =============================================
-- Migration: 001_initial_schema
-- Description: Core tables for PRYSM token platform
--   - tokens, token_charts, token_logos
--   - token_relationships_cache, relationship_cache_stats
--   - comments, site_visits
--   - indexes, views, triggers, RLS, grants
-- =============================================

-- =============================================
-- TOKENS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.tokens (
  token_ledger_id TEXT PRIMARY KEY,
  ic_id BIGINT,
  controllers TEXT[] DEFAULT '{}'::text[],
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
  pool_id TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS controllers TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS pool_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tokens_token_ledger_id_unique'
      AND conrelid = 'public.tokens'::regclass
  ) THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_token_ledger_id_unique UNIQUE (token_ledger_id);
  END IF;
END $$;

-- =============================================
-- TOKEN CHARTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_charts (
  id BIGSERIAL PRIMARY KEY,
  token_ledger_id TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '24h',
  chart_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  FOREIGN KEY (token_ledger_id) REFERENCES public.tokens(token_ledger_id) ON DELETE CASCADE
);

ALTER TABLE public.token_charts
  ADD COLUMN IF NOT EXISTS timeframe TEXT NOT NULL DEFAULT '24h';
ALTER TABLE public.token_charts
  ADD COLUMN IF NOT EXISTS chart_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.token_charts
  ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.token_charts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'token_charts_token_timeframe_unique'
      AND conrelid = 'public.token_charts'::regclass
  ) THEN
    ALTER TABLE public.token_charts
      ADD CONSTRAINT token_charts_token_timeframe_unique
      UNIQUE (token_ledger_id, timeframe);
  END IF;
END $$;

-- =============================================
-- TOKEN LOGOS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_logos (
  token_ledger_id TEXT PRIMARY KEY,
  logo_url TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- =============================================
-- TOKEN RELATIONSHIPS CACHE TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS public.token_relationships_cache (
  id BIGSERIAL PRIMARY KEY,
  token_ledger_id TEXT NOT NULL,
  related_token_ledger_id TEXT NOT NULL,
  shared_controllers TEXT[] NOT NULL DEFAULT '{}'::text[],
  controller_count INTEGER NOT NULL DEFAULT 1,
  ic_id BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (token_ledger_id, related_token_ledger_id)
);

CREATE TABLE IF NOT EXISTS public.relationship_cache_stats (
  id BIGSERIAL PRIMARY KEY,
  token_ledger_id TEXT NOT NULL UNIQUE,
  total_relationships INTEGER NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  is_priority BOOLEAN NOT NULL DEFAULT false
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tokens_token_ledger_id ON public.tokens(token_ledger_id);
CREATE INDEX IF NOT EXISTS idx_tokens_ic_id ON public.tokens(ic_id DESC) WHERE ic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON public.tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_price ON public.tokens(price DESC) WHERE price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_volume_24h ON public.tokens(volume_24h DESC) WHERE volume_24h IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_first_seen ON public.tokens(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_listing ON public.tokens(ic_id DESC NULLS LAST, price DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tokens_controllers_gin ON public.tokens USING GIN (controllers);
CREATE INDEX IF NOT EXISTS idx_tokens_volume_desc ON public.tokens (volume_24h DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tokens_has_controllers
  ON public.tokens USING GIN (controllers)
  WHERE controllers IS NOT NULL AND array_length(controllers, 1) > 0;

CREATE INDEX IF NOT EXISTS idx_token_charts_token_ledger_id ON public.token_charts(token_ledger_id);
CREATE INDEX IF NOT EXISTS idx_token_charts_timeframe ON public.token_charts(timeframe);
CREATE INDEX IF NOT EXISTS idx_token_charts_expires_at ON public.token_charts(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_charts_cache_lookup ON public.token_charts(token_ledger_id, timeframe, expires_at);

CREATE INDEX IF NOT EXISTS idx_token_logos_expires_at ON public.token_logos(expires_at);

CREATE INDEX IF NOT EXISTS idx_token_relationships_cache_token_id ON public.token_relationships_cache(token_ledger_id);
CREATE INDEX IF NOT EXISTS idx_token_relationships_cache_related_id ON public.token_relationships_cache(related_token_ledger_id);
CREATE INDEX IF NOT EXISTS idx_token_relationships_cache_controller_count ON public.token_relationships_cache(controller_count);
CREATE INDEX IF NOT EXISTS idx_relationship_cache_stats_token_id ON public.relationship_cache_stats(token_ledger_id);
CREATE INDEX IF NOT EXISTS idx_relationship_cache_stats_priority ON public.relationship_cache_stats(is_priority);

-- =============================================
-- HELPER VIEW
-- =============================================
CREATE OR REPLACE VIEW public.tokens_with_relationships AS
SELECT
  t.token_ledger_id,
  t.name,
  t.symbol,
  t.price,
  t.volume_24h,
  t.liquidity,
  t.controllers,
  array_length(t.controllers, 1) AS controller_count
FROM public.tokens t
WHERE t.controllers IS NOT NULL
  AND array_length(t.controllers, 1) > 0;

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_tokens_updated_at ON public.tokens;
CREATE TRIGGER update_tokens_updated_at
  BEFORE UPDATE ON public.tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_token_relationships_cache_updated_at ON public.token_relationships_cache;
CREATE TRIGGER update_token_relationships_cache_updated_at
  BEFORE UPDATE ON public.token_relationships_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- REALTIME REPLICATION
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'tokens'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens';
    END IF;
  END IF;
END $$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_relationships_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_cache_stats ENABLE ROW LEVEL SECURITY;

-- Tokens policies
DROP POLICY IF EXISTS "Public read access for tokens" ON public.tokens;
CREATE POLICY "Public read access for tokens" ON public.tokens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage tokens" ON public.tokens;
CREATE POLICY "Service role can manage tokens" ON public.tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Token charts policies
DROP POLICY IF EXISTS "Public read access for token charts" ON public.token_charts;
CREATE POLICY "Public read access for token charts" ON public.token_charts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage token charts" ON public.token_charts;
CREATE POLICY "Service role can manage token charts" ON public.token_charts
  FOR ALL USING (auth.role() = 'service_role');

-- Token logos policies
DROP POLICY IF EXISTS "Public read access for token logos" ON public.token_logos;
CREATE POLICY "Public read access for token logos" ON public.token_logos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage token logos" ON public.token_logos;
CREATE POLICY "Service role can manage token logos" ON public.token_logos
  FOR ALL USING (auth.role() = 'service_role');

-- Relationship cache policies
DROP POLICY IF EXISTS "Allow read access for anon role" ON public.token_relationships_cache;
CREATE POLICY "Allow read access for anon role" ON public.token_relationships_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all operations for service role" ON public.token_relationships_cache;
CREATE POLICY "Allow all operations for service role" ON public.token_relationships_cache
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow read access for anon role" ON public.relationship_cache_stats;
CREATE POLICY "Allow read access for anon role" ON public.relationship_cache_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all operations for service role" ON public.relationship_cache_stats;
CREATE POLICY "Allow all operations for service role" ON public.relationship_cache_stats
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- GRANTS
-- =============================================
GRANT SELECT ON public.tokens TO anon;
GRANT SELECT ON public.token_charts TO anon;
GRANT SELECT ON public.token_logos TO anon;
GRANT SELECT ON public.token_relationships_cache TO anon;
GRANT SELECT ON public.relationship_cache_stats TO anon;

GRANT SELECT ON public.tokens TO authenticated;
GRANT SELECT ON public.token_charts TO authenticated;
GRANT SELECT ON public.token_logos TO authenticated;
GRANT SELECT ON public.token_relationships_cache TO authenticated;
GRANT SELECT ON public.relationship_cache_stats TO authenticated;

GRANT ALL ON public.tokens TO service_role;
GRANT ALL ON public.token_charts TO service_role;
GRANT ALL ON public.token_logos TO service_role;
GRANT ALL ON public.token_relationships_cache TO service_role;
GRANT ALL ON public.relationship_cache_stats TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE public.tokens IS 'Main tokens table storing all token metadata';
COMMENT ON TABLE public.token_charts IS 'Caches chart data to reduce API calls to ICPSWAP';
COMMENT ON TABLE public.token_logos IS 'Caches token logo URLs for fast client delivery';
COMMENT ON TABLE public.token_relationships_cache IS 'Cached token relationships for fast UI access';
COMMENT ON TABLE public.relationship_cache_stats IS 'Stats and priority flags for relationship cache';
COMMENT ON VIEW public.tokens_with_relationships IS 'View of tokens that have controller data';
COMMENT ON COLUMN public.tokens.token_ledger_id IS 'Unique token ledger identifier';
COMMENT ON COLUMN public.tokens.ic_id IS 'ICP canister ID for cross-reference (nullable)';
COMMENT ON COLUMN public.tokens.first_seen IS 'Timestamp when token was first detected';
COMMENT ON COLUMN public.tokens.last_updated IS 'Last time this token was updated from external API';
COMMENT ON COLUMN public.token_charts.expires_at IS 'Cache expiration time - data is stale after this';

-- =============================================
-- COMMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_ledger_id TEXT NOT NULL,
  author_principal TEXT NOT NULL,
  content TEXT CHECK (char_length(content) <= 1000),
  pry_balance_at_post NUMERIC DEFAULT 0,
  stake_amount_at_post NUMERIC DEFAULT 0,
  fees_earned_at_post NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_token
  ON public.comments(token_ledger_id, created_at DESC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for comments" ON public.comments;
CREATE POLICY "Public read access for comments" ON public.comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT WITH CHECK (true);

GRANT SELECT ON public.comments TO anon;
GRANT SELECT ON public.comments TO authenticated;
GRANT INSERT ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;

COMMENT ON TABLE public.comments IS 'User comments on tokens with verified PRY balance, stake, and earnings snapshots';

-- =============================================
-- SITE VISITS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.site_visits (
  id INTEGER PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage site visits" ON public.site_visits;
CREATE POLICY "Service role can manage site visits" ON public.site_visits
  FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON public.site_visits TO service_role;

COMMENT ON TABLE public.site_visits IS 'Tracks last visit timestamp for on-visit refresh gating';

-- =============================================
-- RELATIONSHIP HELPER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.mark_homepage_tokens_as_priority()
RETURNS void AS $$
BEGIN
  UPDATE public.relationship_cache_stats
  SET is_priority = true
  WHERE token_ledger_id IN (
    SELECT token_ledger_id
    FROM public.tokens
    ORDER BY ic_id DESC NULLS LAST
    LIMIT 10
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_homepage_tokens_as_priority() TO service_role;
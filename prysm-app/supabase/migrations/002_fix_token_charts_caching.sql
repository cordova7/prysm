-- Migration: Fix Token Charts Caching
-- Adds missing columns for proper chart data caching

-- =============================================
-- ADD MISSING COLUMNS TO TOKEN_CHARTS TABLE
-- =============================================

-- Add timeframe column (24h, 7d, 30d)
ALTER TABLE public.token_charts
ADD COLUMN IF NOT EXISTS timeframe TEXT NOT NULL DEFAULT '24h';

-- Add chart_data column (JSONB to store the full cached chart response)
ALTER TABLE public.token_charts
ADD COLUMN IF NOT EXISTS chart_data JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add cached_at column (when this was cached)
ALTER TABLE public.token_charts
ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ DEFAULT NOW();

-- Add expires_at column (when cache expires)
ALTER TABLE public.token_charts
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes');

-- =============================================
-- UPDATE EXISTING ROWS
-- =============================================

-- Update existing rows to have a timeframe (if any exist)
UPDATE public.token_charts
SET timeframe = '24h'
WHERE timeframe IS NULL OR timeframe = '';

-- Set expires_at for existing rows (5 minutes from now)
UPDATE public.token_charts
SET expires_at = NOW() + INTERVAL '5 minutes'
WHERE expires_at IS NULL OR expires_at < NOW();

-- =============================================
-- ADD INDEXES FOR PERFORMANCE
-- =============================================

-- Index on timeframe for filtering
CREATE INDEX IF NOT EXISTS idx_token_charts_timeframe
  ON public.token_charts(timeframe);

-- Index on expires_at for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_token_charts_expires_at
  ON public.token_charts(expires_at);

-- Composite index for the cache lookup query pattern
-- Used by: WHERE token_ledger_id = ? AND timeframe = ? AND expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_token_charts_cache_lookup
  ON public.token_charts(token_ledger_id, timeframe, expires_at);

-- =============================================
-- ADD CONSTRAINTS
-- =============================================

-- Drop the constraint if it exists first (PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS)
ALTER TABLE public.token_charts
DROP CONSTRAINT IF EXISTS token_charts_token_timeframe_unique;

-- Add unique constraint for upsert (prevent duplicate cache entries)
-- This enables the ON CONFLICT clause in the code
ALTER TABLE public.token_charts
ADD CONSTRAINT token_charts_token_timeframe_unique
  UNIQUE (token_ledger_id, timeframe);

-- =============================================
-- UPDATE RLS POLICIES (if RLS is enabled)
-- =============================================

-- Ensure public read access still works
DROP POLICY IF EXISTS "Public read access for token charts" ON public.token_charts;
CREATE POLICY "Public read access for token charts" ON public.token_charts
  FOR SELECT USING (true);

-- Ensure service role can manage token charts
DROP POLICY IF EXISTS "Service role can manage token charts" ON public.token_charts;
CREATE POLICY "Service role can manage token charts" ON public.token_charts
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN public.token_charts.timeframe IS 'Time range for chart: 24h, 7d, or 30d';
COMMENT ON COLUMN public.token_charts.chart_data IS 'Cached chart data in JSON format (array of OHLCV points)';
COMMENT ON COLUMN public.token_charts.cached_at IS 'Timestamp when this chart data was cached';
COMMENT ON COLUMN public.token_charts.expires_at IS 'Cache expiration time - data is stale after this';

-- =============================================
-- VERIFICATION QUERY
-- =============================================

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'token_charts'
ORDER BY ordinal_position;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'token_charts'
ORDER BY indexname;

-- Check constraints
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND c.conrelid = 'public.token_charts'::regclass;

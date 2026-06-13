-- Migration: Add RLS Policies for Token Relationships Cache
-- This migration adds the missing INSERT/UPDATE policies that were causing
-- "permission denied for sequence token_relationships_cache_id_seq" errors

-- ============================================
-- TOKEN RELATIONSHIPS CACHE TABLES
-- ============================================

-- Check if the token_relationships_cache table exists before adding policies
DO $$
BEGIN
    -- Add RLS policies for token_relationships_cache table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_relationships_cache') THEN
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Allow all operations for service role" ON public.token_relationships_cache;
        DROP POLICY IF EXISTS "Allow read access for anon role" ON public.token_relationships_cache;

        -- Create RLS policies for anon (read-only)
        CREATE POLICY "Allow read access for anon role" ON public.token_relationships_cache
            FOR SELECT USING (true);

        -- Create RLS policies for service role (full access)
        CREATE POLICY "Allow all operations for service role" ON public.token_relationships_cache
            FOR ALL USING (auth.role() = 'service_role');

        RAISE NOTICE 'Added RLS policies for token_relationships_cache table';
    ELSE
        RAISE NOTICE 'token_relationships_cache table does not exist, skipping...';
    END IF;

    -- Check if the relationship_cache_stats table exists before adding policies
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'relationship_cache_stats') THEN
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Allow all operations for service role" ON public.relationship_cache_stats;
        DROP POLICY IF EXISTS "Allow read access for anon role" ON public.relationship_cache_stats;

        -- Create RLS policies for anon (read-only)
        CREATE POLICY "Allow read access for anon role" ON public.relationship_cache_stats
            FOR SELECT USING (true);

        -- Create RLS policies for service role (full access)
        CREATE POLICY "Allow all operations for service role" ON public.relationship_cache_stats
            FOR ALL USING (auth.role() = 'service_role');

        RAISE NOTICE 'Added RLS policies for relationship_cache_stats table';
    ELSE
        RAISE NOTICE 'relationship_cache_stats table does not exist, skipping...';
    END IF;

    -- Ensure sequence permissions are granted
    -- This is critical for the BIGSERIAL primary key to work
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_relationships_cache') THEN
        -- Grant usage on the sequence for service_role
        GRANT USAGE, SELECT ON SEQUENCE public.token_relationships_cache_id_seq TO service_role;
        RAISE NOTICE 'Granted sequence permissions for token_relationships_cache_id_seq';
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Verify the RLS policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('token_relationships_cache', 'relationship_cache_stats')
ORDER BY tablename, policyname;

-- Check sequence permissions
SELECT
    n.nspname,
    c.relname,
    c.relkind,
    p.proname,
    pg_catalog.pg_get_userbyid(p.proowner) as owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_class c ON c.oid = p.proargtypes
WHERE p.proname LIKE '%token_relationships_cache%seq%'
   OR c.relname LIKE '%token_relationships_cache%seq%';

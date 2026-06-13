-- Migration: Add indexes for controller relationships
-- Created: 2024-11-16
-- Purpose: Optimize queries for token relationship visualization

-- Add GIN index for controllers array (PostgreSQL specific)
-- This allows fast querying of tokens that share specific controllers
CREATE INDEX IF NOT EXISTS idx_tokens_controllers_gin
ON tokens
USING GIN (controllers);

-- Add btree index for token_ledger_id for fast lookups
-- This is likely already present but ensuring it exists
CREATE INDEX IF NOT EXISTS idx_tokens_token_ledger_id
ON tokens (token_ledger_id);

-- Add composite index for volume-based sorting
-- Used for precomputing relationships for top tokens
CREATE INDEX IF NOT EXISTS idx_tokens_volume_desc
ON tokens (volume_24h DESC NULLS LAST);

-- Add index for tokens with controllers
-- Helps filter tokens that have controller data
CREATE INDEX IF NOT EXISTS idx_tokens_has_controllers
ON tokens
USING GIN (controllers)
WHERE controllers IS NOT NULL AND array_length(controllers, 1) > 0;

-- Create a view for tokens with relationship data
-- Pre-computed view for faster relationship queries
CREATE OR REPLACE VIEW tokens_with_relationships AS
SELECT
    t.token_ledger_id,
    t.name,
    t.symbol,
    t.price,
    t.volume_24h,
    t.liquidity,
    t.controllers,
    array_length(t.controllers, 1) as controller_count
FROM tokens t
WHERE t.controllers IS NOT NULL
  AND array_length(t.controllers, 1) > 0;

-- Add comments for documentation
COMMENT ON INDEX idx_tokens_controllers_gin IS 'GIN index on controllers array for fast relationship queries';
COMMENT ON INDEX idx_tokens_volume_desc IS 'Index for sorting tokens by volume for precomputing top relationships';
COMMENT ON INDEX idx_tokens_has_controllers IS 'Partial index for tokens that actually have controllers';
COMMENT ON VIEW tokens_with_relationships IS 'View of tokens that have controller data, optimized for relationship queries';

-- Analyze the table to update statistics
-- This helps the query planner make better decisions
ANALYZE tokens;

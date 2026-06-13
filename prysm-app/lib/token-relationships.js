/**
 * Token Relationship Visualization Engine
 * Efficiently detects and maps relationships between tokens based on shared controllers
 * Optimized for handling 5000+ tokens with minimal performance overhead
 *
 * NOW USES DATABASE CACHING FOR INSTANT LOOKUPS!
 */

import { supabase, supabaseAdmin } from './supabase';

// LRU Cache for relationship data (Least Recently Used) - now as fallback
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const value = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used item
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global cache instance (fallback) - Steve Jobs: Increase to 500 for more cache hits
const relationshipCache = new LRUCache(500);

// Steve Jobs: Request Coalescing Map - prevents duplicate concurrent requests
const processingQueue = new Map();

/**
 * Steve Jobs: Coalesce requests - if a request is already processing, join it instead of starting a new one
 * This prevents duplicate work when multiple users request the same token at the same time
 * @param {string} tokenId - The token's ID
 * @param {Function} computeFn - Function to compute the relationships
 * @returns {Promise} - Promise that resolves with the relationship data
 */
async function coalesceRequest(tokenId, computeFn) {
  // If already processing, wait for it
  if (processingQueue.has(tokenId)) {
    return processingQueue.get(tokenId);
  }

  // Start processing
  const promise = computeFn()
    .then(result => {
      // Remove from queue on success
      processingQueue.delete(tokenId);
      return result;
    })
    .catch(error => {
      // Remove from queue on error
      processingQueue.delete(tokenId);
      throw error;
    });

  processingQueue.set(tokenId, promise);
  return promise;
}

/**
 * Build relationship index from token controller data
 * @param {Array} tokens - Array of token objects with controllers
 * @returns {Object} - Map of controllerId -> array of tokenIds
 */
export function buildControllerIndex(tokens) {
  const controllerIndex = new Map();

  for (const token of tokens) {
    if (!token.controllers || token.controllers.length === 0) continue;

    for (const controllerId of token.controllers) {
      if (!controllerIndex.has(controllerId)) {
        controllerIndex.set(controllerId, []);
      }
      controllerIndex.get(controllerId).push({
        tokenId: token.token_ledger_id || token.id,
        icId: token.ic_id,
        name: token.name,
        symbol: token.symbol,
        price: token.price,
        volume24h: token.volume_24h,
        liquidity: token.liquidity,
      });
    }
  }

  return controllerIndex;
}

/**
 * Find tokens that share controllers with a given token
 * Uses database cache first, falls back to in-memory calculation
 * Steve Jobs: Wrapped with request coalescing to prevent duplicate work
 * @param {Object} token - Token object with controllers array
 * @param {Object} controllerIndex - Pre-built controller index (fallback)
 * @param {number} maxResults - Maximum number of connections to return (for display)
 * @returns {Array} - Array of connected tokens with metadata
 */
export async function findControllerRelationships(token, controllerIndex, maxResults = 50) {
  if (!token || !token.controllers || token.controllers.length === 0) {
    return [];
  }

  const tokenId = token.token_ledger_id || token.id;
  const cacheKey = typeof maxResults === 'number'
    ? `${tokenId}_${maxResults}`
    : `${tokenId}_all_unlimited`;

  // Steve Jobs: Use request coalescing to prevent duplicate concurrent requests
  return coalesceRequest(tokenId, async () => {
    return await findControllerRelationshipsInternal(token, controllerIndex, maxResults, cacheKey);
  });
}

/**
 * Internal function that does the actual relationship calculation
 * Separated from the main function to support request coalescing
 */
async function findControllerRelationshipsInternal(token, controllerIndex, maxResults, cacheKey) {
  const tokenId = token.token_ledger_id || token.id;

  // Try database cache first for fast lookups (only when a limit is specified)
  if (typeof maxResults === 'number') {
    try {
      // Check if supabaseAdmin is available
      if (!supabaseAdmin) {
        console.warn('Supabase admin not available, using in-memory calculation');
        throw new Error('Supabase admin not configured');
      }

      let query = supabaseAdmin
        .from('token_relationships_cache')
        .select(`
          related_token_ledger_id,
          shared_controllers,
          controller_count,
          tokens!related_token_ledger_id (
            token_ledger_id,
            name,
            symbol,
            price,
            volume_24h,
            liquidity,
            ic_id
          )
        `)
        .eq('token_ledger_id', tokenId)
        .order('controller_count', { ascending: false })
        .limit(maxResults);

      const { data: cachedRelationships, error } = await query;

      if (!error && cachedRelationships && cachedRelationships.length > 0) {
        // Transform database results to expected format
        const result = cachedRelationships.map(rel => ({
          tokenId: rel.related_token_ledger_id,
          tokenLedgerId: rel.related_token_ledger_id,
          name: rel.tokens?.name || 'Unknown',
          symbol: rel.tokens?.symbol || 'N/A',
          price: rel.tokens?.price || 0,
          volume24h: rel.tokens?.volume_24h || 0,
          liquidity: rel.tokens?.liquidity || 0,
          icId: rel.tokens?.ic_id || 0,
          sharedControllers: rel.shared_controllers || [],
          controllerCount: rel.controller_count || 1,
        }));

        // Sort by icId descending (highest first)
        result.sort((a, b) => {
          const aIcId = a.icId ?? -1;
          const bIcId = b.icId ?? -1;
          if (aIcId !== bIcId) {
            return bIcId - aIcId;
          }
          return a.tokenId.localeCompare(b.tokenId);
        });

        // Cache in memory too for next time
        relationshipCache.set(cacheKey, result);

        return result;
      }
    } catch (err) {
      console.warn('Database cache lookup failed, using fallback:', err.message);
    }
  }

  // Fallback to in-memory calculation (old method)
  console.warn('Using fallback in-memory relationship calculation');

  const cached = relationshipCache.get(cacheKey);
  if (cached) {
    return maxResults ? cached.slice(0, maxResults) : cached;
  }

  const connectedTokens = new Map(); // Use Map to prevent duplicates

  // Find all tokens sharing each controller
  for (const controllerId of token.controllers) {
    const controllerTokens = controllerIndex.get(controllerId) || [];

    for (const connectedToken of controllerTokens) {
      // Skip self
      const isSelf = connectedToken.tokenId === tokenId;
      if (isSelf) continue;

      // Get or create token entry
      if (!connectedTokens.has(connectedToken.tokenId)) {
        connectedTokens.set(connectedToken.tokenId, {
          ...connectedToken,
          sharedControllers: new Set(),
          controllerCount: 0,
        });
      }

      // Add this controller to the shared controllers set
      const tokenEntry = connectedTokens.get(connectedToken.tokenId);
      tokenEntry.sharedControllers.add(controllerId);
      tokenEntry.controllerCount = tokenEntry.sharedControllers.size;
    }
  }

  // Convert to array and sort by highest ic_id (descending) - numeric comparison
  const result = Array.from(connectedTokens.values())
    .map(token => ({
      ...token,
      tokenLedgerId: token.tokenId, // Add tokenLedgerId for frontend compatibility
      sharedControllers: Array.from(token.sharedControllers),
    }))
    .sort((a, b) => {
      const aIcId = a.icId ?? -1;
      const bIcId = b.icId ?? -1;

      if (aIcId !== bIcId) {
        return bIcId - aIcId;
      }

      // Fallback: sort by tokenId (ascending) for stable sorting
      return a.tokenId.localeCompare(b.tokenId);
    });

  // Cache the full result (no limit)
  relationshipCache.set(cacheKey, result);

  // Return all or slice for display
  return maxResults ? result.slice(0, maxResults) : result;
}

/**
 * Get detailed relationship information including controller details
 * @param {Object} token - Target token
 * @param {Array} tokens - All tokens for building index
 * @param {number} maxResults - Maximum connections
 * @returns {Object} - Relationship data with controller information
 */
export async function getTokenRelationships(token, tokens, maxResults = undefined) {
  if (!token) {
    return {
      token: null,
      relationships: [],
      summary: {
        totalConnections: 0,
        uniqueControllers: 0,
        topController: null,
      },
    };
  }

  try {
    // Build controller index for fallback calculation
    const controllerIndex = buildControllerIndex(tokens);

    // Find relationships - uses database cache first
    const allRelationships = await findControllerRelationships(token, controllerIndex, null);

    // Calculate summary from ALL relationships (not just displayed ones)
    const uniqueControllers = token.controllers ? token.controllers.length : 0;

    // Find most connected controller (controller that appears in most relationships)
    const controllerConnectionCount = new Map();
    allRelationships.forEach(rel => {
      rel.sharedControllers.forEach(controllerId => {
        controllerConnectionCount.set(
          controllerId,
          (controllerConnectionCount.get(controllerId) || 0) + 1
        );
      });
    });

    const topController = controllerConnectionCount.size > 0
      ? Array.from(controllerConnectionCount.entries())
          .sort((a, b) => b[1] - a[1])[0]
      : null;

    return {
      token: {
        id: token.token_ledger_id || token.id,
        name: token.name,
        symbol: token.symbol,
        controllers: token.controllers || [],
      },
      relationships: allRelationships,
      summary: {
        totalConnections: allRelationships.length,
        uniqueControllers,
        topController: topController
          ? {
              id: topController[0],
              connectionCount: topController[1],
            }
          : null,
        cacheSize: relationshipCache.size(),
      },
    };
  } catch (error) {
    console.error('Error calculating token relationships:', error);
    return {
      token: null,
      relationships: [],
      summary: {
        totalConnections: 0,
        uniqueControllers: 0,
        topController: null,
        error: error.message,
      },
    };
  }
}

/**
 * Batch calculate relationships for multiple tokens and cache them
 * This is used to pre-populate the cache for popular tokens
 * @param {Array} tokens - Array of tokens
 * @param {number} batchSize - Process tokens in batches to avoid blocking
 * @returns {Object} - Map of tokenId -> relationships
 */
export async function batchCalculateRelationships(tokens, batchSize = 100) {
  const results = new Map();
  const controllerIndex = buildControllerIndex(tokens);

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);

    // Process batch in parallel
    const batchPromises = batch.map(async token => {
      const relationships = await findControllerRelationships(token, controllerIndex);
      return {
        tokenId: token.token_ledger_id || token.id,
        relationships,
      };
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach(result => {
      results.set(result.tokenId, result.relationships);
    });

    // Yield to event loop to prevent blocking
    if (i + batchSize < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * Cache relationships in the database
 * This stores the computed relationships for fast retrieval
 * @param {string} tokenId - The token's ledger ID
 * @param {Array} relationships - Array of relationship objects
 */
export async function cacheTokenRelationships(tokenId, relationships, isPriority = false) {
  if (!supabaseAdmin || !relationships || relationships.length === 0) {
    return;
  }

  try {
    // Prepare cache entries
    const cacheEntries = relationships.map(rel => ({
      token_ledger_id: tokenId,
      related_token_ledger_id: rel.tokenId || rel.tokenLedgerId,
      shared_controllers: rel.sharedControllers || [],
      controller_count: rel.controllerCount || 1,
      ic_id: rel.icId || 0,
    }));

    // Upsert into cache
    const { error } = await supabaseAdmin
      .from('token_relationships_cache')
      .upsert(cacheEntries, {
        onConflict: 'token_ledger_id,related_token_ledger_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error caching relationships:', error);
    }

    // Update cache stats - CRITICAL: Mark homepage tokens as priority for instant access
    await supabaseAdmin
      .from('relationship_cache_stats')
      .upsert({
        token_ledger_id: tokenId,
        total_relationships: relationships.length,
        last_computed_at: new Date().toISOString(),
        is_priority: isPriority, // Mark first 10 tokens for instant cache hits
      }, {
        onConflict: 'token_ledger_id',
      });

  } catch (err) {
    console.error('Failed to cache token relationships:', err);
  }
}

/**
 * Clear the relationship cache (both memory and database)
 */
export function clearRelationshipCache() {
  relationshipCache.clear();

  if (supabaseAdmin) {
    // Clear database cache asynchronously
    supabaseAdmin
      .from('token_relationships_cache')
      .delete()
      .neq('id', 0) // Delete all
      .then(({ error }) => {
        if (error) console.error('Error clearing database cache:', error);
      });
  }
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
export function getCacheStats() {
  return {
    memorySize: relationshipCache.size(),
    memoryMaxSize: relationshipCache.maxSize,
  };
}

/**
 * Precompute and cache relationships for most active tokens
 * This runs in the background to populate the cache
 * @param {Array} tokens - All tokens
 * @param {number} topN - Number of top tokens to precompute
 * @param {Set} homepageTokenIds - Set of homepage token IDs (highest ic_id) to mark as priority
 */
export async function precomputePopularTokenRelationships(tokens, topN = 100, homepageTokenIds = new Set()) {
  // Sort tokens by volume to find most active ones
  const sortedByVolume = [...tokens].sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
  const topTokens = sortedByVolume.slice(0, topN);

  const controllerIndex = buildControllerIndex(topTokens);

  for (const token of topTokens) {
    const tokenId = token.token_ledger_id || token.id;
    const isPriority = homepageTokenIds.has(tokenId);
    const relationships = await findControllerRelationships(token, controllerIndex);
    await cacheTokenRelationships(tokenId, relationships, isPriority);
  }
}

/**
 * Mark homepage tokens as priority in the database
 * This ensures their relationships are always precomputed
 */
export async function markHomepageTokensAsPriority() {
  if (!supabaseAdmin) {
    console.warn('Supabase admin not available, skipping priority marking');
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .rpc('mark_homepage_tokens_as_priority');

    if (error) {
      console.error('Error marking homepage tokens as priority:', error);
    }
  } catch (err) {
    console.error('Failed to mark homepage tokens as priority:', err);
  }
}

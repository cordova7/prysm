/**
 * Token Registry Service - Supabase Implementation
 * Replaces file-based persistence with database storage
 * Compatible with Vercel's serverless environment
 */

import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '../validate-env';

// Get validated environment variables
const env = validateEnv();

// Initialize Supabase client with service role for admin access
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Type definitions
interface TokenEntry {
  tokenLedgerId: string;
  icId?: number;
  controllers?: string[];
  name?: string;
  symbol?: string;
  price?: number;
  volume24h?: number;
  priceChange24h?: number;
  liquidity?: number;
  totalSupply?: number;
  marketCap?: number;
  pair?: string;
  dex?: string;
  firstSeen: string;
  lastUpdated?: string;
  isSeeded?: boolean;
}

interface TokenRegistryStats {
  totalTokens: number;
  lastUpdated: string;
}

// In-memory cache to reduce database calls
let tokenCache: Map<string, TokenEntry> | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Load all tokens from the database
 */
async function loadTokenRegistryFromDB(): Promise<Map<string, TokenEntry>> {
  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('*');

  if (error) {
    throw new Error(`Failed to load token registry: ${error.message}`);
  }

  const tokensMap = new Map<string, TokenEntry>();

  if (data && Array.isArray(data)) {
    data.forEach(token => {
      const tokenEntry: TokenEntry = {
        tokenLedgerId: token.token_ledger_id,
        icId: token.ic_id || undefined,
        controllers: token.controllers || [],
        name: token.name || undefined,
        symbol: token.symbol || undefined,
        price: token.price !== null ? Number(token.price) : undefined,
        volume24h: token.volume_24h !== null ? Number(token.volume_24h) : undefined,
        priceChange24h: token.price_change_24h !== null ? Number(token.price_change_24h) : undefined,
        liquidity: token.liquidity !== null ? Number(token.liquidity) : undefined,
        totalSupply: token.total_supply !== null ? Number(token.total_supply) : undefined,
        marketCap: token.market_cap !== null ? Number(token.market_cap) : undefined,
        pair: token.pair || undefined,
        dex: token.dex || undefined,
        firstSeen: token.first_seen,
        lastUpdated: token.last_updated || undefined,
        isSeeded: token.is_seeded || false,
      };
      tokensMap.set(tokenEntry.tokenLedgerId, tokenEntry);
    });
  }

  return tokensMap;
}

/**
 * Save token registry to database
 */
async function saveTokenRegistryToDB(tokensMap: Map<string, TokenEntry>): Promise<void> {
  // Convert Map to array
  const tokensArray = Array.from(tokensMap.values());

  if (tokensArray.length === 0) {
    return;
  }

  // Upsert tokens in batch
  const { error } = await supabaseAdmin
    .from('tokens')
    .upsert(
      tokensArray.map(token => ({
        token_ledger_id: token.tokenLedgerId,
        ic_id: token.icId || null,
        controllers: token.controllers || [],
        name: token.name || null,
        symbol: token.symbol || null,
        price: token.price || null,
        volume_24h: token.volume24h || null,
        price_change_24h: token.priceChange24h || null,
        liquidity: token.liquidity || null,
        total_supply: token.totalSupply || null,
        market_cap: token.marketCap || null,
        pair: token.pair || null,
        dex: token.dex || null,
        first_seen: token.firstSeen,
        last_updated: token.lastUpdated || new Date().toISOString(),
        is_seeded: token.isSeeded || false,
      })),
      {
        onConflict: 'token_ledger_id',
        ignoreDuplicates: false,
      }
    );

  if (error) {
    throw new Error(`Failed to save token registry: ${error.message}`);
  }
}

/**
 * Initialize the token registry (load from database)
 */
export async function initializeTokenRegistry(): Promise<void> {
  try {
    tokenCache = await loadTokenRegistryFromDB();
    lastCacheUpdate = Date.now();
    console.log(`Token registry initialized with ${tokenCache.size} tokens`);
  } catch (error) {
    console.error('Error initializing token registry:', error);
    // Initialize with empty cache on error
    tokenCache = new Map();
    lastCacheUpdate = Date.now();
    throw error;
  }
}

/**
 * Check if a token is new by comparing with registry
 */
export async function isNewToken(token: any): Promise<boolean> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  const tokenLedgerId = token.tokenLedgerId;

  if (!tokenLedgerId) {
    console.warn('Token without tokenLedgerId found:', token);
    return false;
  }

  const tokenExists = tokenCache!.has(tokenLedgerId);

  if (!tokenExists) {
    // This is a new token, add it to the cache
    const newTokenEntry: TokenEntry = {
      tokenLedgerId,
      ...token,
      firstSeen: new Date().toISOString(),
    };

    tokenCache!.set(tokenLedgerId, newTokenEntry);

    // Save to database asynchronously (fire and forget)
    saveTokenRegistryToDB(tokenCache!).catch(err => {
      console.error('Failed to save token registry after adding new token:', err);
    });

    return true;
  }

  return false;
}

/**
 * Get all tokens from the registry
 */
export async function getAllTrackedTokens(): Promise<TokenEntry[]> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  return Array.from(tokenCache!.values());
}

/**
 * Get only new tokens (added since specified date)
 */
export async function getNewTokens(sinceDate: Date | null = null): Promise<TokenEntry[]> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  let tokens = Array.from(tokenCache!.values());

  if (sinceDate) {
    tokens = tokens.filter(token => new Date(token.firstSeen) > sinceDate);
  }

  return tokens;
}

/**
 * Update the registry with a batch of tokens
 */
export async function updateTokenRegistry(tokens: any[]): Promise<any[]> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  const newTokens: any[] = [];
  let hasChanges = false;

  const now = new Date().toISOString();

  for (const token of tokens) {
    const tokenLedgerId = token.tokenLedgerId;

    if (!tokenLedgerId) {
      continue;
    }

    const exists = tokenCache!.has(tokenLedgerId);

    if (!exists) {
      // This is a new token
      const newTokenEntry: TokenEntry = {
        tokenLedgerId,
        ...token,
        firstSeen: now,
      };

      tokenCache!.set(tokenLedgerId, newTokenEntry);
      newTokens.push(newTokenEntry);
      hasChanges = true;
    } else if (hasChanges || token.lastUpdated) {
      // Update existing token
      const existingToken = tokenCache!.get(tokenLedgerId)!;
      const updatedToken = {
        ...existingToken,
        ...token,
        firstSeen: existingToken.firstSeen, // Preserve original firstSeen
      };

      tokenCache!.set(tokenLedgerId, updatedToken);
      hasChanges = true;
    }
  }

  // Save to database asynchronously if there are changes
  if (hasChanges) {
    saveTokenRegistryToDB(tokenCache!).catch(err => {
      console.error('Failed to save token registry after batch update:', err);
    });
  }

  return newTokens;
}

/**
 * Force save the registry (useful for testing or before shutdown)
 */
export async function saveTokenRegistryNow(): Promise<void> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  await saveTokenRegistryToDB(tokenCache!);
  console.log('Token registry saved to database');
}

/**
 * Get registry statistics
 */
export async function getRegistryStats(): Promise<TokenRegistryStats> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  return {
    totalTokens: tokenCache!.size,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Seed the registry with tokens without marking them as "new"
 */
export async function seedRegistryWithTokens(tokens: any[]): Promise<number> {
  if (!tokenCache) {
    await initializeTokenRegistry();
  }

  let addedCount = 0;
  const seedTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  for (const token of tokens) {
    const tokenLedgerId = token.tokenLedgerId;

    if (!tokenLedgerId) {
      console.warn('Token without tokenLedgerId found during seeding:', token);
      continue;
    }

    if (!tokenCache!.has(tokenLedgerId)) {
      const { firstSeen, ...tokenWithoutFirstSeen } = token;

      const newTokenEntry: TokenEntry = {
        tokenLedgerId,
        ...tokenWithoutFirstSeen,
        firstSeen: seedTime.toISOString(),
        isSeeded: true,
      };

      tokenCache!.set(tokenLedgerId, newTokenEntry);
      addedCount++;
    } else {
      // Update existing token but preserve its firstSeen date
      const existingToken = tokenCache!.get(tokenLedgerId)!;
      const updatedToken = {
        ...existingToken,
        ...token,
        firstSeen: existingToken.firstSeen,
        isSeeded: true,
      };

      tokenCache!.set(tokenLedgerId, updatedToken);
    }
  }

  // Save to database asynchronously
  saveTokenRegistryToDB(tokenCache!).catch(err => {
    console.error('Failed to save token registry after seeding:', err);
  });

  console.log(`Registry seeded with ${addedCount} tokens`);
  return addedCount;
}

/**
 * Reset the registry (dangerous - only for testing)
 */
export async function resetTokenRegistry(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tokens')
    .delete()
    .neq('id', 0); // Delete all rows

  if (error) {
    throw new Error(`Failed to reset token registry: ${error.message}`);
  }

  tokenCache = new Map();
  lastCacheUpdate = Date.now();
  console.log('Token registry has been reset');
}

/**
 * Refresh cache from database
 */
export async function refreshTokenRegistryCache(): Promise<void> {
  const now = Date.now();

  // Only refresh if cache is stale
  if (now - lastCacheUpdate < CACHE_TTL_MS) {
    return;
  }

  await initializeTokenRegistry();
}

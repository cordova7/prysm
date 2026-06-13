import { fetchTokens } from '@/lib/icpswap-api';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { updateTokens } from '@/lib/background-updater';

// Simple in-memory cache for API responses
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds
const STALE_DATA_THRESHOLD = 60 * 1000; // 1 minute - aggressive for free Vercel
let lastBackgroundUpdate = 0;

// API route to get all tokens (now optimized with Supabase!)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Check cache first
    const now = Date.now();
    if (cache && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('⚡ Returning cached tokens response (fast!)');

      if (format === 'plain') {
        return new Response(JSON.stringify(cache), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'ETag': `"${cacheTimestamp}"`
          }
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: cache,
          count: cache.length,
          timestamp: new Date(cacheTimestamp).toISOString(),
          cached: true
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'ETag': `"${cacheTimestamp}"`
          }
        }
      );
    }

    // ===== STEP 1: Try Supabase first (blazing fast!) =====
    if (isSupabaseConfigured()) {
      try {
        console.log('🚀 Fetching from Supabase (fast path)...');
        const { data: supabaseData, error } = await supabase
          .from('tokens')
          .select('*')
          .order('ic_id', { ascending: false, nullsLast: false });

        if (!error && supabaseData && supabaseData.length > 0) {
          // Calculate if token is new (within 24 hours)
          const isTokenNew = (createdAt) => {
            if (!createdAt) return false;
            const tokenAge = Date.now() - new Date(createdAt).getTime();
            return tokenAge < 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          };

          // Transform Supabase data to match expected format
          const transformedData = supabaseData.map(token => ({
            tokenLedgerId: token.token_ledger_id,
            icId: token.ic_id,
            name: token.name,
            symbol: token.symbol,
            price: token.price,
            volume24h: token.volume_24h,
            priceChange24h: token.price_change_24h,
            liquidity: token.liquidity,
            totalSupply: token.total_supply,
            marketCap: token.market_cap,
            pair: token.pair,
            dex: token.dex,
            firstSeen: token.first_seen,
            lastUpdated: token.last_updated,
            createdAt: token.created_at,
            updatedAt: token.updated_at,
            isNew: isTokenNew(token.created_at),
          }));

          // Update cache
          cache = transformedData;
          cacheTimestamp = now;

          console.log(`✅ Supabase response: ${supabaseData.length} tokens (${Date.now() - now}ms)`);

          // ===== TRIGGER UPDATE ON VISIT IF DATA IS STALE =====
          const timeSinceLastUpdate = now - lastBackgroundUpdate;
          if (timeSinceLastUpdate > STALE_DATA_THRESHOLD) {
            console.log(`🔄 Data is stale (${Math.floor(timeSinceLastUpdate / 1000)}s old), updating on visit...`);
            lastBackgroundUpdate = now;

            // Fire and forget - don't await this, but add a callback to invalidate cache after update
            updateTokens(false) // false = don't force, check if stale first
              .then(result => {
                if (result.success) {
                  console.log('✅ On-demand update completed successfully');
                  console.log('📡 New tokens added:', result.newTokensDetected);
                } else if (result.skipped) {
                  console.log('⏭️ Update skipped (already in progress)');
                } else {
                  console.log('ℹ️ Update status:', result.message);
                }
              })
              .catch(error => {
                console.error('❌ On-demand update error:', error.message);
              });
          }

          if (format === 'plain') {
            return new Response(JSON.stringify(transformedData), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'ETag': `"${cacheTimestamp}"`
              }
            });
          }

          return new Response(
            JSON.stringify({
              success: true,
              data: transformedData,
              count: transformedData.length,
              timestamp: new Date().toISOString(),
              source: 'supabase'
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'ETag': `"${cacheTimestamp}"`
              }
            }
          );
        } else {
          console.log('⚠️ Supabase returned empty or error, falling back to ICPSWAP API');
        }
      } catch (supabaseError) {
        console.error('⚠️ Supabase query failed, falling back:', supabaseError.message);
      }
    } else {
      console.log('ℹ️ Supabase not configured, using ICPSWAP API');
    }

    // ===== STEP 2: Fallback to ICPSWAP API (only if Supabase unavailable) =====
    console.log('📡 Fetching from ICPSWAP API (slow path, but fallback)...');
    const tokens = await fetchTokens();

    // Calculate if token is new (within 24 hours)
    const isTokenNew = (createdAt) => {
      if (!createdAt) return false;
      const tokenAge = Date.now() - new Date(createdAt).getTime();
      return tokenAge < 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    };

    // Add isNew flag to all tokens
    const tokensWithNewFlag = tokens.map(token => ({
      ...token,
      isNew: isTokenNew(token.createdAt),
    }));

    // Sort tokens by icId descending (highest first) for consistent ordering
    const sortedTokens = tokensWithNewFlag.sort((a, b) => {
      // Handle null/undefined icId values
      const aId = a.icId ?? -1;
      const bId = b.icId ?? -1;

      // Sort descending (highest first)
      if (aId !== bId) {
        return bId - aId;
      }

      // Fallback to name for stable sort
      const aName = a.name || a.symbol || a.tokenLedgerId || '';
      const bName = b.name || b.symbol || b.tokenLedgerId || '';
      return aName.localeCompare(bName);
    });

    // Update cache
    cache = sortedTokens;
    cacheTimestamp = now;

    console.log(`✅ ICPSWAP API response: ${sortedTokens.length} tokens (${Date.now() - now}ms)`);

    if (format === 'plain') {
      return new Response(JSON.stringify(sortedTokens), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'ETag': `"${cacheTimestamp}"`
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: sortedTokens,
        count: sortedTokens.length,
        timestamp: new Date().toISOString(),
        source: 'icpswap'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'ETag': `"${cacheTimestamp}"`
        }
      }
    );
  } catch (error) {
    console.error('Error fetching tokens:', error);

    // Return cached data if available on error
    if (cache) {
      console.log('Returning stale cached data due to error');
      return new Response(
        JSON.stringify({
          success: true,
          data: cache,
          count: cache.length,
          timestamp: new Date(cacheTimestamp).toISOString(),
          stale: true,
          error: error.message
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch tokens'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

import { NextResponse } from 'next/server'
import { HttpAgent, Actor } from '@dfinity/agent'
import { IDL } from '@dfinity/candid'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { populateICIdsForTokens } from '@/lib/ic-id-fetcher'
import { updateTokenRegistry, saveTokenRegistryNow } from '@/lib/server/token-tracker'
import { getTokenRelationships, cacheTokenRelationships } from '@/lib/token-relationships'
import { idlFactory as ICRC1IDL } from '@/scripts/index.js'

const API_BASE = process.env.NEXT_PUBLIC_ICPSWAP_API_BASE_URL || 'https://api.icpswap.com/info';
const CHART_PREFETCH_LIMIT = 100;
const CHART_PREFETCH_CONCURRENCY = 8;
const ICP_HOST = 'https://ic0.app';
const CANISTER_META_TIMEOUT_MS = 4000;
const DIP20_IDL = ({ IDL: IDLParam }) =>
  IDLParam.Service({
    name: IDLParam.Func([], [IDLParam.Text], ['query']),
    symbol: IDLParam.Func([], [IDLParam.Text], ['query']),
  });

const pickText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
};

const pickNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
};

const pickArray = (...values) => {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
};

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
  ]);

const extractMetadataValue = (value) => {
  if (!value || typeof value !== 'object') return null;
  const key = Object.keys(value)[0];
  const raw = value[key];
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  if (typeof raw === 'bigint') return raw.toString();
  if (Array.isArray(raw)) return raw.map((item) => (typeof item === 'number' ? item : '')).join('');
  return null;
};

const parseMetadataNameSymbol = (metadata) => {
  if (!Array.isArray(metadata)) return { name: null, symbol: null };
  const byKey = new Map();
  metadata.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return;
    const key = String(entry[0] || '').toLowerCase();
    const value = extractMetadataValue(entry[1]);
    if (!value) return;
    byKey.set(key, value);
  });

  const nameKeys = ['icrc1:name', 'name', 'token:name', 'token_name'];
  const symbolKeys = ['icrc1:symbol', 'symbol', 'token:symbol', 'token_symbol'];

  let name = null;
  let symbol = null;

  for (const key of nameKeys) {
    if (byKey.has(key)) {
      name = byKey.get(key);
      break;
    }
  }

  for (const key of symbolKeys) {
    if (byKey.has(key)) {
      symbol = byKey.get(key);
      break;
    }
  }

  if (!name || !symbol) {
    for (const [key, value] of byKey.entries()) {
      if (!name && key.includes('name') && !key.includes('logo')) {
        name = value;
      }
      if (!symbol && key.includes('symbol')) {
        symbol = value;
      }
      if (name && symbol) break;
    }
  }

  return { name, symbol };
};

const fetchDip20NameSymbol = async (tokenId, agent) => {
  try {
    const dipActor = Actor.createActor(DIP20_IDL, { agent, canisterId: tokenId });
    const [name, symbol] = await Promise.all([
      withTimeout(dipActor.name(), CANISTER_META_TIMEOUT_MS).catch(() => null),
      withTimeout(dipActor.symbol(), CANISTER_META_TIMEOUT_MS).catch(() => null),
    ]);
    const safeName = typeof name === 'string' && name.trim() ? name.trim() : null;
    const safeSymbol = typeof symbol === 'string' && symbol.trim() ? symbol.trim() : null;
    if (!safeName && !safeSymbol) return null;
    return { name: safeName, symbol: safeSymbol };
  } catch {
    return null;
  }
};

const fetchCanisterNameSymbol = async (tokenId) => {
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    const actor = Actor.createActor(ICRC1IDL, { agent, canisterId: tokenId });

    const [name, symbol] = await Promise.all([
      withTimeout(actor.icrc1_name(), CANISTER_META_TIMEOUT_MS).catch(() => null),
      withTimeout(actor.icrc1_symbol(), CANISTER_META_TIMEOUT_MS).catch(() => null),
    ]);

    const safeName = typeof name === 'string' && name.trim() ? name.trim() : null;
    const safeSymbol = typeof symbol === 'string' && symbol.trim() ? symbol.trim() : null;

    if (safeName || safeSymbol) return { name: safeName, symbol: safeSymbol };

    const metadata = await withTimeout(actor.icrc1_metadata(), CANISTER_META_TIMEOUT_MS).catch(() => null);
    if (!metadata) return null;
    const parsed = parseMetadataNameSymbol(metadata);
    const metaName = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;
    const metaSymbol = typeof parsed.symbol === 'string' && parsed.symbol.trim() ? parsed.symbol.trim() : null;
    if (metaName || metaSymbol) return { name: metaName, symbol: metaSymbol };

    return await fetchDip20NameSymbol(tokenId, agent);
  } catch {
    return null;
  }
};

const fetchMissingIdentityFromCanisters = async (tokens) => {
  const targets = tokens.filter((token) => {
    const name = pickText(token.tokenName, token.name);
    const symbol = pickText(token.tokenSymbol, token.symbol);
    return !name || !symbol;
  });

  if (targets.length === 0) return new Map();

  const concurrency = Math.min(5, targets.length);
  const queue = [...targets];
  const results = new Map();

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const token = queue.shift();
      if (!token?.tokenLedgerId) continue;
      const meta = await fetchCanisterNameSymbol(token.tokenLedgerId);
      if (meta) results.set(token.tokenLedgerId, meta);
    }
  });

  await Promise.all(workers);
  return results;
};

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please check environment variables.' },
        { status: 500 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client not configured. Missing SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    const { action } = await request.json().catch(() => ({ action: 'stats' }))

    console.log(`🔧 Seed registry action: ${action}`)

    if (action === 'stats') {
      return await getStats()
    } else if (action === 'seed') {
      return await seedRegistry()
    } else if (action === 'reset') {
      return await resetRegistry()
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: stats, seed, or reset' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

async function getStats() {
  console.log('📊 Getting token statistics...')

  const { count, error } = await supabaseAdmin
    .from('tokens')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('❌ Stats query error:', error)
    return NextResponse.json(
      { error: 'Failed to get stats', details: error.message },
      { status: 500 }
    )
  }

  // Get new tokens in last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: newTokensCount, error: newTokensError } = await supabaseAdmin
    .from('tokens')
    .select('*', { count: 'exact', head: true })
    .gte('first_seen', yesterday)

  if (newTokensError) {
    console.error('❌ New tokens query error:', newTokensError)
  }

  const stats = {
    total: count || 0,
    newLast24h: newTokensCount || 0,
    timestamp: new Date().toISOString(),
  }

  console.log('✅ Stats retrieved:', stats)

  return NextResponse.json(
    { success: true, ...stats },
    { status: 200 }
  )
}

async function seedRegistry() {
  console.log('🌱 Starting token registry seeding with IC ID population...\n')

  try {
    // Fetch all tokens directly from ICPSWAP API
    console.log('📡 Fetching tokens from ICPSWAP API...')
    const response = await fetch(`${API_BASE}/token/all`)

    if (!response.ok) {
      throw new Error(`ICPSWAP API request failed with status ${response.status}`)
    }

    const result = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || 'ICPSWAP API returned error')
    }

    const icpswapTokens = result.data || []
    console.log(`✅ Fetched ${icpswapTokens.length} tokens from ICPSWAP`)

    // ===== STEP 1: Get existing tokens from database with their IC IDs and controllers =====
    console.log('📊 Fetching existing tokens from database...')
    const { data: existingTokens } = await supabaseAdmin
      .from('tokens')
      .select('token_ledger_id, ic_id, controllers, name, symbol, price, volume_24h, price_change_24h, liquidity, total_supply, market_cap, pair, dex, first_seen')
      .limit(10000)

    // Create a map of existing tokens for quick lookup
    const existingTokenMap = new Map(
      (existingTokens || []).map(t => [t.token_ledger_id, t])
    )
    console.log(`✅ Found ${existingTokenMap.size} existing tokens in database\n`)

    // ===== STEP 2: Identify which tokens need IC ID fetching =====
    // Use database ic_id if available, otherwise fetch from API
    const tokensNeedingIcId = []
    const tokensWithExistingIcId = []

    for (const token of icpswapTokens) {
      const existing = existingTokenMap.get(token.tokenLedgerId)
      if (existing && existing.ic_id && existing.ic_id !== 0) {
        // Use existing IC ID from database (no need to re-fetch)
        token.icId = existing.ic_id

        // Check if controllers exist and are populated
        const hasValidControllers = existing.controllers &&
                                    Array.isArray(existing.controllers) &&
                                    existing.controllers.length > 0;

        if (hasValidControllers) {
          token.controllers = existing.controllers
          tokensWithExistingIcId.push(token)
        } else {
          // Controllers missing/empty - need to fetch them
          token.controllers = []
          tokensNeedingIcId.push(token)
        }
      } else {
        // Need to fetch IC ID (new token or missing ic_id)
        tokensNeedingIcId.push(token)
      }
    }

    console.log(`🔄 Using existing IC IDs: ${tokensWithExistingIcId.length} tokens`)
    console.log(`🔍 Need to fetch IC IDs: ${tokensNeedingIcId.length} tokens\n`)

    // ===== STEP 3: Fetch IC IDs only for tokens that need them =====
    let tokensWithIcIds = [...tokensWithExistingIcId]
    if (tokensNeedingIcId.length > 0) {
      console.log('🌐 Fetching IC IDs from API (only for new/missing tokens)...')
      const tokensWithNewIcIds = await populateICIdsForTokens(tokensNeedingIcId)
      tokensWithIcIds = [...tokensWithIcIds, ...tokensWithNewIcIds]
      console.log(`✅ Fetched IC IDs for ${tokensWithNewIcIds.length} new tokens\n`)
    } else {
      console.log('✅ All tokens already have IC IDs in database!\n')
    }

    // ===== UPDATE FILE-BASED TOKEN REGISTRY =====
    // Transform tokens to match expected format for token tracker
    const canisterIdentity = await fetchMissingIdentityFromCanisters(tokensWithIcIds);
    if (canisterIdentity.size > 0) {
      tokensWithIcIds.forEach((token) => {
        const meta = canisterIdentity.get(token.tokenLedgerId);
        if (!meta) return;
        if (!pickText(token.tokenName, token.name) && meta.name) {
          token.tokenName = meta.name;
          token.name = meta.name;
        }
        if (!pickText(token.tokenSymbol, token.symbol) && meta.symbol) {
          token.tokenSymbol = meta.symbol;
          token.symbol = meta.symbol;
        }
      });
    }

    const tokensForRegistry = tokensWithIcIds.map(token => {
      const existing = existingTokenMap.get(token.tokenLedgerId);

      return ({
        tokenLedgerId: token.tokenLedgerId,
        name: pickText(token.tokenName, token.name, existing?.name),
        symbol: pickText(token.tokenSymbol, token.symbol, existing?.symbol),
        price: pickNumber(token.price, existing?.price),
        volume24h: pickNumber(token.volumeUSD24H, token.volume24h, existing?.volume_24h),
        priceChange24h: pickNumber(token.priceChange24H, token.priceChange24h, existing?.price_change_24h),
        liquidity: pickNumber(token.tvlUSD, token.liquidity, existing?.liquidity),
        totalSupply: pickNumber(token.totalSupply, token.totalSupply, existing?.total_supply),
        marketCap: pickNumber(token.marketCap, token.marketCap, existing?.market_cap),
        pair: token.pair ?? existing?.pair ?? null,
        dex: token.dex ?? existing?.dex ?? null,
        lastUpdated: new Date().toISOString(),
        controllers: pickArray(token.controllers, existing?.controllers),
      });
    });

    console.log('📝 Updating file-based token registry...');
    const newTokensFromRegistry = await updateTokenRegistry(tokensForRegistry);
    console.log(`✅ File registry updated: ${newTokensFromRegistry.length} new tokens detected\n`);

    // Force save to disk to ensure it's written immediately
    await saveTokenRegistryNow();
    console.log('💾 File registry forced saved to disk\n');

    // ===== STEP 4: Transform to database schema =====
    const transformedTokens = tokensWithIcIds.map(token => {
      const existing = existingTokenMap.get(token.tokenLedgerId);

      return ({
        token_ledger_id: token.tokenLedgerId,
        ic_id: token.icId || existing?.ic_id || null,
        controllers: pickArray(token.controllers, existing?.controllers),
        name: pickText(token.tokenName, token.name, existing?.name),
        symbol: pickText(token.tokenSymbol, token.symbol, existing?.symbol),
        price: pickNumber(token.price, existing?.price),
        volume_24h: pickNumber(token.volumeUSD24H, token.volume24h, existing?.volume_24h),
        price_change_24h: pickNumber(token.priceChange24H, token.priceChange24h, existing?.price_change_24h),
        liquidity: pickNumber(token.tvlUSD, token.liquidity, existing?.liquidity),
        total_supply: pickNumber(token.totalSupply, existing?.total_supply),
        market_cap: pickNumber(token.marketCap, existing?.market_cap),
        pair: token.pair ?? existing?.pair ?? null,
        dex: token.dex ?? existing?.dex ?? null,
        last_updated: new Date().toISOString(),
        first_seen: existing?.first_seen || new Date().toISOString(),
      })
    })
    // ===== STEP 5: Identify truly new tokens (not in database at all) =====
    const newTokens = icpswapTokens.filter(token => !existingTokenMap.has(token.tokenLedgerId))

    // Map new tokens to their populated data with IC IDs and controllers
    const newTokensWithData = newTokens.map(newToken => {
      const populatedVersion = tokensWithIcIds.find(t => t.tokenLedgerId === newToken.tokenLedgerId);
      return populatedVersion || newToken;
    });

    // ===== STEP 6: Bulk upsert to Supabase (smaller batches for stability)
    const batchSize = 50  // Reduced from 500 to 50
    let upserted = 0
    let errors = 0
    const errorMessages = []

    for (let i = 0; i < transformedTokens.length; i += batchSize) {
      const batch = transformedTokens.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(transformedTokens.length / batchSize)

      console.log(`📦 Upserting batch ${batchNumber}/${totalBatches} (${batch.length} tokens)...`)

      const { error } = await supabaseAdmin
        .from('tokens')
        .upsert(batch, {
          onConflict: 'token_ledger_id',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error.message)
        console.error(`Error details:`, JSON.stringify(error, null, 2))
        errors += batch.length
        errorMessages.push(`Batch ${batchNumber}: ${error.message}`)
        // Continue with next batch instead of stopping
      } else {
        upserted += batch.length
        console.log(`✅ Batch ${batchNumber} upserted successfully (${upserted}/${transformedTokens.length})`)
      }
    }

    // Get final count
    const { count: totalCount } = await supabaseAdmin
      .from('tokens')
      .select('*', { count: 'exact', head: true })

    const { count: withIcIdCount } = await supabaseAdmin
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .not('ic_id', 'is', null)
      .neq('ic_id', 0)

    // ===== STEP 7: Auto-update relationships for NEW tokens =====
    // We need to fetch existing tokens to find relationships between new and existing tokens
    if (newTokensWithData.length > 0) {
      console.log(`\n🔗 Calculating relationships for ${newTokensWithData.length} new tokens...`)

      // Fetch existing tokens from database for relationship calculation
      const { data: existingTokens } = await supabaseAdmin
        .from('tokens')
        .select('token_ledger_id, name, symbol, price, volume_24h, liquidity, controllers, ic_id')
        .limit(10000)

      // Combine existing tokens with new tokens for relationship calculation
      const allTokensForRelationshipCalc = [
        ...(existingTokens || []),
        ...transformedTokens, // Include newly upserted tokens
      ]

      await updateRelationshipsForNewTokens(newTokensWithData, allTokensForRelationshipCalc)
    } else {
      console.log(`\n✅ No new tokens to process - relationships will be computed on demand`)
    }

    await precomputeChartsForTopTokens();

    const resultData = {
      success: true,
      totalInDatabase: totalCount || 0,
      tokensWithICIds: withIcIdCount || 0,
      fetchedFromICPSWAP: icpswapTokens.length,
      newTokensDetected: newTokensWithData.length,
      newTokensInFileRegistry: newTokensFromRegistry.length,
      upserted,
      errors,
      errorMessages: errorMessages.slice(0, 10), // Limit to first 10 errors
      timestamp: new Date().toISOString(),
    }

    console.log('\n🎉 Seeding completed:', resultData)

    return NextResponse.json(resultData, { status: 200 })

  } catch (error) {
    console.error('💥 Seeding failed:', error)
    return NextResponse.json(
      { error: 'Seeding failed', details: error.message },
      { status: 500 }
    )
  }
}

async function precomputeChartsForTopTokens() {
  try {
    const { data: topTokens, error } = await supabaseAdmin
      .from('tokens')
      .select('token_ledger_id, ic_id')
      .order('ic_id', { ascending: false, nullsLast: true })
      .limit(CHART_PREFETCH_LIMIT);

    if (error || !topTokens || topTokens.length === 0) {
      console.warn('?? Chart precompute skipped: no tokens');
      return;
    }

    const tokenIds = topTokens.map((token) => token.token_ledger_id).filter(Boolean);
    const nowIso = new Date().toISOString();

    const { data: existingCharts } = await supabaseAdmin
      .from('token_charts')
      .select('token_ledger_id, expires_at')
      .in('token_ledger_id', tokenIds)
      .eq('timeframe', '24h')
      .gt('expires_at', nowIso);

    const cachedIds = new Set((existingCharts || []).map((row) => row.token_ledger_id));
    const targets = tokenIds.filter((tokenId) => !cachedIds.has(tokenId));

    if (targets.length === 0) {
      console.log('?? Chart precompute: all top tokens cached');
      return;
    }

    console.log(`?? Precomputing charts for ${targets.length} top tokens...`);

    const queue = [...targets];
    const results = [];

    const workers = Array.from({ length: CHART_PREFETCH_CONCURRENCY }).map(async () => {
      while (queue.length > 0) {
        const tokenId = queue.shift();
        if (!tokenId) break;

        try {
          const response = await fetch(`${API_BASE}/token/${tokenId}/chart/h1?page=1&limit=24`);
          if (!response.ok) {
            results.push({ tokenId, chartData: [] });
            continue;
          }

          const result = await response.json();
          let chartData = [];

          if (result.code === 200 && result.data && Array.isArray(result.data.content)) {
            chartData = result.data.content.map((item) => ({
              time: item.snapshotTime,
              price: parseFloat(item.price),
              volume: parseFloat(item.volumeUSD),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              open: parseFloat(item.open),
              close: parseFloat(item.close),
              snapshotTime: item.snapshotTime,
              timezone: 'UTC',
            }));
          }

          results.push({ tokenId, chartData });
        } catch (error) {
          results.push({ tokenId, chartData: [] });
        }
      }
    });

    await Promise.all(workers);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const upserts = results.map((item) => ({
      token_ledger_id: item.tokenId,
      timeframe: '24h',
      chart_data: item.chartData,
      expires_at: expiresAt,
    }));

    if (upserts.length > 0) {
      await supabaseAdmin
        .from('token_charts')
        .upsert(upserts, { onConflict: 'token_ledger_id,timeframe' });
      console.log(`? Chart precompute complete: ${upserts.length} tokens cached`);
    }
  } catch (error) {
    console.warn('?? Chart precompute failed:', error.message);
  }
}

async function resetRegistry() {
  console.log('🗑️ Resetting token registry...')

  const confirmReset = await request.json().catch(() => ({}))
  if (confirmReset.action !== 'reset') {
    return NextResponse.json(
      { error: 'Invalid reset action. Use: { "action": "reset" }' },
      { status: 400 }
    )
  }

  // Delete all tokens
  const { error } = await supabaseAdmin
    .from('tokens')
    .delete()
    .neq('token_ledger_id', '') // Delete all

  if (error) {
    console.error('❌ Reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset registry', details: error.message },
      { status: 500 }
    )
  }

  // Delete all chart data
  const { error: chartError } = await supabaseAdmin
    .from('token_charts')
    .delete()
    .neq('id', 0)

  if (chartError) {
    console.error('⚠️ Chart reset warning:', chartError.message)
  }

  console.log('✅ Registry reset successfully')

  return NextResponse.json(
    {
      success: true,
      message: 'Registry reset successfully',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}

/**
 * Update relationships for new tokens
 * This ensures every new token has its relationships calculated and cached
 * @param {Array} newTokens - Array of newly detected tokens (with populated controllers)
 * @param {Array} allTokens - All tokens (including the newly upserted ones) for relationship calculation
 */
async function updateRelationshipsForNewTokens(newTokens, allTokens) {
  try {
    console.log(`📊 Using ${allTokens.length} tokens for relationship calculation`)

    // Process new tokens in small batches
    const batchSize = 10
    let processed = 0
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < newTokens.length; i += batchSize) {
      const batch = newTokens.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(newTokens.length / batchSize)

      console.log(`\n🔗 Processing batch ${batchNumber}/${totalBatches} (${batch.length} new tokens)...`)

      // Process batch in parallel
      const batchPromises = batch.map(async (newToken) => {
        try {
          // Find the token in allTokens (should have controllers now)
          const fullTokenData = allTokens.find(t => t.token_ledger_id === newToken.tokenLedgerId)

          if (!fullTokenData) {
            console.warn(`⚠️ Token ${newToken.tokenLedgerId} not found in allTokens`)
            return { tokenId: newToken.tokenLedgerId, success: false, error: 'Token not found' }
          }

          // Verify controllers exist
          if (!fullTokenData.controllers || fullTokenData.controllers.length === 0) {
            console.warn(`⚠️ Token ${newToken.tokenLedgerId} has no controllers`)
            return { tokenId: newToken.tokenLedgerId, success: false, error: 'No controllers' }
          }

          // Calculate relationships for this new token
          const relationshipData = await getTokenRelationships(fullTokenData, allTokens)

          // Cache the relationships in the database
          if (relationshipData.relationships && relationshipData.relationships.length > 0) {
            await cacheTokenRelationships(
              newToken.tokenLedgerId,
              relationshipData.relationships,
              false // Not a priority token
            )
          }

          console.log(`✅ Token ${newToken.tokenLedgerId}: ${relationshipData.relationships?.length || 0} relationships cached`)
          return { tokenId: newToken.tokenLedgerId, success: true, relationships: relationshipData.relationships?.length || 0 }
        } catch (err) {
          console.error(`❌ Error calculating relationships for ${newToken.tokenLedgerId}:`, err.message)
          return { tokenId: newToken.tokenLedgerId, success: false, error: err.message }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      // Count successes and errors
      batchResults.forEach(result => {
        processed++
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      })

      console.log(`📊 Batch ${batchNumber} complete: ${successCount}/${processed} successful, ${errorCount} errors`)

      // Small delay between batches
      if (i + batchSize < newTokens.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`\n🎉 Relationship calculation complete!`)
    console.log(`✅ Successfully processed: ${successCount} tokens`)
    console.log(`❌ Errors: ${errorCount} tokens\n`)

  } catch (error) {
    console.error('💥 Failed to update relationships for new tokens:', error)
  }
}

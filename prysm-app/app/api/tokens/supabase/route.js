import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { updateTokens } from '@/lib/background-updater'

// Simple rate limiting for update triggers
let isUpdating = false;
let seedPromise = null;
let seedSkippedNoAdmin = false;
const STALE_DATA_THRESHOLD = 30 * 1000; // 30 seconds - faster new token detection

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ensureSeeded(request) {
  if (seedSkippedNoAdmin) {
    return { seeded: false, skipped: true }
  }

  const { count, error } = await supabase
    .from('tokens')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.warn('?? Seed check failed:', error.message)
    return { seeded: false, error }
  }

  if ((count || 0) > 0) {
    return { seeded: false }
  }

  if (!supabaseAdmin) {
    seedSkippedNoAdmin = true
    console.warn('?? Seed skipped: SUPABASE_SERVICE_ROLE_KEY not configured')
    return { seeded: false, skipped: true }
  }

  if (!seedPromise) {
    const seedUrl = new URL('/api/seed-registry/supabase', request.url)
    seedPromise = (async () => {
      console.log('?? Seeding tokens on first request...')
      const response = await fetch(seedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      })

      if (!response.ok) {
        throw new Error(`Seed request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Seed failed with unknown error')
      }

      console.log(`?? Seed complete: ${result.totalInDatabase} tokens`)
      return result
    })().finally(() => {
      seedPromise = null
    })
  }

  try {
    const result = await seedPromise
    return { seeded: true, result }
  } catch (error) {
    console.error('?? Seed failed:', error.message)
    return { seeded: false, error }
  }
}

export async function GET(request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please check environment variables.' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10) // Homepage uses 10 tokens
    const sort = searchParams.get('sort') || 'ic_id'
    const order = searchParams.get('order') || 'desc'

    // Validate pagination
    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Limit max page size to 120 for performance
    const maxLimit = 120
    const effectiveLimit = Math.min(limit, maxLimit)
    const offset = (page - 1) * effectiveLimit

    console.log(`🔍 Fetching tokens: page ${page}, limit ${effectiveLimit}, sort ${sort}:${order}`)

    // Seed on first request if the tokens table is empty
    await ensureSeeded(request)

    // OPTIMIZATION: Select only needed columns (not all 20+ columns) to reduce payload by ~60%
    let query = supabase
      .from('tokens')
      .select(`
        token_ledger_id,
        ic_id,
        controllers,
        name,
        symbol,
        price,
        volume_24h,
        price_change_24h,
        liquidity,
        total_supply,
        market_cap,
        pair,
        dex,
        first_seen,
        last_updated,
        created_at,
        updated_at
      `, { count: 'exact' })

    // Apply sorting
    if (sort === 'ic_id') {
      query = query.order('ic_id', { ascending: order === 'asc', nullsFirst: false })
    } else if (sort === 'price') {
      query = query.order('price', { ascending: order === 'asc', nullsFirst: false })
    } else if (sort === 'volume') {
      query = query.order('volume_24h', { ascending: order === 'asc', nullsFirst: false })
    } else if (sort === 'first_seen') {
      query = query.order('first_seen', { ascending: order === 'asc' })
    } else {
      // Default: sort by ic_id descending (highest first)
      query = query.order('ic_id', { ascending: false, nullsFirst: false })
    }

    // Apply pagination
    query = query.range(offset, offset + effectiveLimit - 1)

    // ===== GET LAST UPDATED TIMESTAMP =====
    // Check how recently the database was updated
    const { data: latestToken } = await supabase
      .from('tokens')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    const lastDbUpdate = latestToken?.last_updated ? new Date(latestToken.last_updated).getTime() : 0
    const now = Date.now()
    const timeSinceDbUpdate = lastDbUpdate ? now - lastDbUpdate : Infinity

    // Execute main query
    const { data, error, count } = await query

    if (error) {
      console.error('❌ Supabase query error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    // ===== UPDATE ON VISIT =====
    // Trigger background update if data is stale and not already updating
    if (!isUpdating && timeSinceDbUpdate > STALE_DATA_THRESHOLD) {
      console.log(`🔄 Data is stale (${Math.floor(timeSinceDbUpdate / 1000)}s old), triggering background update...`)
      isUpdating = true

      // Fire and forget - update happens in background, doesn't block response
      updateTokens(false)
        .then(result => {
          isUpdating = false
          if (result.success) {
            console.log(`✅ Background update successful: ${result.newTokensDetected} new tokens`)
          } else if (result.skipped) {
            console.log('⏭️ Update skipped (already in progress)')
          }
        })
        .catch(error => {
          isUpdating = false
          console.error('❌ Background update error:', error.message)
        })
    } else if (isUpdating) {
      console.log('⏭️ Update already in progress, skipping...')
    } else {
      console.log(`ℹ️ Data is fresh (${Math.floor(timeSinceDbUpdate / 1000)}s old)`)
    }

    // Prefetch chart cache for tokens in this page (highest ic_id first)
    const pageTokenIds = data
      .map((token) => token.token_ledger_id)
      .filter(Boolean)

    const chartsByToken = new Map()
    if (pageTokenIds.length > 0) {
      const { data: chartRows } = await supabase
        .from('token_charts')
        .select('token_ledger_id, chart_data, timeframe, expires_at')
        .in('token_ledger_id', pageTokenIds)
        .eq('timeframe', '24h')
        .gt('expires_at', new Date().toISOString())

      if (chartRows && chartRows.length > 0) {
        chartRows.forEach((row) => {
          chartsByToken.set(row.token_ledger_id, row.chart_data || [])
        })
      }
    }

    // Transform data to match original format
    const twentyFourHours = 24 * 60 * 60 * 1000

    const transformedData = data.map(token => {
      const isNew = token.first_seen && (now - new Date(token.first_seen).getTime()) < twentyFourHours

      const chartCache = chartsByToken.get(token.token_ledger_id) || null
      const chartData = Array.isArray(chartCache)
        ? chartCache
            .map((item) => Number(item?.price ?? item?.close ?? 0))
            .filter((value) => Number.isFinite(value) && value > 0)
        : []

      return {
        tokenLedgerId: token.token_ledger_id,
        icId: token.ic_id,
        controllers: token.controllers || [],
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
        chartData,
        chartCache,
        isNew, // Add NEW flag for tokens seen in last 24h
      }
    })

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / effectiveLimit)
    const hasMore = page < totalPages

    console.log(`✅ Query successful: ${data.length} tokens returned (page ${page}/${totalPages})`)

    // Return response
    return NextResponse.json(
      {
        data: transformedData,
        pagination: {
          page,
          limit: effectiveLimit,
          total: totalCount,
          totalPages,
          hasMore,
        },
        meta: {
          sort,
          order,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          // Keep CDN caching short so the UI can reflect updates quickly.
          'Cache-Control': 'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
        },
      }
    )

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

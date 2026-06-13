import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { updateTokens } from '@/lib/background-updater'

export const dynamic = 'force-dynamic'
export const revalidate = 0
let isUpdating = false

export async function GET(request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please check environment variables.' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Trigger background update on new-tokens polling (fire-and-forget)
    if (!isUpdating) {
      isUpdating = true
      updateTokens(false, true)
        .then(result => {
          isUpdating = false
          if (result.success) {
            console.log(`? New-tokens poll update: ${result.newTokensDetected} new tokens`)
          } else if (result.skipped) {
            console.log('?? New-tokens poll update skipped (already in progress)')
          }
        })
        .catch(error => {
          isUpdating = false
          console.error('? New-tokens poll update error:', error.message)
        })
    }

    // Calculate timestamp
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    console.log(`🔍 Fetching new tokens (last ${hours} hours), limit: ${limit}`)

    // Query for tokens added in the specified timeframe
    const { data, error } = await supabase
      .from('tokens')
      .select('*')
      .gte('first_seen', hoursAgo)
      .order('first_seen', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Supabase query error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    // Transform data to match original format
    const transformedData = data.map(token => ({
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
    }))

    console.log(`✅ Found ${transformedData.length} new tokens in last ${hours} hours`)

    // Return response
    return NextResponse.json(
      {
        data: transformedData,
        count: transformedData.length,
        timeframe: `${hours}h`,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          // New token alerts should always be fresh.
          'Cache-Control': 'no-store',
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

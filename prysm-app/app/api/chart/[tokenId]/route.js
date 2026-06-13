// API route to fetch chart data for a specific token with Supabase caching
// This connects to the ICPSWAP chart API and caches results in Supabase

import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url)
  const tokenId = params.tokenId
  const timeRange = searchParams.get('timeRange') || '24h'

  // Map our time ranges to ICPSWAP API time levels
  let level
  switch (timeRange) {
    case '24h':
      level = 'h1' // Hourly data for 24 hours
      break
    case '7d':
      level = 'd1' // Daily data for 7 days
      break
    case '30d':
      level = 'd1' // Daily data for 30 days
      break
    case 'all':
      level = 'd1' // Daily data for max available range
      break
    default:
      level = 'd1' // Default to daily
  }

  // For 30d, we'll fetch more data points
  const limit = timeRange === 'all'
    ? 365
    : timeRange === '30d'
      ? 30
      : timeRange === '7d'
        ? 7
        : 24

  try {
    // Check Supabase cache first (if configured)
    if (isSupabaseConfigured()) {
      const { data: cachedData } = await supabase
        .from('token_charts')
        .select('*')
        .eq('token_ledger_id', tokenId)
        .eq('timeframe', timeRange)
        .gt('expires_at', new Date().toISOString())
        .order('cached_at', { ascending: false })
        .limit(1)

      if (cachedData && cachedData.length > 0) {
        const cached = cachedData[0]

        return new Response(
          JSON.stringify({
            success: true,
            data: cached.chart_data,
            token: tokenId,
            timeRange,
            cached: true,
            cachedAt: cached.cached_at,
            timestamp: new Date().toISOString()
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=300'
            }
          }
        )
      }
    }

    // Fetch from ICPSWAP API
    const response = await fetch(`https://api.icpswap.com/info/token/${tokenId}/chart/${level}?page=1&limit=${limit}`)

    let chartData = []

    // Handle response gracefully - new tokens might not have chart data yet
    if (response.ok) {
      const result = await response.json()

      if (result.code === 200 && result.data && result.data.content && Array.isArray(result.data.content)) {
        // Process the chart data to match our expected format
        chartData = result.data.content.map(item => ({
          time: item.snapshotTime, // Epoch MILLISECONDS for Chart.js time scale
          price: parseFloat(item.price),
          volume: parseFloat(item.volumeUSD),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          open: parseFloat(item.open),
          close: parseFloat(item.close),
          snapshotTime: item.snapshotTime, // Original timestamp in milliseconds
          timezone: 'UTC' // Explicit UTC marker
        }))
      }
    }

    // Cache in Supabase if configured
    if (isSupabaseConfigured() && supabaseAdmin) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes

      await supabaseAdmin
        .from('token_charts')
        .upsert({
          token_ledger_id: tokenId,
          timeframe: timeRange,
          chart_data: chartData,
          expires_at: expiresAt,
        }, {
          onConflict: 'token_ledger_id,timeframe'
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: chartData,
        token: tokenId,
        timeRange,
        cached: false,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=300'
        }
      }
    )
  } catch (error) {
    // Return empty data instead of error for new tokens
    return new Response(
      JSON.stringify({
        success: true,
        data: [],
        token: tokenId,
        timeRange,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=300'
        }
      }
    )
  }
}

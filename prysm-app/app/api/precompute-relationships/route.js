/**
 * Precompute Relationships Endpoint
 * Handles urgent relationship calculations for newly detected tokens
 * This is triggered automatically when new tokens are found
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { precomputePopularTokenRelationships } from '@/lib/token-relationships'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request) {
  try {
    const { urgent = false } = await request.json().catch(() => ({ urgent: false }))

    console.log(`🚀 Precompute relationships endpoint ${urgent ? '[URGENT MODE]' : '[normal mode]'}`)

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    // Get all tokens that need relationship computation
    // For urgent mode: focus on newest tokens first
    let query = supabaseAdmin
      .from('tokens')
      .select('token_ledger_id, name, symbol, price, volume_24h, liquidity, controllers, ic_id, first_seen')
      .limit(5000)

    // If urgent, prioritize newest tokens
    if (urgent) {
      query = query.order('first_seen', { ascending: false })
    } else {
      query = query.order('volume_24h', { ascending: false, nullsLast: true })
    }

    const { data: tokens, error } = await query

    if (error) {
      console.error('❌ Failed to fetch tokens:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tokens', details: error.message },
        { status: 500 }
      )
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { message: 'No tokens found to process', processed: 0 },
        { status: 200 }
      )
    }

    console.log(`📊 Fetched ${tokens.length} tokens for relationship computation`)

    // Get homepage tokens (highest ic_id) to mark as priority
    const { data: topTokens } = await supabaseAdmin
      .from('tokens')
      .select('token_ledger_id')
      .order('ic_id', { ascending: false })
      .limit(10)

    const homepageTokenIds = new Set((topTokens || []).map(t => t.token_ledger_id))

    // Precompute relationships
    await precomputePopularTokenRelationships(
      tokens,
      urgent ? 50 : 100, // Process fewer tokens for urgent mode
      homepageTokenIds
    )

    return NextResponse.json({
      success: true,
      message: urgent ? 'Urgent relationship computation complete' : 'Relationship computation complete',
      processed: tokens.length,
      urgent,
      timestamp: new Date().toISOString(),
    }, { status: 200 })

  } catch (error) {
    console.error('💥 Precompute failed:', error)
    return NextResponse.json(
      { error: 'Precompute failed', details: error.message },
      { status: 500 }
    )
  }
}
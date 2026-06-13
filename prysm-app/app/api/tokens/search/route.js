import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // Validate query
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit,
        },
      });
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const searchTerm = query.trim().toLowerCase();
    const client = supabaseAdmin || supabase;

    // Build the search query
    // Search by name, symbol, or token_ledger_id (canister ID)
    let dbQuery = client
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
      `)
      .or(
        `name.ilike.%${searchTerm}%,symbol.ilike.%${searchTerm}%,token_ledger_id.ilike.%${searchTerm}%`
      )
      .order('volume_24h', { ascending: false, nullsFirst: false })
      .limit(limit);

    const { data: tokens, error } = await dbQuery;

    if (error) {
      console.error('Supabase search error:', error);
      return NextResponse.json(
        { error: 'Failed to search tokens', details: error.message },
        { status: 500 }
      );
    }

    // Transform tokens to match the expected format
    const transformedTokens = (tokens || []).map((token) => ({
      tokenLedgerId: token.token_ledger_id,
      icId: token.ic_id,
      controllers: token.controllers || [],
      name: token.name || 'Unknown',
      symbol: token.symbol || '???',
      price: token.price || 0,
      volume24h: token.volume_24h || 0,
      priceChange24h: token.price_change_24h || 0,
      liquidity: token.liquidity || 0,
      totalSupply: token.total_supply || 0,
      marketCap: token.market_cap || 0,
      pair: token.pair || null,
      dex: token.dex || null,
      firstSeen: token.first_seen,
      lastUpdated: token.last_updated,
      createdAt: token.created_at,
      updatedAt: token.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: transformedTokens,
      pagination: {
        total: transformedTokens.length,
        limit,
      },
      meta: {
        query: searchTerm,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Token search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

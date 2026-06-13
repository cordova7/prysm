import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Fetch ALL tokens with minimal data needed for quality ranking
export async function GET(request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    console.log('📊 Fetching ALL tokens for global quality ranking...');

    // Fetch ALL tokens with only the fields needed for quality calculation
    // This is much lighter than fetching full token data
    const { data, error, count } = await supabase
      .from('tokens')
      .select('token_ledger_id, ic_id, name, symbol, volume_24h, price, market_cap, first_seen', { count: 'exact' })
      .order('ic_id', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('❌ Error fetching all tokens:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tokens', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${data.length} tokens for quality ranking`);

    // Transform to match expected format
    const transformedData = data.map(token => ({
      tokenLedgerId: token.token_ledger_id,
      icId: token.ic_id,
      name: token.name,
      symbol: token.symbol,
      volume24h: token.volume_24h,
      price: token.price,
      marketCap: token.market_cap,
      firstSeen: token.first_seen,
    }));

    return NextResponse.json(
      {
        data: transformedData,
        total: count || data.length,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          // Cache for 2 minutes since this is expensive
          'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('💥 Error in all-for-quality endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

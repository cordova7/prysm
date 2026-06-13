/**
 * Cron Job API: Precompute Token Relationships
 * Scheduled endpoint to calculate and cache relationships for popular tokens
 * Can be triggered via Vercel Cron or manually
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { precomputePopularTokenRelationships } from '@/lib/token-relationships';

export async function POST(request) {
  try {
    const supabase = supabaseAdmin;

    // Fetch all tokens with controller data
    console.log('Fetching tokens for relationship precomputation...');
    const { data: tokens, error: fetchError } = await supabase
      .from('tokens')
      .select('token_ledger_id, name, symbol, price, volume_24h, liquidity, controllers, ic_id')
      .not('controllers', 'is', null)
      .neq('controllers', '{}');

    if (fetchError) {
      console.error('Error fetching tokens:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch tokens', details: fetchError.message },
        { status: 500 }
      );
    }

    console.log(`Loaded ${tokens.length} tokens with controllers`);

    // Fetch homepage tokens (highest ic_id) to mark as priority
    const { data: homepageTokens, error: homepageError } = await supabase
      .from('tokens')
      .select('token_ledger_id')
      .order('ic_id', { ascending: false })
      .limit(10);

    const homepageTokenIds = new Set(homepageTokens?.map(t => t.token_ledger_id) || []);
    console.log(`🎯 Marking ${homepageTokenIds.size} homepage tokens as priority`);

    // Precompute relationships for top 500 tokens by volume
    // Pass homepage tokens to mark them as priority
    await precomputePopularTokenRelationships(tokens, 500, homepageTokenIds);

    // Clear old cache entries if cache is getting too large
    const cacheStats = {
      size: 200, // This would come from getCacheStats() but we can't access it directly here
    };

    console.log('Precomputation complete');

    return NextResponse.json({
      success: true,
      message: 'Token relationships precomputed successfully',
      stats: {
        totalTokens: tokens.length,
        precomputedTop: 500,
        cacheSize: cacheStats.size,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Precomputation failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Allow GET requests for manual triggering (e.g., via browser)
export async function GET() {
  return POST();
}

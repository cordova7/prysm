/**
 * API Route: Get token relationships
 * Returns connected tokens that share controllers with the specified token
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTokenRelationships } from '@/lib/token-relationships';

export async function GET(request, { params }) {
  const { tokenId } = params;
  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get('limit');
  let maxResults = 50;

  if (limitParam) {
    if (limitParam === 'all' || limitParam === '0') {
      maxResults = null;
    } else {
      const parsed = parseInt(limitParam, 10);
      maxResults = Number.isNaN(parsed) ? 50 : parsed;
    }
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Supabase not configured',
          message: 'Server-side Supabase client not available',
        },
        { status: 500 }
      );
    }

    const supabase = supabaseAdmin;

    // Fetch the target token
    const { data: targetToken, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('token_ledger_id', tokenId)
      .single();

    if (tokenError || !targetToken) {
      return NextResponse.json(
        {
          error: 'Token not found',
          tokenId,
        },
        { status: 404 }
      );
    }

    // Fetch all tokens for relationship calculation
    // For better performance, we could fetch only necessary fields
    const { data: allTokens, error: tokensError } = await supabase
      .from('tokens')
      .select('token_ledger_id, name, symbol, price, volume_24h, liquidity, controllers, ic_id');

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return NextResponse.json(
        {
          error: 'Failed to fetch token data for relationship calculation',
          details: tokensError.message,
        },
        { status: 500 }
      );
    }

    // Calculate relationships
    const relationshipData = await getTokenRelationships(targetToken, allTokens, maxResults);

    // Return success response
    return NextResponse.json(relationshipData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('API Error in relationships:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        tokenId,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  }
}

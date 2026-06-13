/**
 * Steve Jobs Smart Prefetching Endpoint
 *
 * This endpoint precomputes relationships for a batch of tokens.
 * Called by homepage on load to "warm up" the cache for instant user experience.
 *
 * NO CRON JOBS - Uses smart request triggers instead!
 * First visitor triggers precomputation, benefiting everyone.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getTokenRelationships,
  cacheTokenRelationships,
  buildControllerIndex
} from '@/lib/token-relationships';
import { populateICIdsForTokens } from '@/lib/ic-id-fetcher';

export async function GET(request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const batchRange = searchParams.get('range'); // e.g., "0-99"
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  console.log(`🚀 [PRECOMPUTE] Batch request: range=${batchRange}, limit=${limit}`);

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    // Parse batch range
    let startIndex = 0;
    let endIndex = limit;

    if (batchRange) {
      const [start, end] = batchRange.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        startIndex = start;
        endIndex = end;
      }
    }

    console.log(`📊 [PRECOMPUTE] Processing batch: ${startIndex} to ${endIndex}`);

    // Get top tokens by ic_id (sorted) - matches homepage exactly
    // Steve Jobs: Get highest ID tokens first (same as homepage)
    // This ensures precomputation cache matches what users see on landing page
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from('tokens')
      .select('token_ledger_id, name, symbol, price, volume_24h, liquidity, controllers, ic_id')
      .order('ic_id', { ascending: false, nullsLast: true });

    if (tokensError) {
      console.error('❌ [PRECOMPUTE] Error fetching tokens:', tokensError);
      return NextResponse.json(
        { error: 'Failed to fetch tokens', details: tokensError.message },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { message: 'No tokens found', processed: 0 },
        { status: 200 }
      );
    }

    console.log(`📦 [PRECOMPUTE] Found ${tokens.length} tokens with controllers`);

    // Get the batch of tokens to process
    const tokensToProcess = tokens.slice(startIndex, endIndex + 1);
    console.log(`🎯 [PRECOMPUTE] Processing ${tokensToProcess.length} tokens (index ${startIndex}-${endIndex})`);

    if (tokensToProcess.length === 0) {
      return NextResponse.json(
        { message: 'Batch out of range', processed: 0 },
        { status: 200 }
      );
    }

    // Populate IC IDs
    const tokensWithICIds = await populateICIdsForTokens(tokensToProcess);

    // Steve Jobs: Re-fetch tokens with fresh controller data before computing relationships
    // This ensures we get the latest controllers populated by background-updater
    console.log('🔄 [PRECOMPUTE] Re-fetching tokens with fresh controller data...');
    const { data: freshTokens, error: freshError } = await supabaseAdmin
      .from('tokens')
      .select('token_ledger_id, name, symbol, price, volume_24h, liquidity, controllers, ic_id')
      .in('token_ledger_id', tokensWithICIds.map(t => t.token_ledger_id || t.id));

    if (freshError) {
      console.error('❌ [PRECOMPUTE] Error fetching fresh token data:', freshError);
      // Continue with existing data if fresh fetch fails
    } else {
      console.log(`✅ [PRECOMPUTE] Got fresh data for ${freshTokens.length} tokens`);
      // Merge fresh controller data
      freshTokens.forEach(freshToken => {
        const index = tokensWithICIds.findIndex(t => (t.token_ledger_id || t.id) === freshToken.token_ledger_id);
        if (index !== -1) {
          tokensWithICIds[index].controllers = freshToken.controllers || [];
        }
      });
    }

    // Build controller index ONCE for the entire batch
    console.log('🔧 [PRECOMPUTE] Building controller index...');
    const controllerIndex = buildControllerIndex(tokensWithICIds);

    // Process all tokens in parallel for fastest caching
    // For only 10 tokens, we can process them all at once
    const results = [];
    let processedCount = 0;

    console.log(`⚡ [PRECOMPUTE] Processing ${tokensWithICIds.length} tokens in parallel`);

    // Process all tokens in parallel
    const processPromises = tokensWithICIds.map(async (token, index) => {
      try {
        const isPriority = index < 10; // First 10 tokens are homepage priority

        console.log(`🔄 [PRECOMPUTE] Processing token ${index + 1}/${tokensWithICIds.length}: ${token.name || token.token_ledger_id}`);

        const relationships = await getTokenRelationships(token, tokensWithICIds);

        // Cache to database - mark first 10 tokens as priority for instant access
        if (relationships.relationships && relationships.relationships.length > 0) {
          await cacheTokenRelationships(token.token_ledger_id || token.id, relationships.relationships, isPriority);
        }

        processedCount++;
        return {
          tokenId: token.token_ledger_id || token.id,
          tokenName: token.name,
          relationshipCount: relationships.relationships?.length || 0,
          isPriority,
          success: true
        };
      } catch (err) {
        console.error(`❌ [PRECOMPUTE] Error processing token ${token.token_ledger_id}:`, err.message);
        return {
          tokenId: token.token_ledger_id || token.id,
          tokenName: token.name,
          success: false,
          error: err.message
        };
      }
    });

    const batchResults = await Promise.all(processPromises);
    results.push(...batchResults);

    const responseTime = Date.now() - startTime;

    console.log(`✅ [PRECOMPUTE] Complete! Processed ${processedCount}/${tokensToProcess.length} tokens in ${responseTime}ms`);

    return NextResponse.json({
      success: true,
      message: `Precomputation complete`,
      stats: {
        batchRange: { start: startIndex, end: endIndex },
        totalTokensFound: tokens.length,
        tokensRequested: tokensToProcess.length,
        tokensProcessed: processedCount,
        responseTime: `${responseTime}ms`,
        averageTimePerToken: processedCount > 0 ? `${Math.round(responseTime / processedCount)}ms` : 'N/A'
      },
      results: results
    }, {
      status: 200,
      headers: {
        // Cache the response for 1 minute (long enough for batch processing)
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      }
    });

  } catch (error) {
    console.error('💥 [PRECOMPUTE] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        responseTime: Date.now() - startTime + 'ms'
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }
}

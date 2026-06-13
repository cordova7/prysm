import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache global max values for 5 minutes to reduce database load
let cachedMaxMetrics = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    // Return cached values if still fresh
    const now = Date.now();
    if (cachedMaxMetrics && now - cacheTimestamp < CACHE_TTL) {
      console.log('📊 Returning cached global max metrics');
      return NextResponse.json(
        {
          maxMetrics: cachedMaxMetrics,
          cached: true,
          cacheAge: Math.floor((now - cacheTimestamp) / 1000),
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          },
        }
      );
    }

    console.log('📊 Calculating global max metrics from database...');

    // Query for max volume_24h from database
    const { data: maxVolumeData, error: volumeError } = await supabase
      .from('tokens')
      .select('volume_24h')
      .order('volume_24h', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (volumeError) {
      console.error('❌ Error fetching max volume:', volumeError);
    }

    const maxVolume = maxVolumeData?.volume_24h || 1000000; // Default fallback

    // Use the max volume from database and reasonable estimates for other metrics
    // The important thing is consistency - using the same max values across all pages
    // This ensures a token's quality score is the same regardless of which page it's on
    const maxMetrics = {
      volume24h: Math.max(maxVolume, 1000000), // Use real max, with minimum floor
      // These estimates are based on observation of the ICP ecosystem
      // They provide consistent normalization across all pages
      icpInPool: 500000, // Top liquidity pools have ~100k-500k ICP
      stakingAmount: 10000000000000n, // ~100k tokens staked (8 decimals) is very high
      transactionCount: 5000, // 5k transactions in 24h is extremely high activity
    };

    // Cache the results
    cachedMaxMetrics = maxMetrics;
    cacheTimestamp = now;

    console.log('✅ Global max metrics calculated:', {
      volume24h: maxVolume,
      icpInPool: maxMetrics.icpInPool,
      stakingAmount: maxMetrics.stakingAmount.toString(),
      transactionCount: maxMetrics.transactionCount,
    });

    return NextResponse.json(
      {
        maxMetrics: {
          ...maxMetrics,
          stakingAmount: maxMetrics.stakingAmount.toString(), // Convert BigInt to string for JSON
        },
        cached: false,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('💥 Error calculating global max metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

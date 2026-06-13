/**
 * API route to update pool IDs for tokens in database
 * Run this once to populate pool_id column
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { batchGetPoolIds } from '@/lib/server/icpswap-pools';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Fetch all tokens that don't have pool_id yet
    const { data: tokens, error: fetchError } = await supabase
      .from('tokens')
      .select('token_ledger_id, symbol')
      .is('pool_id', null)
      .limit(100); // Process 100 at a time

    if (fetchError) {
      throw fetchError;
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tokens need pool ID updates',
        updated: 0,
      });
    }

    console.log(`Fetching pool IDs for ${tokens.length} tokens...`);

    // Fetch pool IDs in batches
    const tokenList = tokens.map((t) => ({
      ledgerId: t.token_ledger_id,
      standard: 'ICRC2', // Default to ICRC2
    }));

    const poolIds = await batchGetPoolIds(tokenList);

    // Update tokens with pool IDs
    let updateCount = 0;
    const updates = [];

    for (const [ledgerId, poolId] of poolIds.entries()) {
      if (poolId) {
        updates.push(
          supabase
            .from('tokens')
            .update({ pool_id: poolId })
            .eq('token_ledger_id', ledgerId)
        );
        updateCount++;
      }
    }

    // Execute all updates
    await Promise.all(updates);

    console.log(`✓ Updated ${updateCount} tokens with pool IDs`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updateCount} tokens with pool IDs`,
      updated: updateCount,
      total: tokens.length,
    });
  } catch (error: any) {
    console.error('Error updating pool IDs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update pool IDs',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to update pool IDs',
    usage: 'POST /api/update-pool-ids',
  });
}

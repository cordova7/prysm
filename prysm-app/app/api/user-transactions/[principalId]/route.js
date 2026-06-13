import { NextResponse } from 'next/server';
import { getUserTransactions, getUserStorageCanister } from '@/lib/icpswap-transactions';

export async function GET(request, { params }) {
  try {
    const { principalId } = params;

    if (!principalId) {
      return NextResponse.json(
        { error: 'Principal ID is required' },
        { status: 400 }
      );
    }

    // Validate principal ID format (basic check)
    // ICP principal IDs are typically 5-63 characters with dashes
    if (principalId.length < 5 || principalId.length > 70) {
      return NextResponse.json(
        { error: 'Invalid principal ID format' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const debug = searchParams.get('debug') === 'true';

    // Debug: Check if user has a storage canister
    let userStorageCanisterId = null;
    if (debug) {
      try {
        userStorageCanisterId = await getUserStorageCanister(principalId);
      } catch (e) {
        console.error('Debug - getUserStorageCanister error:', e);
      }
    }

    const result = await getUserTransactions(principalId, offset, limit);

    return NextResponse.json({
      success: true,
      principalId,
      transactions: result.transactions || [],
      totalElements: result.totalElements || 0,
      pagination: {
        offset,
        limit,
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...(debug && {
          debug: {
            userStorageCanisterId,
            hasStorageCanister: !!userStorageCanisterId,
            resultError: result.error || null,
          },
        }),
      },
    });
  } catch (error) {
    console.error('User transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user transactions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * API route to fetch the ICP pool ID for a token via SwapFactory.
 */
import { NextResponse } from 'next/server';
import { getPoolIdForToken } from '@/lib/server/icpswap-pools';

const TOKEN_STANDARDS = ['ICRC2', 'ICRC1', 'DIP20', 'EXT'];

export async function GET(_: Request, { params }: { params: { tokenId: string } }) {
  const tokenId = params.tokenId;

  if (!tokenId) {
    return NextResponse.json(
      { success: false, error: 'Missing tokenId' },
      { status: 400 }
    );
  }

  try {
    let poolId: string | null = null;
    for (const standard of TOKEN_STANDARDS) {
      poolId = await getPoolIdForToken(tokenId, standard);
      if (poolId) break;
    }

    return NextResponse.json(
      { success: true, tokenId, poolId },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Failed to fetch pool ID:', error);
    return NextResponse.json(
      { success: false, tokenId, error: error?.message || 'Failed to fetch pool ID' },
      { status: 500 }
    );
  }
}

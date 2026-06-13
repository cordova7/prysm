/**
 * ICPSwap Pool Utilities
 * Fetch pool information from ICPSwap Factory canister
 */

const ICPSWAP_FACTORY = '4mmnk-kiaaa-aaaag-qbllq-cai';
const ICP_LEDGER = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const STANDARD_FEE = 3000; // 0.3%

interface Token {
  address: string;
  standard: string;
}

interface GetPoolArgs {
  fee: number;
  token0: Token;
  token1: Token;
}

interface PoolData {
  fee: number;
  key: string;
  tickSpacing: bigint;
  token0: Token;
  token1: Token;
  canisterId: string;
}

/**
 * Fetch pool ID for a token paired with ICP
 * @param tokenLedgerId The token ledger canister ID
 * @param tokenStandard The token standard (ICRC1, ICRC2, DIP20, etc.)
 * @returns Pool canister ID or null if not found
 */
export async function getPoolIdForToken(
  tokenLedgerId: string,
  tokenStandard: string = 'ICRC2'
): Promise<string | null> {
  try {
    // Skip ICP itself
    if (tokenLedgerId === ICP_LEDGER) {
      return null;
    }

    const args: GetPoolArgs = {
      fee: STANDARD_FEE,
      token0: {
        address: ICP_LEDGER,
        standard: 'ICP',
      },
      token1: {
        address: tokenLedgerId,
        standard: tokenStandard,
      },
    };

    // Call ICPSwap Factory via HTTP API
    const response = await fetch(`https://icp-api.io/api/v1/canister/${ICPSWAP_FACTORY}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'getPool',
        args: [args],
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch pool for ${tokenLedgerId}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // Check if pool exists
    if (data?.ok && data.ok.canisterId) {
      return data.ok.canisterId;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching pool for ${tokenLedgerId}:`, error);
    return null;
  }
}

/**
 * Batch fetch pool IDs for multiple tokens
 * @param tokens Array of token ledger IDs
 * @returns Map of token ledger ID to pool canister ID
 */
export async function batchGetPoolIds(
  tokens: Array<{ ledgerId: string; standard?: string }>
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Fetch pools in parallel (max 10 at a time to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const promises = batch.map(async (token) => {
      const poolId = await getPoolIdForToken(token.ledgerId, token.standard || 'ICRC2');
      return { ledgerId: token.ledgerId, poolId };
    });

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ ledgerId, poolId }) => {
      results.set(ledgerId, poolId);
    });

    // Small delay between batches
    if (i + batchSize < tokens.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * API route to fetch real-time pool balances for a token
 * Queries ICPSwap pools and calls icrc1_balance_of on pool canisters
 */
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as ICRC1IDL } from '@/scripts/index.js';

// IC Network URL
const ICP_HOST = 'https://ic0.app';
const ICPSWAP_POOLS_API = 'https://api.icpswap.com/info/pool/all';
const MAX_POOLS = 10;

// ICP Ledger Canister ID
const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';

// Create ICP agent
function getAgent() {
  return new HttpAgent({
    host: ICP_HOST,
  });
}

// Helper function to get ICRC1 decimals for a token
async function getTokenDecimals(canisterId, agent) {
  try {
    const actor = Actor.createActor(ICRC1IDL, {
      agent,
      canisterId,
    });

    const decimals = await actor.icrc1_decimals();
    return Number(decimals);
  } catch (error) {
    // Don't log canister not found errors
    if (error.message && error.message.includes('not found')) {
      console.warn(`⚠️ Canister not found or not ICRC-1 compliant: ${canisterId}`);
    } else if (error.message && !error.message.includes('cache key')) {
      console.error(`Failed to get decimals for ${canisterId}:`, error.message);
    }
    return null; // Return null instead of defaulting
  }
}

// Helper function to get ICRC1 total supply for a token
async function getTokenTotalSupply(canisterId, agent, decimals) {
  try {
    const actor = Actor.createActor(ICRC1IDL, {
      agent,
      canisterId,
    });

    const totalSupply = await actor.icrc1_total_supply();
    const rawSupply = totalSupply.toString();
    const formattedSupply = Number(rawSupply) / Math.pow(10, decimals);

    return {
      rawSupply,
      formattedSupply,
    };
  } catch (error) {
    // Don't log canister not found errors
    if (error.message && error.message.includes('not found')) {
      console.warn(`⚠️ Canister not found or not ICRC-1 compliant: ${canisterId}`);
    } else if (error.message && !error.message.includes('cache key')) {
      console.error(`Failed to get total supply for ${canisterId}:`, error.message);
    }
    return {
      rawSupply: '0',
      formattedSupply: 0,
      error: error.message,
    };
  }
}

// Helper function to get balance of pool for a specific token
async function getPoolBalance(poolId, tokenId, agent, tokenDecimals) {
  try {
    // The pool is identified by the poolId (canister ID)
    // To get the balance, we query the token canister with the pool's account
    const actor = Actor.createActor(ICRC1IDL, {
      agent,
      canisterId: tokenId, // Query the token canister, not the pool
    });

    // Query the balance - the account is the pool's principal
    // Pool canisters have their own balances of tokens
    const balance = await actor.icrc1_balance_of({
      owner: Principal.fromText(poolId), // Convert string to Principal
      subaccount: [],
    });

    // Convert from BigInt/number to string, then format
    const rawBalance = balance.toString();
    // Use default decimals if not available
    const decimals = tokenDecimals || 8;
    const formattedBalance = Number(rawBalance) / Math.pow(10, decimals);

    return {
      rawBalance,
      formattedBalance,
    };
  } catch (error) {
    // Don't log canister not found errors
    if (error.message && error.message.includes('not found')) {
      console.warn(`⚠️ Canister not found or not ICRC-1 compliant: ${tokenId}`);
    } else if (error.message && !error.message.includes('cache key')) {
      console.error(`Failed to get balance for pool ${poolId}, token ${tokenId}:`, error.message);
    }
    return {
      rawBalance: '0',
      formattedBalance: 0,
      error: error.message,
    };
  }
}

// Fetch all pools and filter for the specific token
async function getTokenPools(tokenId) {
  try {
    console.log(`Fetching pools for token: ${tokenId}`);
    // API doesn't support tokenId filtering, so fetch all and filter
    const allPoolsResponse = await fetch(ICPSWAP_POOLS_API, {
      cache: 'no-store' // Don't cache the full response (too large)
    });
    const allPools = await allPoolsResponse.json();

    if (allPools.code !== 200) {
      throw new Error(allPools.message || 'Failed to fetch pools');
    }

    const filtered = allPools.data.filter(pool =>
      pool.token0LedgerId === tokenId || pool.token1LedgerId === tokenId
    );

    // Limit to max pools to avoid timeout
    return filtered.slice(0, MAX_POOLS);
  } catch (error) {
    console.error('Error fetching pools:', error);
    throw error;
  }
}

// Main API handler
export async function GET(request, { params }) {
  const tokenId = params.tokenId;

  try {
    console.log(`\n🔍 Fetching pool balances for token: ${tokenId}`);

    // Get the token's pools
    const pools = await getTokenPools(tokenId);

    if (!pools || pools.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        tokenId,
        pools: [],
        message: 'No pools found for this token',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
        }
      }
    );
  }

    console.log(`📊 Found ${pools.length} pools for token ${tokenId}`);

    // Create ICP agent
    const agent = getAgent();

    // Process pools in parallel with a limit to avoid overwhelming the network
    const BATCH_SIZE = 3;
    const results = [];

    for (let i = 0; i < pools.length; i += BATCH_SIZE) {
      const batch = pools.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (pool) => {
        try {
          const poolId = pool.poolId;
          const isToken0 = pool.token0LedgerId === tokenId;

          // Determine token data based on whether token is token0 or token1
          const thisToken = isToken0 ? {
            ledgerId: pool.token0LedgerId,
            symbol: pool.token0Symbol,
            name: pool.token0Name,
            decimals: await getTokenDecimals(pool.token0LedgerId, agent),
          } : {
            ledgerId: pool.token1LedgerId,
            symbol: pool.token1Symbol,
            name: pool.token1Name,
            decimals: await getTokenDecimals(pool.token1LedgerId, agent),
          };

          const otherToken = isToken0 ? {
            ledgerId: pool.token1LedgerId,
            symbol: pool.token1Symbol,
            name: pool.token1Name,
            decimals: await getTokenDecimals(pool.token1LedgerId, agent),
          } : {
            ledgerId: pool.token0LedgerId,
            symbol: pool.token0Symbol,
            name: pool.token0Name,
            decimals: await getTokenDecimals(pool.token0LedgerId, agent),
          };

          // Get pool balances for both tokens
          const [thisTokenBalance, otherTokenBalance] = await Promise.all([
            getPoolBalance(poolId, thisToken.ledgerId, agent, thisToken.decimals),
            getPoolBalance(poolId, otherToken.ledgerId, agent, otherToken.decimals),
          ]);

          // Get total supply for non-ICP tokens (only if decimals is available)
          const [thisTokenTotalSupply, otherTokenTotalSupply] = await Promise.all([
            thisToken.ledgerId === ICP_LEDGER_ID || thisToken.decimals === null
              ? { rawSupply: '0', formattedSupply: 0 }
              : getTokenTotalSupply(thisToken.ledgerId, agent, thisToken.decimals),
            otherToken.ledgerId === ICP_LEDGER_ID || otherToken.decimals === null
              ? { rawSupply: '0', formattedSupply: 0 }
              : getTokenTotalSupply(otherToken.ledgerId, agent, otherToken.decimals),
          ]);

          // Calculate percentage of supply in pool
          const thisTokenSupplyPercentage = thisTokenTotalSupply.formattedSupply > 0
            ? (thisTokenBalance.formattedBalance / thisTokenTotalSupply.formattedSupply) * 100
            : 0;

          const otherTokenSupplyPercentage = otherTokenTotalSupply.formattedSupply > 0
            ? (otherTokenBalance.formattedBalance / otherTokenTotalSupply.formattedSupply) * 100
            : 0;

          return {
            poolId,
            poolFee: pool.poolFee,
            tvlUSD: pool.tvlUSD,
            token0: {
              ledgerId: pool.token0LedgerId,
              symbol: pool.token0Symbol,
              name: pool.token0Name,
              decimals: pool.token0LedgerId === tokenId
                ? thisToken.decimals
                : otherToken.decimals,
              balance: pool.token0LedgerId === tokenId
                ? thisTokenBalance
                : otherTokenBalance,
              apiLiquidityAmount: pool.token0LiquidityAmount,
              totalSupply: pool.token0LedgerId === tokenId
                ? thisTokenTotalSupply
                : otherTokenTotalSupply,
              supplyPercentage: pool.token0LedgerId === tokenId
                ? thisTokenSupplyPercentage
                : otherTokenSupplyPercentage,
            },
            token1: {
              ledgerId: pool.token1LedgerId,
              symbol: pool.token1Symbol,
              name: pool.token1Name,
              decimals: pool.token1LedgerId === tokenId
                ? thisToken.decimals
                : otherToken.decimals,
              balance: pool.token1LedgerId === tokenId
                ? thisTokenBalance
                : otherTokenBalance,
              apiLiquidityAmount: pool.token1LiquidityAmount,
              totalSupply: pool.token1LedgerId === tokenId
                ? thisTokenTotalSupply
                : otherTokenTotalSupply,
              supplyPercentage: pool.token1LedgerId === tokenId
                ? thisTokenSupplyPercentage
                : otherTokenSupplyPercentage,
            },
            onChainData: {
              thisToken: {
                raw: thisTokenBalance.rawBalance,
                formatted: thisTokenBalance.formattedBalance,
              },
              otherToken: {
                raw: otherTokenBalance.rawBalance,
                formatted: otherTokenBalance.formattedBalance,
              },
            },
          };
        } catch (error) {
          console.error(`Error processing pool ${pool.poolId}:`, error);
          return {
            poolId: pool.poolId,
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    console.log(`✅ Processed ${results.length} pools for token ${tokenId}`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenId,
        pools: results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
        }
      }
    );

  } catch (error) {
    console.error('❌ Error in pool-balances API:', error);

    return new Response(
      JSON.stringify({
        success: false,
        tokenId,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
        }
      }
    );
  }
}

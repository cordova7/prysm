/**
 * API route to fetch token metadata including total supply
 * Queries the token canister directly using icrc1 methods
 */
import { HttpAgent, Actor } from '@dfinity/agent';
import { idlFactory as ICRC1IDL } from '@/scripts/index.js';

// IC Network URL
const ICP_HOST = 'https://ic0.app';

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

// Main API handler
export async function GET(request, { params }) {
  const tokenId = params.tokenId;

  try {
    console.log(`\n🔍 Fetching token metadata for: ${tokenId}`);

    // Create ICP agent
    const agent = getAgent();

    // Skip total supply for ICP (it's already known and very large)
    if (tokenId === ICP_LEDGER_ID) {
      return new Response(
        JSON.stringify({
          success: true,
          tokenId,
          isICP: true,
          totalSupply: null,
          decimals: 8,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          }
        }
      );
    }

    // Get decimals first, then total supply
    const decimals = await getTokenDecimals(tokenId, agent);

    // If canister is not found or not ICRC-1 compliant, return null
    if (decimals === null) {
      return new Response(
        JSON.stringify({
          success: true,
          tokenId,
          isICP: false,
          isICRC1: false,
          decimals: null,
          totalSupply: null,
          message: 'Token is not ICRC-1 compliant or canister not found',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          }
        }
      );
    }

    const totalSupply = await getTokenTotalSupply(tokenId, agent, decimals);

    console.log(`✅ Token metadata fetched for ${tokenId}`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenId,
        isICP: false,
        isICRC1: true,
        decimals,
        totalSupply,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        }
      }
    );

  } catch (error) {
    console.error('❌ Error in token-metadata API:', error);

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
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        }
      }
    );
  }
}

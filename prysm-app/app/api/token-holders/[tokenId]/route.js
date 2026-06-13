import { supabase } from '@/lib/supabase';
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as ICRC1IDL } from '@/scripts/index.js';

const ICP_HOST = 'https://ic0.app';

function getAgent() {
  return new HttpAgent({ host: ICP_HOST });
}

async function getTokenDecimals(tokenActor) {
  try {
    const decimals = await tokenActor.icrc1_decimals();
    return Number(decimals);
  } catch {
    return null;
  }
}

async function getTokenTotalSupply(tokenActor) {
  try {
    const totalSupply = await tokenActor.icrc1_total_supply();
    return BigInt(totalSupply);
  } catch {
    return null;
  }
}

async function getOnChainBalance(tokenActor, ownerPrincipal) {
  try {
    const balance = await tokenActor.icrc1_balance_of({
      owner: Principal.fromText(ownerPrincipal),
      subaccount: [],
    });
    return BigInt(balance);
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const { tokenId } = params;

  try {
    // Validate token ID
    if (!tokenId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token ID is required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // First, get the top holders from the view (which filters to most recent snapshot)
    const { data: holders, error: holdersError } = await supabase
      .from('v_token_top_holders')
      .select(`
        owner_principal,
        balance_raw,
        percent_bps,
        decimals,
        icp_balance_raw,
        cluster_id,
        cluster_label,
        cluster_color_index,
        terminal_funder_account_id,
        net_icp_lifetime,
        cost_basis_icp_raw,
        avg_entry_price,
        realized_pnl_icp_raw,
        unrealized_pnl_icp_raw
      `)
      .eq('token_canister_id', tokenId)
      .order('balance_raw', { ascending: false }) // Order by raw balance (highest first)
      .order('percent_bps', { ascending: false }) // Tie-breaker
      .limit(100); // Limit to top 100 holders

    if (holdersError) {
      console.error('Error fetching token holders:', holdersError);
      return new Response(
        JSON.stringify({
          success: false,
          error: holdersError.message
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Hydrate balances on-chain to avoid stale/zero balances from DB
    const agent = getAgent();
    const tokenActor = Actor.createActor(ICRC1IDL, {
      agent,
      canisterId: tokenId,
    });

    const [tokenDecimals, totalSupply] = await Promise.all([
      getTokenDecimals(tokenActor),
      getTokenTotalSupply(tokenActor),
    ]);

    const holderRows = Array.isArray(holders) ? holders : [];
    const BATCH_SIZE = 6;
    const hydrated = [];

    for (let i = 0; i < holderRows.length; i += BATCH_SIZE) {
      const batch = holderRows.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (holder) => {
        const balanceRaw = await getOnChainBalance(tokenActor, holder.owner_principal);
        if (balanceRaw === null || balanceRaw <= 0n) return null;

        const decimals = tokenDecimals ?? holder.decimals ?? 0;
        const divisor = decimals > 0 ? (10n ** BigInt(decimals)) : 1n;
        const balanceFormatted = (balanceRaw / divisor).toString();

        let percentage = null;
        if (totalSupply && totalSupply > 0n) {
          const bps = (balanceRaw * 10000n) / totalSupply;
          percentage = (Number(bps) / 100).toFixed(4);
        } else if (holder.percent_bps !== null && holder.percent_bps !== undefined) {
          percentage = (holder.percent_bps / 100).toFixed(4);
        }

        const icpBalance = holder.icp_balance_raw
          ? Number(holder.icp_balance_raw) / 100000000
          : null;

        return {
          ownerPrincipal: holder.owner_principal,
          balanceRaw: balanceRaw.toString(),
          balanceFormatted,
          percentage,
          decimals,
          icpBalance,
          clusterId: holder.cluster_id,
          clusterLabel: holder.cluster_label,
          clusterColorIndex: holder.cluster_color_index,
          terminalFunderAccountId: holder.terminal_funder_account_id,
          netIcpLifetime: holder.net_icp_lifetime,
          costBasisIcpRaw: holder.cost_basis_icp_raw,
          avgEntryPrice: holder.avg_entry_price,
          realizedPnlIcpRaw: holder.realized_pnl_icp_raw,
          unrealizedPnlIcpRaw: holder.unrealized_pnl_icp_raw
        };
      }));

      batchResults.forEach((item) => {
        if (item) hydrated.push(item);
      });
    }

    // Sort by on-chain balance (highest first)
    hydrated.sort((a, b) => {
      try {
        const aBal = BigInt(a.balanceRaw || '0');
        const bBal = BigInt(b.balanceRaw || '0');
        if (aBal === bBal) return 0;
        return aBal > bBal ? -1 : 1;
      } catch {
        return 0;
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: hydrated,
        count: hydrated.length,
        tokenCanisterId: tokenId
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('Unexpected error in token holders API:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

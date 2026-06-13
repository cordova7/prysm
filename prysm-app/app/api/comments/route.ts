/**
 * POST /api/comments
 * Submit new comment with verified holdings
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import { PRYSM_ROUTER_IDL, ICRC2_IDL } from '@/lib/wallet/actors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { tokenId, content, authorPrincipal } = await request.json();

    // Validate inputs
    if (!tokenId || !content || !authorPrincipal) {
      const missing = [];
      if (!tokenId) missing.push('tokenId');
      if (!content) missing.push('content');
      if (!authorPrincipal) missing.push('authorPrincipal');

      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Comment too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    // Create agent for canister calls
    const agent = new HttpAgent({
      host: process.env.NEXT_PUBLIC_IC_HOST || 'https://icp0.io',
    });

    // In production, don't fetch root key
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey().catch(() => {
        // Ignore errors - might not be local network
      });
    }

    const principal = Principal.fromText(authorPrincipal);

    // Fetch PRY balance
    let pryBalance = '0';
    try {
      const pryLedgerId = process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID;
      if (pryLedgerId) {
        const pryActor = Actor.createActor(ICRC2_IDL, {
          agent,
          canisterId: pryLedgerId,
        }) as any;

        const balance = await pryActor.icrc1_balance_of({
          owner: principal,
          subaccount: [],
        });

        pryBalance = balance.toString();
      }
    } catch (err) {
      console.error('Failed to fetch PRY balance:', err);
      // Continue with 0 balance
    }

    // Fetch stake amount and lifetime rewards
    let stakeAmount = '0';
    let feesEarned = '0';
    try {
      const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
      if (routerCanisterId) {
        const routerActor = Actor.createActor(PRYSM_ROUTER_IDL, {
          agent,
          canisterId: routerCanisterId,
        }) as any;

        const stats = await routerActor.get_user_stats(
          principal,
          Principal.fromText(tokenId)
        );

        stakeAmount = stats.staked_amount.toString();
        feesEarned = stats.lifetime_rewards.toString();
      }
    } catch (err) {
      console.error('Failed to fetch staking data:', err);
      // Continue with 0 values
    }

    // Insert comment into database
    const { data, error } = await supabase
      .from('comments')
      .insert({
        token_ledger_id: tokenId,
        author_principal: authorPrincipal,
        content: content.trim(),
        pry_balance_at_post: pryBalance,
        stake_amount_at_post: stakeAmount,
        fees_earned_at_post: feesEarned,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: data,
    });
  } catch (error) {
    console.error('Comment submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

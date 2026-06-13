/**
 * GET /api/prysm-router-test
 * Test PRYSM Router mainnet quote flow and compare vs ICPSwap pool quote.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { Principal } from '@dfinity/principal';
import { ICPSWAP_POOL_IDL, PRYSM_ROUTER_IDL, ICRC2_IDL } from '@/lib/wallet/actors';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_ROUTER_CANISTER_ID =
  process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID ||
  'hgr77-aaaaa-aaaam-afqya-cai';
const DEFAULT_POOL_ID = 'ybilh-nqaaa-aaaag-qkhzq-cai';
const DEFAULT_AMOUNT_IN = '100000000';
const DEFAULT_AMOUNT_OUT_MINIMUM = '0';
const DEFAULT_TOKEN_IN = 'ryjl3-tyaaa-aaaaa-aaaba-cai'; // ICP
const DEFAULT_TOKEN_OUT = '7pail-xaaaa-aaaas-aabmq-cai';

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return fallback;
}

function safeBigInt(value: string, field: string) {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid ${field}. Expected integer string, got: ${value}`);
  }
}

function parseHumanAmount(value: string, decimals: number, field: string) {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals for ${field}`);
  }
  const raw = value.trim();
  if (raw.length === 0) {
    throw new Error(`Invalid ${field}. Empty value.`);
  }
  if (raw.includes('e') || raw.includes('E')) {
    throw new Error(`Invalid ${field}. Scientific notation not supported.`);
  }
  const parts = raw.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid ${field}. Too many decimal points.`);
  }
  const intPart = parts[0] === '' ? '0' : parts[0];
  const fracPart = parts[1] ?? '';
  if (!/^\d+$/.test(intPart) || (fracPart && !/^\d+$/.test(fracPart))) {
    throw new Error(`Invalid ${field}. Must be numeric.`);
  }
  if (fracPart.length > decimals) {
    throw new Error(`Invalid ${field}. Too many decimal places.`);
  }
  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${intPart}${paddedFrac}`.replace(/^0+/, '') || '0';
  return BigInt(combined);
}

function loadPemIdentity(): Secp256k1KeyIdentity {
  const pemPath = join(process.cwd(), 'identity.pem');
  const pemText = readFileSync(pemPath, 'utf8');
  return Secp256k1KeyIdentity.fromPem(pemText);
}

function unwrapVariant<T extends Record<string, unknown>>(value: T) {
  if ('Ok' in value) return { ok: value.Ok as any, err: null };
  if ('ok' in value) return { ok: (value as any).ok, err: null };
  if ('Err' in value) return { ok: null, err: value.Err as any };
  if ('err' in value) return { ok: null, err: (value as any).err };
  return { ok: null, err: value };
}

function formatBigInt(value: bigint | null | undefined) {
  return typeof value === 'bigint' ? value.toString() : null;
}

function sanitizeBigInt(value: any): any {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => sanitizeBigInt(item));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, val]) => [
      key,
      sanitizeBigInt(val),
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}

function computeDelta(a: bigint, b: bigint) {
  if (a === 0n) {
    return { diff: (a - b).toString(), diff_bps: null };
  }
  const diff = a - b;
  const diffBps = (diff * 10000n) / a;
  return { diff: diff.toString(), diff_bps: diffBps.toString() };
}

async function resolveZeroForOne(
  poolActor: any,
  tokenIn: string,
  tokenOut: string,
  provided?: boolean
) {
  if (typeof provided === 'boolean') return provided;

  const metaRaw = await poolActor.metadata();
  const meta = unwrapVariant(metaRaw);
  if (!meta.ok) {
    throw new Error('Unable to resolve pool metadata for zeroForOne.');
  }

  const token0 = meta.ok.token0?.address;
  const token1 = meta.ok.token1?.address;

  if (!token0 || !token1) {
    throw new Error('Pool metadata missing token0/token1 addresses.');
  }

  if (tokenIn === token0 && tokenOut === token1) return true;
  if (tokenIn === token1 && tokenOut === token0) return false;

  throw new Error('tokenIn/tokenOut do not match pool token0/token1.');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const routerCanisterId =
      searchParams.get('routerCanisterId') || DEFAULT_ROUTER_CANISTER_ID;
    const poolId = searchParams.get('poolId') || DEFAULT_POOL_ID;
    const amountInParam = searchParams.get('amountIn') || DEFAULT_AMOUNT_IN;
    const amountOutMinimumParam =
      searchParams.get('amountOutMinimum') || DEFAULT_AMOUNT_OUT_MINIMUM;
    const zeroForOne = parseBoolean(searchParams.get('zeroForOne'), false);
    const includePoolMeta = parseBoolean(searchParams.get('includePoolMeta'), true);
    const includeIcpswapQuote = parseBoolean(
      searchParams.get('includeIcpswapQuote'),
      true
    );

    const amountIn = safeBigInt(amountInParam, 'amountIn');

    const host = process.env.NEXT_PUBLIC_IC_HOST || 'https://icp0.io';
    const agent = new HttpAgent({ host });

    if (String(process.env.NODE_ENV) !== 'production') {
      await agent.fetchRootKey().catch(() => {
        // Ignore if running against mainnet without local replica.
      });
    }

    const routerActor = Actor.createActor(PRYSM_ROUTER_IDL, {
      agent,
      canisterId: routerCanisterId,
    }) as any;

    const poolActor = Actor.createActor(ICPSWAP_POOL_IDL, {
      agent,
      canisterId: poolId,
    }) as any;

    const routerQuoteRaw = await routerActor.get_quote({
      pool_id: Principal.fromText(poolId),
      zero_for_one: zeroForOne,
      amount_in: amountIn,
    });

    const routerQuote = unwrapVariant(routerQuoteRaw);

    let icpswapQuote = null;
    if (includeIcpswapQuote) {
      const icpswapQuoteRaw = await poolActor.quote({
        amountIn: amountInParam,
        zeroForOne,
        amountOutMinimum: amountOutMinimumParam,
      });
      icpswapQuote = unwrapVariant(icpswapQuoteRaw);
    }

    let poolMeta = null;
    if (includePoolMeta) {
      const metaRaw = await poolActor.metadata();
      poolMeta = unwrapVariant(metaRaw);
    }

    const routerAmountOut =
      routerQuote.ok && typeof routerQuote.ok.amount_out === 'bigint'
        ? routerQuote.ok.amount_out
        : null;
    const icpswapAmountOut =
      icpswapQuote?.ok && typeof icpswapQuote.ok === 'bigint'
        ? icpswapQuote.ok
        : null;

    const comparison =
      routerAmountOut !== null && icpswapAmountOut !== null
        ? computeDelta(icpswapAmountOut, routerAmountOut)
        : null;

    const payload = sanitizeBigInt({
      timestamp: new Date().toISOString(),
      routerCanisterId,
      poolId,
      host,
      inputs: {
        zeroForOne,
        amountIn: amountInParam,
        amountOutMinimum: amountOutMinimumParam,
      },
      routerQuote: {
        ok: routerQuote.ok
          ? {
              amount_out: formatBigInt(routerQuote.ok.amount_out),
              price_impact:
                routerQuote.ok.price_impact && routerQuote.ok.price_impact.length > 0
                  ? routerQuote.ok.price_impact[0]
                  : null,
            }
          : null,
        err: routerQuote.err || null,
      },
      icpswapQuote: icpswapQuote
        ? {
            ok: formatBigInt(icpswapAmountOut),
            err: icpswapQuote.err || null,
          }
        : null,
      poolMeta: poolMeta
        ? {
            ok: poolMeta.ok || null,
            err: poolMeta.err || null,
          }
        : null,
      comparison,
    });

    console.log('[PRYSM-ROUTER-TEST] Result', payload);

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PRYSM-ROUTER-TEST] Error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Swap execution disabled in production.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      action,
      routerCanisterId = DEFAULT_ROUTER_CANISTER_ID,
      poolId = DEFAULT_POOL_ID,
      tokenIn = DEFAULT_TOKEN_IN,
      tokenOut = DEFAULT_TOKEN_OUT,
      amountIn = DEFAULT_AMOUNT_IN,
      amountOutMinimum = DEFAULT_AMOUNT_OUT_MINIMUM,
      zeroForOne,
      fee,
      useHuman,
    } = body || {};

    if (!tokenIn || !tokenOut) {
      return NextResponse.json(
        { error: 'tokenIn and tokenOut are required' },
        { status: 400 }
      );
    }

    let amountInBig = safeBigInt(String(amountIn), 'amountIn');
    let amountOutMinBig = safeBigInt(String(amountOutMinimum), 'amountOutMinimum');

    const identity = loadPemIdentity();
    const host = process.env.NEXT_PUBLIC_IC_HOST || 'https://icp0.io';
    const agent = new HttpAgent({ host, identity });

    if (String(process.env.NODE_ENV) !== 'production') {
      await agent.fetchRootKey().catch(() => {
        // Ignore if running against mainnet without local replica.
      });
    }

    const routerActor = Actor.createActor(PRYSM_ROUTER_IDL, {
      agent,
      canisterId: routerCanisterId,
    }) as any;

    const poolActor = Actor.createActor(ICPSWAP_POOL_IDL, {
      agent,
      canisterId: poolId,
    }) as any;

    if (useHuman) {
      const tokenActor = Actor.createActor(ICRC2_IDL, {
        agent,
        canisterId: tokenIn,
      }) as any;
      const decimals = Number(await tokenActor.icrc1_decimals());
      amountInBig = parseHumanAmount(String(amountIn), decimals, 'amountIn');
      amountOutMinBig = parseHumanAmount(
        String(amountOutMinimum),
        decimals,
        'amountOutMinimum'
      );
    }

    if (action === 'whoami') {
      const whoamiPayload = {
        timestamp: new Date().toISOString(),
        action: 'whoami',
        principal: identity.getPrincipal().toText(),
      };
      console.log('[PRYSM-ROUTER-TEST] Identity', whoamiPayload);
      return NextResponse.json(whoamiPayload, { status: 200 });
    }

    if (action === 'balance') {
      const tokenActor = Actor.createActor(ICRC2_IDL, {
        agent,
        canisterId: tokenIn,
      }) as any;

      const ownerText =
        typeof body?.owner === 'string' && body.owner.length > 0
          ? body.owner
          : identity.getPrincipal().toText();

      const balanceRaw = await tokenActor.icrc1_balance_of({
        owner: Principal.fromText(ownerText),
        subaccount: [],
      });

      const balancePayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'balance',
        tokenId: tokenIn,
        principal: ownerText,
        balance: balanceRaw,
      });

      console.log('[PRYSM-ROUTER-TEST] Balance', balancePayload);
      return NextResponse.json(balancePayload, { status: 200 });
    }

    if (action === 'allowance') {
      const tokenActor = Actor.createActor(ICRC2_IDL, {
        agent,
        canisterId: tokenIn,
      }) as any;

      const allowanceRaw = await tokenActor.icrc2_allowance({
        account: {
          owner: identity.getPrincipal(),
          subaccount: [],
        },
        spender: {
          owner: Principal.fromText(routerCanisterId),
          subaccount: [],
        },
      });

      const allowancePayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'allowance',
        tokenId: tokenIn,
        principal: identity.getPrincipal().toText(),
        spender: routerCanisterId,
        allowance: allowanceRaw,
      });

      console.log('[PRYSM-ROUTER-TEST] Allowance', allowancePayload);
      return NextResponse.json(allowancePayload, { status: 200 });
    }

    if (action === 'fee') {
      const tokenActor = Actor.createActor(ICRC2_IDL, {
        agent,
        canisterId: tokenIn,
      }) as any;

      const feeRaw = await tokenActor.icrc1_fee();
      const feePayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'fee',
        tokenId: tokenIn,
        fee: feeRaw,
      });

      console.log('[PRYSM-ROUTER-TEST] Fee', feePayload);
      return NextResponse.json(feePayload, { status: 200 });
    }

    if (action === 'pendingRefund') {
      const routerActor = Actor.createActor(PRYSM_ROUTER_IDL, {
        agent,
        canisterId: routerCanisterId,
      }) as any;

      const pending = await routerActor.get_pending_refund(
        Principal.fromText(tokenIn)
      );

      const pendingPayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'pendingRefund',
        tokenId: tokenIn,
        pending,
      });

      console.log('[PRYSM-ROUTER-TEST] Pending Refund', pendingPayload);
      return NextResponse.json(pendingPayload, { status: 200 });
    }

    if (action === 'withdrawPending') {
      const routerActor = Actor.createActor(PRYSM_ROUTER_IDL, {
        agent,
        canisterId: routerCanisterId,
      }) as any;

      const result = await routerActor.withdraw_pending_refund(
        Principal.fromText(tokenIn)
      );

      const pendingPayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'withdrawPending',
        tokenId: tokenIn,
        result,
      });

      console.log('[PRYSM-ROUTER-TEST] Withdraw Pending', pendingPayload);
      return NextResponse.json(pendingPayload, { status: 200 });
    }

    if (action === 'withdrawFromRouter') {
      const routerActor = Actor.createActor(PRYSM_ROUTER_IDL, {
        agent,
        canisterId: routerCanisterId,
      }) as any;

      const result = await routerActor.withdraw_from_router(
        Principal.fromText(tokenIn),
        amountInBig
      );

      const withdrawPayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'withdrawFromRouter',
        tokenId: tokenIn,
        amount: amountInBig.toString(),
        result,
      });

      console.log('[PRYSM-ROUTER-TEST] Withdraw From Router', withdrawPayload);
      return NextResponse.json(withdrawPayload, { status: 200 });
    }

    if (action === 'approve') {
      const tokenActor = Actor.createActor(ICRC2_IDL, {
        agent,
        canisterId: tokenIn,
      }) as any;

      const tokenLedgerFee =
        fee !== undefined ? safeBigInt(String(fee), 'fee') : null;
      const includeFeeInAllowance = parseBoolean(
        body?.includeFeeInAllowance ?? null,
        true
      );
      const effectiveFee =
        tokenLedgerFee === null ? await tokenActor.icrc1_fee() : tokenLedgerFee;
      const approveAmount = includeFeeInAllowance
        ? amountInBig + BigInt(effectiveFee.toString())
        : amountInBig;

      const approveRaw = await tokenActor.icrc2_approve({
        from_subaccount: [],
        spender: {
          owner: Principal.fromText(routerCanisterId),
          subaccount: [],
        },
        amount: approveAmount,
        expected_allowance: [],
        expires_at: [],
        fee: tokenLedgerFee === null ? [] : [tokenLedgerFee],
        memo: [],
        created_at_time: [],
      });

      const approveResult = unwrapVariant(approveRaw);

      const approvePayload = sanitizeBigInt({
        timestamp: new Date().toISOString(),
        action: 'approve',
        tokenId: tokenIn,
        routerCanisterId,
        amount: String(amountIn),
        approvedAllowance: approveAmount.toString(),
        fee: tokenLedgerFee === null ? null : tokenLedgerFee.toString(),
        includeFeeInAllowance,
        result: {
          ok: formatBigInt(approveResult.ok),
          err: approveResult.err || null,
        },
      });

      console.log('[PRYSM-ROUTER-TEST] Approve Result', approvePayload);
      return NextResponse.json(approvePayload, { status: 200 });
    }

    const resolvedZeroForOne = await resolveZeroForOne(
      poolActor,
      tokenIn,
      tokenOut,
      typeof zeroForOne === 'boolean' ? zeroForOne : undefined
    );

    const swapRaw = await routerActor.swap({
      token_in: Principal.fromText(tokenIn),
      token_out: Principal.fromText(tokenOut),
      amount_in: amountInBig,
      amount_out_minimum: amountOutMinBig,
      pool_id: Principal.fromText(poolId),
      zero_for_one: resolvedZeroForOne,
    });

    const swapResult = unwrapVariant(swapRaw);

    const payload = sanitizeBigInt({
      timestamp: new Date().toISOString(),
      routerCanisterId,
      poolId,
      host,
      inputs: {
        tokenIn,
        tokenOut,
        zeroForOne: resolvedZeroForOne,
        amountIn: String(amountIn),
        amountOutMinimum: String(amountOutMinimum),
      },
      swap: {
        ok: swapResult.ok
          ? {
              amount_out: formatBigInt(swapResult.ok.amount_out),
              fee_amount: formatBigInt(swapResult.ok.fee_amount),
              token_in: swapResult.ok.token_in?.toString?.() ?? null,
              token_out: swapResult.ok.token_out?.toString?.() ?? null,
            }
          : null,
        err: swapResult.err || null,
      },
    });

    console.log('[PRYSM-ROUTER-TEST] Swap Result', payload);

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PRYSM-ROUTER-TEST] Swap Error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

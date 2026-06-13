export const dynamic = 'force-dynamic'
export const revalidate = 0

const ICPSWAP_POOLS_API = 'https://api.icpswap.com/info/pool/all'
const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai'

let cachedPools = null
let cachedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const getPools = async () => {
  const now = Date.now()
  if (cachedPools && now - cachedAt < CACHE_TTL_MS) return cachedPools

  const response = await fetch(ICPSWAP_POOLS_API, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Pool list fetch failed: ${response.status} ${response.statusText}`)
  }
  const result = await response.json()
  if (result?.code !== 200 || !Array.isArray(result?.data)) {
    throw new Error(result?.message || 'Invalid pool list response')
  }

  cachedPools = result.data
  cachedAt = now
  return cachedPools
}

const computeBestIcpPoolMap = (pools, tokenIds) => {
  const want = new Set(tokenIds)
  const best = {}

  for (const tokenId of tokenIds) {
    best[tokenId] = { icpInPool: 0, tokenInPool: 0, poolId: null }
  }

  for (const pool of pools) {
    const token0 = pool?.token0LedgerId
    const token1 = pool?.token1LedgerId

    if (token0 === ICP_LEDGER_ID && want.has(token1)) {
      const icpAmount = toNumber(pool?.token0LiquidityAmount)
      const tokenAmount = toNumber(pool?.token1LiquidityAmount)
      const current = best[token1]
      best[token1] = {
        icpInPool: (current?.icpInPool || 0) + icpAmount,
        tokenInPool: (current?.tokenInPool || 0) + tokenAmount,
        poolId: current?.poolId || pool?.poolId || null,
      }
    } else if (token1 === ICP_LEDGER_ID && want.has(token0)) {
      const icpAmount = toNumber(pool?.token1LiquidityAmount)
      const tokenAmount = toNumber(pool?.token0LiquidityAmount)
      const current = best[token0]
      best[token0] = {
        icpInPool: (current?.icpInPool || 0) + icpAmount,
        tokenInPool: (current?.tokenInPool || 0) + tokenAmount,
        poolId: current?.poolId || pool?.poolId || null,
      }
    }
  }

  return best
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const tokenIds = Array.isArray(body?.tokenIds) ? body.tokenIds.filter(Boolean) : []

    if (tokenIds.length === 0) {
      return new Response(JSON.stringify({ success: true, data: {}, timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const pools = await getPools()
    const data = computeBestIcpPoolMap(pools, tokenIds)

    return new Response(JSON.stringify({ success: true, data, timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to compute ICP pool liquidity',
        data: {},
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

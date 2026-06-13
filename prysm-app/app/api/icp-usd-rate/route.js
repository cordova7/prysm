export const dynamic = 'force-dynamic'
export const revalidate = 0

let cached = null
let cachedAt = 0
const CACHE_TTL_MS = 60 * 1000

const parseRateResponse = (result) => {
  const points = result?.icp_usd_rate
  if (!Array.isArray(points) || points.length === 0) return null
  const [timestampSec, rateStr] = points[0] || []
  const rate = Number(rateStr)
  const timestamp = Number(timestampSec)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return {
    rate,
    asOf: Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp * 1000).toISOString()
      : new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const now = Date.now()
    if (cached && now - cachedAt < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ success: true, ...cached, cached: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://ic-api.internetcomputer.org/api/v3/icp-usd-rate', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`ICP rate fetch failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const parsed = parseRateResponse(result)
    if (!parsed) {
      throw new Error('ICP rate response invalid')
    }

    cached = { ...parsed, fetchedAt: new Date().toISOString() }
    cachedAt = now

    return new Response(JSON.stringify({ success: true, ...cached, cached: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to fetch ICP rate',
        rate: null,
        asOf: null,
        fetchedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}


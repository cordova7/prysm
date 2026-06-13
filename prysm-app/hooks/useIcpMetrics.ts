import { useQuery } from '@tanstack/react-query'

export const ICP_USD_RATE_QUERY_KEY = ['icp', 'usd-rate']
export const ICP_POOL_LIQUIDITY_QUERY_KEY = (tokenIds: string[]) => ['icp', 'pool-liquidity', tokenIds]

export function useIcpUsdRate() {
  return useQuery({
    queryKey: ICP_USD_RATE_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/icp-usd-rate')
      if (!response.ok) throw new Error('Failed to fetch ICP/USD rate')
      const result = await response.json()
      if (!result?.success || !Number.isFinite(Number(result?.rate))) {
        throw new Error(result?.error || 'ICP/USD rate unavailable')
      }
      return {
        rate: Number(result.rate),
        asOf: result.asOf as string | null,
      }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useIcpPoolLiquidity(tokenIds: string[]) {
  const ids = (tokenIds || []).filter(Boolean)

  return useQuery({
    queryKey: ICP_POOL_LIQUIDITY_QUERY_KEY(ids),
    queryFn: async () => {
      const response = await fetch('/api/icp-pool-liquidity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds: ids }),
      })
      if (!response.ok) throw new Error('Failed to fetch ICP pool liquidity')
      const result = await response.json()
      if (!result?.success || typeof result?.data !== 'object' || result?.data === null) {
        throw new Error(result?.error || 'ICP pool liquidity unavailable')
      }
      return result.data as Record<string, { icpInPool: number; tokenInPool: number; poolId: string | null }>
    },
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

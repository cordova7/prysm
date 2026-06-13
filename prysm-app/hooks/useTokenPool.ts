/**
 * Hook to fetch the primary pool ID for a token
 */
import { useState, useEffect } from 'react';

interface PoolData {
  poolId: string;
  token0Symbol: string;
  token1Symbol: string;
  tvlUSD: number;
  token0?: { ledgerId?: string };
  token1?: { ledgerId?: string };
}

export function useTokenPool(tokenId: string | undefined, preferredCounterTokenId?: string) {
  const [poolId, setPoolId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tokenId) {
      setPoolId(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    const counterId = preferredCounterTokenId?.trim();

    const fetchPoolFromFactory = async (): Promise<string | null> => {
      const response = await fetch(`/api/pool-id/${tokenId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data?.poolId || null;
    };

    const fetchPoolFromInfo = async (): Promise<string | null> => {
      const response = await fetch(`/api/pool-balances/${tokenId}`);
      const data = await response.json();

      if (data.success && data.pools && data.pools.length > 0) {
        const validPools = data.pools.filter((p: any) => !p.error && p.poolId);
        const matchingPools = counterId
          ? validPools.filter((p: PoolData) =>
              p.token0?.ledgerId === counterId || p.token1?.ledgerId === counterId
            )
          : [];

        if (counterId && matchingPools.length === 0) {
          return null;
        }

        const candidates = matchingPools.length > 0 ? matchingPools : validPools;
        // Get the pool with highest TVL (most liquid) among candidates.
        const bestPool = candidates.sort((a: any, b: any) => (b.tvlUSD || 0) - (a.tvlUSD || 0))[0];
        return bestPool?.poolId || null;
      }

      return null;
    };

    (async () => {
      try {
        if (counterId) {
          const factoryPoolId = await fetchPoolFromFactory();
          if (factoryPoolId) {
            if (mounted) setPoolId(factoryPoolId);
            return;
          }
        }

        const infoPoolId = await fetchPoolFromInfo();
        if (mounted) setPoolId(infoPoolId);
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to fetch pool:', err);
        setError(err as Error);
        setPoolId(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tokenId, preferredCounterTokenId]);

  return { poolId, isLoading, error };
}

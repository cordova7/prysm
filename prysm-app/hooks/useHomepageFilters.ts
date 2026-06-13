'use client';

import { useState, useEffect, useMemo } from 'react';
import { Principal } from '@dfinity/principal';
import { PRYSM_ROUTER_IDL } from '@/lib/wallet/actors';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { getTokenTransactions } from '@/lib/icpswap-transactions';
import { useIcpPoolLiquidity } from '@/hooks/useIcpMetrics';

export type FilterType = 'newest' | 'quality' | 'volume' | 'icpPool';

interface QualityMetrics {
  volume24h: number;
  icpInPool: number;
  stakingAmount: bigint;
  transactionCount: number;
}

interface TokenWithMetrics {
  token: any;
  metrics: QualityMetrics;
  qualityScore: number;
}

// In-memory caches for staking data (module-scoped)
const stakedCache = new Map<string, bigint>();
const stakedPending = new Map<string, Promise<bigint>>();
const stakedQueue: Array<() => Promise<void>> = [];
let stakedInFlight = 0;
const MAX_CONCURRENT_STAKED = 20;

// In-memory caches for transaction data (module-scoped)
const transactionCountCache = new Map<string, { count: number; timestamp: number }>();
const transactionQueue: Array<() => Promise<void>> = [];
let transactionInFlight = 0;
const MAX_CONCURRENT_TRANSACTIONS = 15;
const TRANSACTION_COUNT_CACHE_TTL = 60 * 1000; // 1 minute

// Queue management for staking data
const runStakedQueue = () => {
  while (stakedInFlight < MAX_CONCURRENT_STAKED && stakedQueue.length > 0) {
    const job = stakedQueue.shift();
    if (!job) return;
    stakedInFlight += 1;
    job()
      .catch(() => {})
      .finally(() => {
        stakedInFlight -= 1;
        runStakedQueue();
      });
  }
};

const enqueueStakedFetch = (tokenId: string): Promise<bigint> =>
  new Promise((resolve) => {
    stakedQueue.push(async () => {
      const result = await fetchStakedTotal(tokenId);
      resolve(result);
    });
    runStakedQueue();
  });

const fetchStakedTotal = async (tokenId: string): Promise<bigint> => {
  if (!tokenId) return 0n;
  if (stakedCache.has(tokenId)) return stakedCache.get(tokenId)!;
  if (stakedPending.has(tokenId)) return stakedPending.get(tokenId)!;

  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
  if (!routerCanisterId) {
    stakedCache.set(tokenId, 0n);
    return 0n;
  }

  const request = (async () => {
    try {
      const actor = getAnonymousActor(routerCanisterId, PRYSM_ROUTER_IDL) as any;
      const result = await actor.get_token_bucket(Principal.fromText(tokenId));
      const total = result?.length ? result[0].total_staked : 0n;
      stakedCache.set(tokenId, total);
      return total;
    } catch (error) {
      console.error(`Failed to fetch staking data for ${tokenId}:`, error);
      stakedCache.set(tokenId, 0n);
      return 0n;
    } finally {
      stakedPending.delete(tokenId);
    }
  })();

  stakedPending.set(tokenId, request);
  return request;
};

// Queue management for transaction data
const runTransactionQueue = () => {
  while (transactionInFlight < MAX_CONCURRENT_TRANSACTIONS && transactionQueue.length > 0) {
    const job = transactionQueue.shift();
    if (!job) return;
    transactionInFlight += 1;
    job()
      .catch(() => {})
      .finally(() => {
        transactionInFlight -= 1;
        runTransactionQueue();
      });
  }
};

const enqueueTransactionFetch = (tokenId: string): Promise<number> =>
  new Promise((resolve) => {
    transactionQueue.push(async () => {
      const result = await fetch24hTransactionCount(tokenId);
      resolve(result);
    });
    runTransactionQueue();
  });

const fetch24hTransactionCount = async (tokenId: string): Promise<number> => {
  if (!tokenId) return 0;

  // Check cache first
  const now = Date.now();
  const cached = transactionCountCache.get(tokenId);
  if (cached && now - cached.timestamp < TRANSACTION_COUNT_CACHE_TTL) {
    return cached.count;
  }

  try {
    // Fetch last 100 transactions to ensure 24h coverage
    const transactions = await getTokenTransactions(tokenId, 0, 100);

    // Calculate 24h threshold
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Filter transactions by timestamp
    // Note: ICP timestamps can be in nanoseconds or milliseconds
    const recentTx = transactions.filter((tx: any) => {
      const txTime = Number(tx.timestamp);
      // If timestamp is in nanoseconds (> 1e15), convert to ms
      const txTimeMs = txTime > 1e15 ? txTime / 1e6 : txTime;
      return txTimeMs >= oneDayAgo;
    });

    const count = recentTx.length;
    transactionCountCache.set(tokenId, { count, timestamp: now });
    return count;
  } catch (error) {
    console.error(`Failed to fetch 24h transaction count for ${tokenId}:`, error);
    // Cache 0 on error to avoid repeated failures
    transactionCountCache.set(tokenId, { count: 0, timestamp: now });
    return 0;
  }
};

// Normalization using log scale
function normalizeLogScale(value: number, maxValue: number): number {
  if (!value || value <= 0 || !maxValue || maxValue <= 0) return 0;
  return Math.log10(value + 1) / Math.log10(maxValue + 1);
}

// Quality score calculation
function calculateQualityScore(metrics: QualityMetrics, maxMetrics: QualityMetrics): number {
  const staking = Number(metrics.stakingAmount) / 1e8; // Convert 8-decimal bigint
  const maxStaking = Number(maxMetrics.stakingAmount) / 1e8;

  const normVolume = normalizeLogScale(metrics.volume24h, maxMetrics.volume24h);
  const normLiquidity = normalizeLogScale(metrics.icpInPool, maxMetrics.icpInPool);
  const normStaking = normalizeLogScale(staking, maxStaking);

  return normVolume * 0.4 + normLiquidity * 0.3 + normStaking * 0.3;
}

export function useHomepageFilters(
  tokens: any[],
  activeFilter: FilterType,
  icpThreshold: number = 10,
  useGlobalRanking: boolean = false
) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [tokensWithMetrics, setTokensWithMetrics] = useState<TokenWithMetrics[]>([]);
  const [globalMaxMetrics, setGlobalMaxMetrics] = useState<QualityMetrics | null>(null);
  const [allTokens, setAllTokens] = useState<any[]>([]);

  // Get ICP pool liquidity for all tokens
  const tokenIds = useMemo(() => {
    // For global ranking, fetch ICP data for all tokens
    const tokensToUse = useGlobalRanking && activeFilter === 'quality' && allTokens.length > 0
      ? allTokens
      : tokens;
    return tokensToUse.map((token) => token?.tokenLedgerId).filter(Boolean);
  }, [tokens, useGlobalRanking, activeFilter, allTokens]);

  const { data: icpPoolMap } = useIcpPoolLiquidity(tokenIds);

  // Fetch ALL tokens when using global ranking OR when using icpPool filter (always global)
  useEffect(() => {
    // icpPool filter always uses global ranking
    const needsAllTokens =
      activeFilter === 'icpPool' ||
      (useGlobalRanking && (activeFilter === 'quality' || activeFilter === 'volume'));

    if (!needsAllTokens) {
      setAllTokens([]);
      return;
    }

    const fetchAllTokens = async () => {
      try {
        console.log('🌍 Fetching all tokens for global ranking...');
        const response = await fetch('/api/tokens/all-for-quality');
        if (!response.ok) {
          throw new Error('Failed to fetch all tokens');
        }
        const data = await response.json();
        console.log(`✅ Loaded ${data.data.length} tokens for global ranking`);
        setAllTokens(data.data);
      } catch (err) {
        console.error('Failed to fetch all tokens:', err);
        setAllTokens([]);
      }
    };

    fetchAllTokens();
  }, [activeFilter, useGlobalRanking]);

  // Fetch global max metrics for quality score normalization
  useEffect(() => {
    if (activeFilter !== 'quality') return;

    const fetchGlobalMaxMetrics = async () => {
      try {
        const response = await fetch('/api/tokens/global-max-metrics');
        if (!response.ok) {
          throw new Error('Failed to fetch global max metrics');
        }
        const data = await response.json();

        setGlobalMaxMetrics({
          volume24h: data.maxMetrics.volume24h,
          icpInPool: data.maxMetrics.icpInPool,
          stakingAmount: BigInt(data.maxMetrics.stakingAmount),
          transactionCount: data.maxMetrics.transactionCount,
        });
      } catch (err) {
        console.error('Failed to fetch global max metrics:', err);
        // Use fallback values if fetch fails
        setGlobalMaxMetrics({
          volume24h: 1000000,
          icpInPool: 1000000,
          stakingAmount: 100000000000000n,
          transactionCount: 10000,
        });
      }
    };

    fetchGlobalMaxMetrics();
  }, [activeFilter]);

  // Fetch staking and transaction data when Quality filter is active
  useEffect(() => {
    if (!tokens || tokens.length === 0) {
      setTokensWithMetrics([]);
      return;
    }

    // For filters that don't need additional data, skip fetching
    if (activeFilter !== 'quality') {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
      return;
    }

    // For quality filter, wait for global max metrics to be loaded
    if (!globalMaxMetrics) {
      return;
    }

    // For global ranking, wait for all tokens to be loaded
    if (useGlobalRanking && allTokens.length === 0) {
      return;
    }

    const fetchMetrics = async () => {
      setIsLoading(true);
      setError(null);

      // Use allTokens for global ranking, or current page tokens for page ranking
      const tokensToAnalyze = useGlobalRanking && activeFilter === 'quality' ? allTokens : tokens;
      setProgress({ current: 0, total: tokensToAnalyze.length });

      try {
        // Fetch staking and transaction data for ALL tokens in parallel
        const allPromises = tokensToAnalyze.map(async (token, index) => {
          const tokenId = token?.tokenLedgerId;

          if (!tokenId) {
            return {
              token,
              metrics: {
                volume24h: 0,
                icpInPool: 0,
                stakingAmount: 0n,
                transactionCount: 0,
              },
              qualityScore: 0,
            };
          }

          // Fetch staking data (queued)
          const stakingPromise = enqueueStakedFetch(tokenId);

          // Fetch transaction count (queued)
          const transactionPromise = enqueueTransactionFetch(tokenId);

          // Get ICP pool data (already fetched via hook)
          const icpInPool = icpPoolMap?.[tokenId]?.icpInPool ?? 0;
          const volume24h = Number(token?.volume24h || 0);

          // Wait for queued fetches
          const [stakingAmount, transactionCount] = await Promise.all([
            stakingPromise,
            transactionPromise,
          ]);

          const metrics: QualityMetrics = {
            volume24h,
            icpInPool,
            stakingAmount,
            transactionCount,
          };

          return {
            token,
            metrics,
            qualityScore: 0, // Will be calculated later
          };
        });

        // Add batched progress tracking
        let completed = 0;
        let progressUpdateTimer = Date.now();
        const PROGRESS_UPDATE_INTERVAL = 200; // 200ms

        const results = await Promise.all(
          allPromises.map(async (promise) => {
            const result = await promise;
            completed++;

            // Batch progress updates (every 10 tokens or 200ms)
            if (
              completed % 10 === 0 ||
              completed === tokensToAnalyze.length ||
              Date.now() - progressUpdateTimer > PROGRESS_UPDATE_INTERVAL
            ) {
              setProgress({ current: completed, total: tokensToAnalyze.length });
              progressUpdateTimer = Date.now();
            }

            return result;
          })
        );

        // Calculate quality scores if needed
        if (activeFilter === 'quality' && globalMaxMetrics) {
          // Use global max values for normalization (consistent across all pages)
          results.forEach((item) => {
            item.qualityScore = calculateQualityScore(item.metrics, globalMaxMetrics);
          });
        }

        setTokensWithMetrics(results);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        setError('Failed to fetch token metrics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [tokens, activeFilter, icpPoolMap, globalMaxMetrics, useGlobalRanking, allTokens]);

  // Apply filtering and sorting
  const filteredTokens = useMemo(() => {
    if (!tokens || tokens.length === 0) return [];

    // Determine which tokens to use (global or page)
    const tokensToUse =
      activeFilter === 'icpPool'
        ? allTokens.length > 0
          ? allTokens
          : tokens // icpPool always uses all tokens
        : useGlobalRanking && allTokens.length > 0
        ? allTokens
        : tokens;

    if (activeFilter === 'newest') {
      return [...tokens]; // Keep original order (newest first) - use page tokens only
    }

    if (activeFilter === 'volume') {
      return [...tokensToUse].sort((a, b) => {
        const aVol = Number(a?.volume24h || 0);
        const bVol = Number(b?.volume24h || 0);
        return bVol - aVol;
      });
    }

    if (activeFilter === 'icpPool') {
      // Always uses all tokens (global)
      return [...tokensToUse].sort((a, b) => {
        const aIcp = icpPoolMap?.[a?.tokenLedgerId]?.icpInPool ?? 0;
        const bIcp = icpPoolMap?.[b?.tokenLedgerId]?.icpInPool ?? 0;
        return bIcp - aIcp;
      });
    }

    // For quality filter that needs fetched metrics
    if (tokensWithMetrics.length === 0) {
      return tokens; // Return original while loading
    }

    if (activeFilter === 'quality') {
      // Filter by ICP threshold and sort by quality score
      const filtered = tokensWithMetrics.filter(
        (item) => item.metrics.icpInPool >= icpThreshold
      );

      return filtered
        .sort((a, b) => b.qualityScore - a.qualityScore)
        .map((item) => item.token);
    }

    return tokens;
  }, [tokens, activeFilter, icpThreshold, icpPoolMap, tokensWithMetrics, useGlobalRanking, allTokens]);

  return {
    filteredTokens,
    isLoading,
    progress,
    error,
  };
}

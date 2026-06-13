'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Portal from './Portal';
import TokenCard from './TokenCard';
import { useTokenLogo } from '@/hooks/useTokenLogo';
import { useIcpPoolLiquidity } from '@/hooks/useIcpMetrics';
import { useWallet } from '@/contexts/WalletContext';
import { Principal } from '@dfinity/principal';
import { PRYSM_ROUTER_IDL } from '@/lib/wallet/actors';
import { getAnonymousActor } from '@/lib/wallet/anonymous';

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeToken = (token) => {
  if (!token) return null;

  const tokenLedgerId =
    token.tokenLedgerId ||
    token.token_ledger_id ||
    token.tokenId ||
    token.ledgerId ||
    token.id ||
    '';

  return {
    ...token,
    tokenLedgerId,
    icId: token.icId ?? token.ic_id ?? null,
    name: token.name ?? token.tokenName ?? token.token_name ?? '',
    symbol: token.symbol ?? token.tokenSymbol ?? token.token_symbol ?? '',
    price: toNumber(token.price ?? token.priceUSD ?? token.price_usd),
    volume24h: toNumber(token.volume24h ?? token.volume_24h ?? token.volumeUSD24H),
    priceChange24h: toNumber(token.priceChange24h ?? token.price_change_24h ?? token.priceChange24H),
    liquidity: toNumber(token.liquidity ?? token.tvlUSD ?? token.tvl_usd),
    totalSupply: toNumber(token.totalSupply ?? token.total_supply ?? token.supply),
    marketCap: toNumber(token.marketCap ?? token.market_cap ?? token.marketCapUSD ?? token.market_cap_usd),
    firstSeen: token.firstSeen ?? token.first_seen ?? '',
    lastUpdated: token.lastUpdated ?? token.last_updated ?? '',
    createdAt: token.createdAt ?? token.created_at ?? '',
    updatedAt: token.updatedAt ?? token.updated_at ?? '',
    controllers: Array.isArray(token.controllers) ? token.controllers : [],
  };
};

const formatPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  if (num === 0) return '0.00';
  if (num < 0.000001) return num.toFixed(12);
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 100) return num.toFixed(2);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCompact = (value) => {
  if (!value || value <= 0 || Number.isNaN(Number(value))) return '--';
  const absValue = Math.abs(Number(value));
  if (absValue >= 1e12) return `${(absValue / 1e12).toFixed(2)}T`;
  if (absValue >= 1e9) return `${(absValue / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `${(absValue / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `${(absValue / 1e3).toFixed(2)}K`;
  return absValue.toFixed(2);
};

const formatIcp = (value) => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '--';
  if (num === 0) return '0';
  if (num < 0.001) return num.toFixed(6);
  if (num < 1) return num.toFixed(3);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const SPARKLINE_POINTS = 64;
const sparklineCache = new Map();
const sparklinePending = new Map();
const sparklineQueue = [];
let sparklineInFlight = 0;
const MAX_CONCURRENT_SPARKLINES = 12;

const supplyCache = new Map();
const supplyPending = new Map();
const supplyQueue = [];
let supplyInFlight = 0;
const MAX_CONCURRENT_SUPPLY = 6;

const stakedCache = new Map();
const stakedPending = new Map();
const stakedQueue = [];
let stakedInFlight = 0;
const MAX_CONCURRENT_STAKED = 10;

const userStakeCache = new Map();
const userStakePending = new Map();
const userStakeQueue = [];
let userStakeInFlight = 0;
const MAX_CONCURRENT_USER_STAKE = 6;

const sampleSeries = (series, maxPoints) => {
  if (series.length <= maxPoints) return series;
  const step = (series.length - 1) / (maxPoints - 1);
  const sampled = [];
  for (let i = 0; i < maxPoints; i += 1) {
    sampled.push(series[Math.round(i * step)]);
  }
  return sampled;
};

const extractPrices = (result) => {
  const raw = Array.isArray(result?.data) ? result.data : [];

  const points = raw
    .map((item) => ({
      t: Number(item?.snapshotTime ?? item?.time ?? item?.timestamp ?? item?.x ?? 0),
      p: Number(item?.price ?? item?.close ?? item?.y ?? 0),
    }))
    .filter((item) => Number.isFinite(item.p) && Number.isFinite(item.t) && item.t > 0);

  points.sort((a, b) => a.t - b.t);
  return points.map((item) => item.p);
};

const computeChangePct = (series) => {
  if (!series || series.length < 2) return null;
  const first = Number(series[0]);
  const last = Number(series[series.length - 1]);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / first) * 100;
};

const runSparklineQueue = () => {
  while (sparklineInFlight < MAX_CONCURRENT_SPARKLINES && sparklineQueue.length > 0) {
    const job = sparklineQueue.shift();
    if (!job) return;
    sparklineInFlight += 1;
    job()
      .catch(() => {})
      .finally(() => {
        sparklineInFlight -= 1;
        runSparklineQueue();
      });
  }
};

const runSupplyQueue = () => {
  while (supplyInFlight < MAX_CONCURRENT_SUPPLY && supplyQueue.length > 0) {
    const job = supplyQueue.shift();
    if (!job) return;
    supplyInFlight += 1;
    job()
      .catch(() => {})
      .finally(() => {
        supplyInFlight -= 1;
        runSupplyQueue();
      });
  }
};

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

const runUserStakeQueue = () => {
  while (userStakeInFlight < MAX_CONCURRENT_USER_STAKE && userStakeQueue.length > 0) {
    const job = userStakeQueue.shift();
    if (!job) return;
    userStakeInFlight += 1;
    job()
      .catch(() => {})
      .finally(() => {
        userStakeInFlight -= 1;
        runUserStakeQueue();
      });
  }
};

const enqueueSparklineFetch = (tokenId) => new Promise((resolve) => {
  sparklineQueue.push(async () => {
    const result = await fetchSparkline(tokenId);
    resolve(result);
  });
  runSparklineQueue();
});

const enqueueSupplyFetch = (tokenId) => new Promise((resolve) => {
  supplyQueue.push(async () => {
    const result = await fetchSupply(tokenId);
    resolve(result);
  });
  runSupplyQueue();
});

const enqueueStakedFetch = (tokenId) => new Promise((resolve) => {
  stakedQueue.push(async () => {
    const result = await fetchStakedTotal(tokenId);
    resolve(result);
  });
  runStakedQueue();
});

const enqueueUserStakeFetch = (tokenId, principalText) => new Promise((resolve) => {
  userStakeQueue.push(async () => {
    const result = await fetchUserStake(tokenId, principalText);
    resolve(result);
  });
  runUserStakeQueue();
});

const fetchSparkline = async (tokenId) => {
  if (!tokenId) return { series: [], changePct: null };
  if (sparklineCache.has(tokenId)) return sparklineCache.get(tokenId);
  if (sparklinePending.has(tokenId)) return sparklinePending.get(tokenId);

  const request = fetch(`/api/chart/${tokenId}?timeRange=24h`)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Chart fetch failed'))))
    .then(async (result) => {
      let prices = extractPrices(result);

      if (prices.length < 2) {
        const responseAll = await fetch(`/api/chart/${tokenId}?timeRange=all`);
        if (responseAll.ok) {
          const resultAll = await responseAll.json();
          prices = extractPrices(resultAll);
        }
      }

      const sampled = sampleSeries(prices, SPARKLINE_POINTS);
      const changePct = computeChangePct(prices);
      const payload = { series: sampled, changePct };
      sparklineCache.set(tokenId, payload);
      return payload;
    })
    .catch(() => {
      const payload = { series: [], changePct: null };
      sparklineCache.set(tokenId, payload);
      return payload;
    })
    .finally(() => {
      sparklinePending.delete(tokenId);
    });

  sparklinePending.set(tokenId, request);
  return request;
};

const extractSupply = (result) => {
  const supply = result?.totalSupply?.formattedSupply ?? result?.totalSupply ?? null;
  const num = Number(supply);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const fetchSupply = async (tokenId) => {
  if (!tokenId) return null;
  if (supplyCache.has(tokenId)) return supplyCache.get(tokenId);
  if (supplyPending.has(tokenId)) return supplyPending.get(tokenId);

  const request = fetch(`/api/token-metadata/${tokenId}`)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Supply fetch failed'))))
    .then((result) => {
      const supply = extractSupply(result);
      supplyCache.set(tokenId, supply);
      return supply;
    })
    .catch(() => {
      supplyCache.set(tokenId, null);
      return null;
    })
    .finally(() => {
      supplyPending.delete(tokenId);
    });

  supplyPending.set(tokenId, request);
  return request;
};

const fetchStakedTotal = async (tokenId) => {
  if (!tokenId) return 0n;
  if (stakedCache.has(tokenId)) return stakedCache.get(tokenId);
  if (stakedPending.has(tokenId)) return stakedPending.get(tokenId);

  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
  if (!routerCanisterId) {
    stakedCache.set(tokenId, 0n);
    return 0n;
  }

  const request = (async () => {
    try {
      const actor = getAnonymousActor(routerCanisterId, PRYSM_ROUTER_IDL);
      const result = await actor.get_token_bucket(Principal.fromText(tokenId));
      const total = result?.length ? result[0].total_staked : 0n;
      stakedCache.set(tokenId, total);
      return total;
    } catch {
      stakedCache.set(tokenId, 0n);
      return 0n;
    } finally {
      stakedPending.delete(tokenId);
    }
  })();

  stakedPending.set(tokenId, request);
  return request;
};

const fetchUserStake = async (tokenId, principalText) => {
  if (!tokenId || !principalText) return null;
  const cacheKey = `${principalText}:${tokenId}`;
  if (userStakeCache.has(cacheKey)) return userStakeCache.get(cacheKey);
  if (userStakePending.has(cacheKey)) return userStakePending.get(cacheKey);

  const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
  if (!routerCanisterId) {
    userStakeCache.set(cacheKey, null);
    return null;
  }

  const request = (async () => {
    try {
      const actor = getAnonymousActor(routerCanisterId, PRYSM_ROUTER_IDL);
      const stats = await actor.get_user_stats(
        Principal.fromText(principalText),
        Principal.fromText(tokenId)
      );
      userStakeCache.set(cacheKey, stats);
      return stats;
    } catch {
      userStakeCache.set(cacheKey, null);
      return null;
    } finally {
      userStakePending.delete(cacheKey);
    }
  })();

  userStakePending.set(cacheKey, request);
  return request;
};

const getMarketCap = (token) => {
  const raw = token?.marketCap ?? token?.market_cap ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const getPriceChange = (token) => {
  const raw = token?.priceChange24h ?? token?.price_change_24h ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const getPrice = (token) => {
  const raw = token?.price ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const getTotalSupply = (token) => {
  const raw = token?.totalSupply ?? token?.total_supply ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

function useSparklineData(tokenId) {
  const [data, setData] = useState(() => sparklineCache.get(tokenId) || null);

  useEffect(() => {
    if (!tokenId) return undefined;
    let mounted = true;

    if (sparklineCache.has(tokenId)) {
      setData(sparklineCache.get(tokenId));
      return undefined;
    }

    enqueueSparklineFetch(tokenId).then((result) => {
      if (mounted) {
        setData(result);
      }
    });

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  return data;
}

function useTokenSupply(tokenId, fallbackSupply) {
  const [supply, setSupply] = useState(() => {
    const fallbackNum = Number(fallbackSupply);
    if (Number.isFinite(fallbackNum) && fallbackNum > 0) return fallbackNum;
    if (supplyCache.has(tokenId)) return supplyCache.get(tokenId);
    return null;
  });

  useEffect(() => {
    const fallbackNum = Number(fallbackSupply);
    if (Number.isFinite(fallbackNum) && fallbackNum > 0) {
      setSupply(fallbackNum);
      return;
    }
    if (!tokenId) return undefined;
    let mounted = true;

    if (supplyCache.has(tokenId)) {
      setSupply(supplyCache.get(tokenId));
      return undefined;
    }

    enqueueSupplyFetch(tokenId).then((result) => {
      if (mounted) setSupply(result);
    });

    return () => {
      mounted = false;
    };
  }, [tokenId, fallbackSupply]);

  return supply;
}

function useTokenStakedTotal(tokenId) {
  const [total, setTotal] = useState(() => stakedCache.get(tokenId) || 0n);

  useEffect(() => {
    if (!tokenId) return undefined;
    let mounted = true;

    if (stakedCache.has(tokenId)) {
      setTotal(stakedCache.get(tokenId));
      return undefined;
    }

    enqueueStakedFetch(tokenId).then((result) => {
      if (mounted) {
        setTotal(result);
      }
    });

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  return total;
}

function useUserStakeStats(tokenId, principalText) {
  const [stats, setStats] = useState(() => {
    if (!principalText) return null;
    const cacheKey = `${principalText}:${tokenId}`;
    return userStakeCache.get(cacheKey) || null;
  });

  useEffect(() => {
    if (!tokenId || !principalText) return undefined;
    let mounted = true;
    const cacheKey = `${principalText}:${tokenId}`;

    if (userStakeCache.has(cacheKey)) {
      setStats(userStakeCache.get(cacheKey));
      return undefined;
    }

    enqueueUserStakeFetch(tokenId, principalText).then((result) => {
      if (mounted) {
        setStats(result);
      }
    });

    return () => {
      mounted = false;
    };
  }, [tokenId, principalText]);

  return stats;
}

function TokenSparkline({ series, stroke, gradientId }) {
  const { linePath, areaPath } = useMemo(() => {
    if (!series || series.length < 2) {
      return { linePath: '', areaPath: '' };
    }

    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const count = series.length;
    const denom = count > 1 ? count - 1 : 1;
    const topPad = 2;
    const height = 28;

    const points = series.map((value, index) => {
      const x = (index / denom) * 100;
      const y = topPad + (1 - (value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const line = `M ${points.join(' L ')}`;
    const area = `${line} L 100 32 L 0 32 Z`;
    return { linePath: line, areaPath: area };
  }, [series]);

  return (
    <div className="h-6 w-full">
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {linePath ? (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
            <path
              d={linePath}
              fill="none"
              stroke={stroke}
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <line x1="0" y1="16" x2="100" y2="16" stroke="#374151" strokeWidth="1" />
        )}
      </svg>
    </div>
  );
}

function TokenTile({ token, icpInPool, onSelect }) {
  const { isConnected, principal } = useWallet();
  const fallbackChange = getPriceChange(token);
  const price = getPrice(token);
  const totalSupply = useTokenSupply(token.tokenLedgerId, getTotalSupply(token));

  const computedMarketCapUsd = useMemo(() => {
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) return null;
    if (!Number.isFinite(Number(totalSupply)) || Number(totalSupply) <= 0) return null;
    return Number(price) * Number(totalSupply);
  }, [price, totalSupply]);

  const marketCapValue = computedMarketCapUsd ?? getMarketCap(token);
  const marketCap = formatCompact(marketCapValue);
  const icpInPoolFormatted = formatIcp(icpInPool);
  const icpSizeClass = icpInPoolFormatted.length > 9 ? 'text-[9px]' : 'text-[10px]';
  const { logo } = useTokenLogo(token.tokenLedgerId);
  const [logoError, setLogoError] = useState(false);
  const seededSparkline = useMemo(() => {
    if (!Array.isArray(token?.chartData) || token.chartData.length < 2) {
      return null;
    }
    return {
      series: sampleSeries(token.chartData, SPARKLINE_POINTS),
      changePct: computeChangePct(token.chartData),
    };
  }, [token?.chartData]);

  const sparklineData = useSparklineData(token.tokenLedgerId);
  const series = seededSparkline?.series || sparklineData?.series || [];
  const movement = seededSparkline?.changePct ?? fallbackChange;
  const stroke = movement >= 0 ? '#34D399' : '#F87171';
  const gradientId = useMemo(() => `sparkline-${token.tokenLedgerId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [token.tokenLedgerId]);
  const formattedPrice = formatPrice(price);
  const priceSizeClass = formattedPrice.length > 14 ? 'text-xs' : formattedPrice.length > 11 ? 'text-sm' : 'text-base';
  const totalStaked = useTokenStakedTotal(token.tokenLedgerId);
  const principalText = principal?.toText();
  const userStats = useUserStakeStats(token.tokenLedgerId, isConnected ? principalText : null);

  const formatPryShort = (amount) => {
    if (!amount || amount <= 0n) return '0';
    const divisor = 100000000n;
    const whole = amount / divisor;
    const fractional = amount % divisor;
    if (whole >= 1000000n) {
      const short = Number(whole / 1000000n);
      return `${short}M`;
    }
    if (whole >= 1000n) {
      const short = Number(whole / 1000n);
      return `${short}K`;
    }
    if (fractional === 0n) return whole.toString();
    const fractionalStr = fractional.toString().padStart(8, '0').slice(0, 2);
    return `${whole.toString()}.${fractionalStr}`;
  };

  const userStaked = userStats?.staked_amount ?? 0n;
  const pendingRewards = userStats?.pending_rewards ?? 0n;
  const lifetimeRewards = userStats?.lifetime_rewards ?? 0n;
  const earnedTotal = pendingRewards + lifetimeRewards;
  const showUserStake = isConnected && userStaked > 0n && totalStaked > 0n;
  const userStakePercent = showUserStake
    ? Number((userStaked * 10000n) / totalStaked) / 100
    : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tile-3)]/40 p-2 text-left transition-all duration-200 hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-tile-3)]/60"
    >
      <div className="group/pry absolute right-1.5 top-1.5 flex flex-col items-end gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/80 px-1 py-0.5">
        <div className="flex items-center gap-1">
          <img src="/favicon-32x32.png" alt="PRY" className="h-2.5 w-2.5" />
          <span className="text-[8px] text-[var(--color-text-secondary)]">{formatPryShort(totalStaked)}</span>
        </div>
        {showUserStake && (
          <div className="flex items-center gap-1 text-[8px] text-[var(--color-text-muted)]">
            <img src="/favicon-32x32.png" alt="PRY" className="h-2 w-2" />
            <span>{formatPryShort(userStaked)}</span>
          </div>
        )}
        {showUserStake && earnedTotal > 0n && (
          <div className="text-[8px] text-[var(--color-text-muted)]">
            +{formatPryShort(earnedTotal)}
          </div>
        )}
        <div className="pointer-events-none absolute right-0 top-full mt-2 hidden w-60 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-[10px] text-[var(--color-text-secondary)] shadow-lg group-hover/pry:block">
          Total PRY staked on this token. Rewards accrue from the 1% swap fee and are distributed based on stake share.
        </div>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {logo && !logoError ? (
            <img
              src={logo}
              alt={token.symbol || 'Token'}
              className="h-4 w-4 rounded object-cover flex-shrink-0"
              onError={() => setLogoError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-4 w-4 items-center justify-center rounded bg-[var(--color-bg-card)] text-[9px] text-[var(--color-text)] flex-shrink-0">
              {token.symbol?.charAt(0) || 'T'}
            </div>
          )}
          <span className="text-xs font-medium text-[var(--color-text)] truncate">
            {token.symbol || 'TOKEN'}
          </span>
        </div>
      </div>

      <div className={`mt-1 font-light text-[var(--color-text)] tabular-nums truncate ${formattedPrice.length > 14 ? 'text-[10px]' : formattedPrice.length > 11 ? 'text-xs' : 'text-sm'}`}>
        ${formattedPrice}
      </div>

      <div className="relative mt-1 h-5">
        <TokenSparkline series={series} stroke={stroke} gradientId={gradientId} />
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-1 min-w-0">
        <span className="flex items-baseline gap-1">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            24h
          </span>
          <span
            className={`text-[9px] font-medium ${
              movement >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {movement >= 0 ? '+' : '-'}
            {Math.abs(movement).toFixed(2)}%
          </span>
        </span>
        <span className="flex flex-col items-end leading-tight min-w-0">
          <span className={`flex items-center gap-0.5 text-[var(--color-text-secondary)] tabular-nums truncate max-w-[80px] ${icpInPoolFormatted.length > 8 ? 'text-[8px]' : 'text-[9px]'}`}>
            <img
              src="/icp-logo.png"
              alt="ICP"
              className="h-2.5 w-2.5 rounded-sm object-contain flex-shrink-0"
              loading="lazy"
            />
            <span className="truncate">{icpInPoolFormatted}</span>
          </span>
          <span className="text-[9px] text-[var(--color-text-secondary)] whitespace-nowrap truncate max-w-[80px]">
            MC ${marketCap}
          </span>
        </span>
      </div>
    </button>
  );
}

function TokenDetailOverlay({ token, onClose }) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!token) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [token, handleClose]);

  useEffect(() => {
    if (!token) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [token]);

  return (
    <Portal>
      <AnimatePresence>
        {token && (
            <motion.div
              className="fixed inset-0 z-modal flex items-stretch justify-center rounded-[28px] bg-[var(--color-bg)]/80 p-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="h-full w-full max-w-7xl rounded-[28px] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-tile-2)] shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col"
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-end border-b border-[var(--color-border)] px-6 py-3">
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-10 py-4 sm:py-8">
                <div className="grid grid-cols-12 gap-4 sm:gap-8">
                  <div className="col-span-12">
                    <div className="w-full">
                      <TokenCard token={token} defaultExpanded allowCollapse={false} layout="terminal" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export default function TokenTileGrid({ tokens }) {
  const [selectedToken, setSelectedToken] = useState(null);

  const tokenList = useMemo(() => (tokens || []).map(normalizeToken).filter(Boolean), [tokens]);
  const tokenIds = useMemo(
    () => tokenList.map((token) => token?.tokenLedgerId).filter(Boolean),
    [tokenList]
  );

  const { data: icpPoolMap } = useIcpPoolLiquidity(tokenIds);

  useEffect(() => {
    if (!tokenList.length || typeof window === 'undefined') return;

    const primeIds = tokenList.slice(0, 12).map((token) => token?.tokenLedgerId).filter(Boolean);

    tokenList.slice(0, 12).forEach((token) => {
      const tokenId = token?.tokenLedgerId;
      if (!tokenId || !Array.isArray(token?.chartData) || sparklineCache.has(tokenId)) {
        return;
      }

      const sampled = sampleSeries(token.chartData, SPARKLINE_POINTS);
      const changePct = computeChangePct(token.chartData);
      sparklineCache.set(tokenId, { series: sampled, changePct });
    });

    primeIds.forEach((tokenId) => {
      enqueueSparklineFetch(tokenId);
    });

    const chartIds = primeIds.slice(0, 6);
    chartIds.forEach((tokenId) => {
      const cacheKey = `chart_${tokenId}_24h`;
      if (sessionStorage.getItem(cacheKey)) return;
      fetch(`/api/chart/${tokenId}?timeRange=24h`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(data));
            } catch {
              // Ignore quota/private-mode failures
            }
          }
        })
        .catch(() => {
          // Best-effort prefetch
        });
    });
  }, [tokenList]);

  const handleSelect = useCallback((token) => {
    setSelectedToken(token);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedToken(null);
  }, []);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {tokenList.map((token) => (
          <TokenTile
            key={token.id || token.tokenLedgerId}
            token={token}
            icpInPool={icpPoolMap?.[token?.tokenLedgerId]?.icpInPool}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <TokenDetailOverlay token={selectedToken} onClose={handleClose} />
    </>
  );
}

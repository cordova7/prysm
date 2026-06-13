import { useEffect, useState } from 'react';

// Shared hook to fetch token total supply (cached + metadata fallback)
export const useTokenTotalSupply = (tokenId) => {
  const [totalSupply, setTotalSupply] = useState(null);
  const [loading, setLoading] = useState(false);

  const extractSupply = (result) => {
    const supply = result?.totalSupply?.formattedSupply ?? result?.totalSupply ?? null;
    const num = Number(supply);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  useEffect(() => {
    if (!tokenId) return;

    let mounted = true;
    setLoading(true);
    const cacheKey = `token_supply_${tokenId}`;
    const cacheTtlMs = 5 * 60 * 1000;

    // Skip ICP
    const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
    if (tokenId === ICP_LEDGER_ID) {
      setTotalSupply(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < cacheTtlMs) {
            setTotalSupply(extractSupply(parsed));
            setLoading(false);
            return () => {
              mounted = false;
            };
          }
        }
      } catch {
        // Ignore cache failures
      }
    }

    fetch(`/api/token-metadata/${tokenId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data.success) {
          const supply = extractSupply(data);
          setTotalSupply(supply);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({ totalSupply: supply, timestamp: Date.now() })
              );
            } catch {
              // Ignore cache failures
            }
          }
        } else {
          setTotalSupply(null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setTotalSupply(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  return { totalSupply, loading };
};

export default useTokenTotalSupply;

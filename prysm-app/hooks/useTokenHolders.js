import { useState, useEffect } from 'react';

export const useTokenHolders = (tokenId) => {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tokenId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    
    // Try to get data from session storage cache first
    const cacheKey = `token_holders_${tokenId}`;
    const cacheTtlMs = 5 * 60 * 1000; // 5 minutes

    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < cacheTtlMs) {
            setHolders(parsed.data || []);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        // Ignore cache failures
      }
    }

    const fetchHolders = async () => {
      try {
        const response = await fetch(`/api/token-holders/${tokenId}`);
        const result = await response.json();

        if (!mounted) return;

        if (result.success) {
          // Process the data to format balances properly
          const processedHolders = result.data.map(holder => {
            let balanceFormatted = holder.balanceRaw;
            if (holder.decimals && parseInt(holder.decimals) > 0) {
              try {
                const divisor = Math.pow(10, parseInt(holder.decimals));
                balanceFormatted = (BigInt(holder.balanceRaw) / BigInt(divisor)).toString();
              } catch (e) {
                // Fallback to raw value if BigInt conversion fails
                balanceFormatted = holder.balanceRaw;
              }
            }

            return {
              ...holder,
              balanceFormatted
            };
          });

          setHolders(processedHolders || []);

          // Cache the result
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({
                  data: processedHolders || [],
                  timestamp: Date.now()
                })
              );
            } catch (error) {
              // Ignore cache failures
            }
          }
        } else {
          setError(result.error || 'Failed to fetch token holders');
          setHolders([]);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching token holders:', err);
        setError(err.message);
        setHolders([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchHolders();

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  return { holders, loading, error };
};
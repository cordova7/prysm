import { useState, useEffect } from 'react';

// Check if we're on the client side to prevent SSR issues
const isClient = typeof window !== 'undefined';
const isBrowserAPIAvailable = isClient && typeof window !== 'undefined' && typeof window.fetch !== 'undefined';

interface UseTokenLogoResult {
  logo: string | null;
  isLoading: boolean;
  error: Error | null;
}

// Global cache for logos
const logoCache: Record<string, string | null> = {};
const failedCache = new Set<string>();
const pendingRequests = new Map<string, Promise<string | null>>();
const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const ICP_LOGO_PATH = '/icp-logo.png';
const LOGO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readLogoFromStorage(canisterId: string): string | null {
  if (!isBrowserAPIAvailable) return null;
  try {
    const cached = sessionStorage.getItem(`token_logo_${canisterId}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed || !parsed.logo || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > LOGO_CACHE_TTL_MS) {
      sessionStorage.removeItem(`token_logo_${canisterId}`);
      return null;
    }
    return parsed.logo;
  } catch (error) {
    return null;
  }
}

function writeLogoToStorage(canisterId: string, logo: string | null) {
  if (!isBrowserAPIAvailable || !logo) return;
  // Avoid filling sessionStorage with large data URIs (common cause of quota errors).
  // Keep fast in-memory cache, but only persist reasonably sized values.
  if (logo.startsWith('data:') && logo.length > 50_000) return;
  try {
    sessionStorage.setItem(
      `token_logo_${canisterId}`,
      JSON.stringify({ logo, timestamp: Date.now() })
    );
  } catch (error) {
    // Ignore storage failures
  }
}

async function fetchTokenLogo(canisterId: string): Promise<string | null> {
  // Only run on client side to prevent SSR/SES issues
  if (!isBrowserAPIAvailable) {
    return null;
  }

  if (canisterId === ICP_LEDGER_ID) {
    logoCache[canisterId] = ICP_LOGO_PATH;
    return ICP_LOGO_PATH;
  }

  // Check cache first
  if (logoCache[canisterId]) {
    return logoCache[canisterId];
  }

  // Check if already failed
  if (failedCache.has(canisterId)) {
    return null;
  }

  // Check if request is already pending (deduplication)
  if (pendingRequests.has(canisterId)) {
    return pendingRequests.get(canisterId)!;
  }

  // Create new request with timeout and retry logic
  const request = (async () => {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const response = await fetch(`/api/token-logo/${canisterId}`);
        if (!response.ok) {
          throw new Error(`Logo API failed: ${response.status}`);
        }

        const result = await response.json();
        const logoValue = result?.logo || null;

        if (logoValue && logoValue.trim()) {
          logoCache[canisterId] = logoValue;
          writeLogoToStorage(canisterId, logoValue);
          return logoValue;
        }

        // No logo found
        failedCache.add(canisterId);
        return null;
      } catch (err) {
        retries++;
        if (retries > maxRetries) {
          // Cache failure to avoid repeated attempts
          failedCache.add(canisterId);
          console.error(`Failed to fetch logo for ${canisterId} after ${maxRetries} retries:`, err);
          return null;
        }

        // Exponential backoff
        const backoffTime = Math.min(500 * Math.pow(2, retries), 2000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    return null;
  })();

  pendingRequests.set(canisterId, request);
  return request;
}

export function useTokenLogo(canisterId: string): UseTokenLogoResult {
  const [logo, setLogo] = useState<string | null>(() => logoCache[canisterId] || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!canisterId || !isBrowserAPIAvailable) return;

    if (canisterId === ICP_LEDGER_ID) {
      logoCache[canisterId] = ICP_LOGO_PATH;
      setLogo(ICP_LOGO_PATH);
      return;
    }

    // Return cached result immediately
    if (logoCache[canisterId]) {
      setLogo(logoCache[canisterId]);
      return;
    }

    const storageLogo = readLogoFromStorage(canisterId);
    if (storageLogo) {
      logoCache[canisterId] = storageLogo;
      setLogo(storageLogo);
      return;
    }

    // Skip if previously failed
    if (failedCache.has(canisterId)) {
      return;
    }

    setIsLoading(true);

    fetchTokenLogo(canisterId)
      .then((logoUrl) => {
        setLogo(logoUrl);
        setError(null);
      })
      .catch((err) => {
        setError(err as Error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [canisterId]);

  return { logo, isLoading, error };
}

// Preload logos for multiple tokens (for initial page load)
export async function preloadTokenLogos(canisterIds: string[]): Promise<void> {
  if (!isBrowserAPIAvailable) return;

  const promises = canisterIds.map((id) => fetchTokenLogo(id));
  await Promise.allSettled(promises);
}

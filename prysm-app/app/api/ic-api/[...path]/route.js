/**
 * IC API Proxy Route
 * Proxies requests to the Internet Computer API to avoid CORS issues
 * Includes caching and rate limiting
 */

const IC_API_BASE = 'https://ic-api.internetcomputer.org/api/v3';

// Simple in-memory cache (note: will reset on cold starts)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting tracking
const rateLimitMap = new Map();

/**
 * Simple rate limiter - allows 100 requests per minute per IP
 */
function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  if (!rateLimitMap.has(clientIp)) {
    rateLimitMap.set(clientIp, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }

  const limit = rateLimitMap.get(clientIp);

  if (now > limit.resetTime) {
    // Reset window
    limit.count = 1;
    limit.resetTime = now + windowMs;
    return true;
  }

  if (limit.count >= maxRequests) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Get cache key for request
 */
function getCacheKey(path, searchParams) {
  return `${path}?${searchParams.toString()}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_TTL;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';

    // Rate limiting check
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Missing path parameter' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Check cache first
    const cacheKey = getCacheKey(path, searchParams);
    const cached = cache.get(cacheKey);

    if (cached && isCacheValid(cached.timestamp)) {
      console.log(`[IC-API-Proxy] Cache hit for: ${path}`);
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        }
      });
    }

    // Fetch from IC API
    const url = `${IC_API_BASE}/${path}${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`;

    console.log(`[IC-API-Proxy] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const data = await response.json();

    // Cache the response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('[IC-API-Proxy] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

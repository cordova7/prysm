/**
 * API Rate Limiting Utility
 * Uses Upstash Redis for distributed rate limiting
 * Prevents API abuse and ensures fair usage
 *
 * OPTIONAL: Rate limiting is automatically disabled if Redis isn't configured
 * No account needed - just works when you add Redis credentials
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { validateEnv } from './validate-env';

// Check if Redis is configured
const hasRedisConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Only initialize Redis if configured
let redis: Redis | null = null;
let tokenApiLimiter: Ratelimit | null = null;
let generalApiLimiter: Ratelimit | null = null;
let strictApiLimiter: Ratelimit | null = null;

if (hasRedisConfig) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  // Create different rate limiters for different endpoints
  tokenApiLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:token-api',
  });

  generalApiLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:general-api',
  });

  strictApiLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:strict-api',
  });
}

/**
 * Middleware function to check rate limit
 * @param request - Next.js request object
 * @param limiter - The rate limiter to use
 * @param identifier - Unique identifier for the client (e.g., IP address)
 * @returns Response object if rate limited, null if allowed
 */
export async function checkRateLimit(
  request: NextRequest,
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  // If rate limiting not configured, allow all requests
  if (!limiter) {
    return null;
  }

  try {
    const { success, limit, reset, remaining } = await limiter.limit(identifier);

    // Add rate limit headers to the response
    const response = success
      ? null
      : NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Too many requests. Limit: ${limit}, Try again in ${reset - Date.now()}ms`,
            limit,
            remaining,
            reset,
          },
          { status: 429 }
        );

    if (response) {
      // Add headers to error response
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', reset.toString());
      response.headers.set('Retry-After', Math.ceil((reset - Date.now()) / 1000).toString());
    }

    return response;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting service is down
    return null;
  }
}

/**
 * Get client identifier from request
 * Uses IP address or user ID if available
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from headers (Vercel)
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for') ||
    request.ip ||
    '127.0.0.1';

  return ip;
}

/**
 * Apply token API rate limit
 */
export async function checkTokenApiLimit(request: NextRequest): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  return checkRateLimit(request, tokenApiLimiter, identifier);
}

/**
 * Apply general API rate limit
 */
export async function checkGeneralApiLimit(request: NextRequest): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  return checkRateLimit(request, generalApiLimiter, identifier);
}

/**
 * Apply strict API rate limit
 */
export async function checkStrictApiLimit(request: NextRequest): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  return checkRateLimit(request, strictApiLimiter, identifier);
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitEnabled(): boolean {
  return hasRedisConfig;
}

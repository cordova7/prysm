/**
 * Environment Variable Validation
 * Validates required environment variables at runtime
 * Uses Zod for type-safe validation
 */

import { z } from 'zod';

// Define the environment variable schema
const envSchema = z.object({
  // Public Supabase configuration (exposed to client)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // Server-only Supabase configuration
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // API Configuration
  NEXT_PUBLIC_ICPSWAP_API_BASE_URL: z.string().url('NEXT_PUBLIC_ICPSWAP_API_BASE_URL must be a valid URL'),

  // Optional API key (for development)
  ICPSWAP_API_KEY: z.string().optional(),

  // PRYSM Canister Configuration (optional until deployed)
  NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID: z.string().optional(),
  NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID: z.string().optional(),
  NEXT_PUBLIC_ICPSWAP_SWAPFACTORY_CANISTER_ID: z.string().optional(),
  NEXT_PUBLIC_IC_HOST: z.string().url().optional(),

  // Vercel environment variables (optional)
  VERCEL_ENV: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),

  // Sentry (optional - errors will not be tracked if not provided)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Upstash Redis (optional - rate limiting disabled if not provided)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// Type definition for validated environment variables
export type Env = z.infer<typeof envSchema>;

// Cache validated environment variables
let cachedEnv: Env | null = null;

/**
 * Validates and returns environment variables
 * Throws an error if validation fails
 * @returns Validated environment variables
 * @throws {Error} If validation fails
 */
export function validateEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    // Get environment variables from process.env
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_ICPSWAP_API_BASE_URL: process.env.NEXT_PUBLIC_ICPSWAP_API_BASE_URL,
      ICPSWAP_API_KEY: process.env.ICPSWAP_API_KEY,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      SENTRY_DSN: process.env.SENTRY_DSN,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Validate using Zod
    const validatedEnv = envSchema.parse(env);

    // Cache the result
    cachedEnv = validatedEnv;

    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod validation errors for better readability
      const errorMessage = error.issues
        .map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        })
        .join('\n');

      throw new Error(
        `Environment validation failed:\n${errorMessage}\n\nPlease check your .env file and ensure all required variables are set correctly.`
      );
    }

    throw error;
  }
}

/**
 * Gets a specific environment variable with validation
 * @param key - The environment variable key
 * @returns The validated environment variable value
 */
export function getEnvVar<K extends keyof Env>(key: K): Env[K] {
  const env = validateEnv();
  return env[key];
}

/**
 * Checks if the application is running in production mode
 */
export function isProduction(): boolean {
  return validateEnv().NODE_ENV === 'production';
}

/**
 * Checks if the application is running in development mode
 */
export function isDevelopment(): boolean {
  return validateEnv().NODE_ENV === 'development';
}

/**
 * Checks if error monitoring is enabled (Sentry DSN is configured)
 */
export function isErrorMonitoringEnabled(): boolean {
  const env = validateEnv();
  return Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN);
}

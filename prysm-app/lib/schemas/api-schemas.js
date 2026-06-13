/**
 * API Response Schemas using Zod
 * Validates and types all external API responses
 */

import { z } from 'zod';

// ============================================================================
// ICPSwap API Schemas
// ============================================================================

/**
 * Raw token data from ICPSwap API /token/all endpoint
 */
export const ICPSwapTokenRawSchema = z.object({
  tokenLedgerId: z.string(),
  tokenName: z.string().optional().default('Unknown'),
  tokenSymbol: z.string().optional().default('N/A'),
  price: z.union([z.string(), z.number()]).optional().default('0'),
  priceChange24H: z.union([z.string(), z.number()]).optional().default('0'),
  tvlUSD: z.union([z.string(), z.number()]).optional().default('0'),
  volumeUSD24H: z.union([z.string(), z.number()]).optional().default('0'),
  volumeUSD7D: z.union([z.string(), z.number()]).optional().default('0'),
  totalVolumeUSD: z.union([z.string(), z.number()]).optional().default('0'),
  txCount24H: z.number().optional().default(0),
  priceLow24H: z.union([z.string(), z.number()]).optional().default('0'),
  priceHigh24H: z.union([z.string(), z.number()]).optional().default('0'),
  priceLow7D: z.union([z.string(), z.number()]).optional().default('0'),
  priceHigh7D: z.union([z.string(), z.number()]).optional().default('0'),
  priceLow30D: z.union([z.string(), z.number()]).optional().default('0'),
  priceHigh30D: z.union([z.string(), z.number()]).optional().default('0'),
});

/**
 * ICPSwap API response wrapper
 */
export const ICPSwapAPIResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z.array(ICPSwapTokenRawSchema),
});

/**
 * Pool data from ICPSwap API /pool/all endpoint
 */
export const ICPSwapPoolSchema = z.object({
  poolId: z.string(),
  token0LedgerId: z.string(),
  token1LedgerId: z.string(),
  token0Symbol: z.string().optional(),
  token1Symbol: z.string().optional(),
  tvlUSD: z.union([z.string(), z.number()]).optional().default('0'),
  volumeUSD24H: z.union([z.string(), z.number()]).optional().default('0'),
  // Add other pool fields as needed
});

export const ICPSwapPoolAPIResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z.array(ICPSwapPoolSchema),
});

// ============================================================================
// IC API Schemas
// ============================================================================

/**
 * IC canister information from IC API /canisters/{id} endpoint
 */
export const ICCanisterSchema = z.object({
  id: z.number().default(0),
  canister_id: z.string(),
  controllers: z.array(z.string()).default([]),
  // Additional fields can be added as needed
});

// ============================================================================
// Supabase Schemas
// ============================================================================

/**
 * Token from Supabase database (snake_case)
 */
export const SupabaseTokenSchema = z.object({
  token_ledger_id: z.string(),
  token_name: z.string().optional().default('Unknown'),
  token_symbol: z.string().optional().default('N/A'),
  price: z.number().optional().default(0),
  price_change_24h: z.number().optional().default(0),
  tvl_usd: z.number().optional().default(0),
  volume_usd_24h: z.number().optional().default(0),
  volume_usd_7d: z.number().optional().default(0),
  total_volume_usd: z.number().optional().default(0),
  tx_count_24h: z.number().optional().default(0),
  price_low_24h: z.number().optional().default(0),
  price_high_24h: z.number().optional().default(0),
  price_low_7d: z.number().optional().default(0),
  price_high_7d: z.number().optional().default(0),
  price_low_30d: z.number().optional().default(0),
  price_high_30d: z.number().optional().default(0),
  ic_id: z.number().optional().default(0),
  controllers: z.array(z.string()).optional().default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const SupabaseTokenArraySchema = z.array(SupabaseTokenSchema);

/**
 * Token relationships from Supabase
 */
export const SupabaseRelationshipSchema = z.object({
  token_ledger_id: z.string(),
  related_token_ledger_id: z.string(),
  relationship_type: z.string(),
  shared_controllers: z.array(z.string()).optional().default([]),
  created_at: z.string().optional(),
});

export const SupabaseRelationshipArraySchema = z.array(SupabaseRelationshipSchema);

// ============================================================================
// Processed/Frontend Schemas
// ============================================================================

/**
 * Processed token data used in frontend components
 */
export const ProcessedTokenSchema = z.object({
  id: z.string(),
  tokenLedgerId: z.string(),
  name: z.string(),
  symbol: z.string(),
  price: z.number(),
  priceChange24h: z.number(),
  liquidity: z.number(),
  volume24h: z.number(),
  txCount24h: z.number(),
  volume7d: z.number(),
  totalVolume: z.number(),
  priceLow24h: z.number(),
  priceHigh24h: z.number(),
  priceLow7d: z.number(),
  priceHigh7d: z.number(),
  priceLow30d: z.number(),
  priceHigh30d: z.number(),
  isNew: z.boolean().default(false),
  icId: z.number().default(0),
  controllers: z.array(z.string()).default([]),
});

export const ProcessedTokenArraySchema = z.array(ProcessedTokenSchema);

// ============================================================================
// HTTP Response Schemas
// ============================================================================

/**
 * Standard API error response
 */
export const APIErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
  details: z.any().optional(),
});

/**
 * Standard API success response with data
 */
export const APISuccessResponseSchema = z.object({
  data: z.any(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  }).optional(),
  meta: z.object({
    timestamp: z.string(),
    cached: z.boolean().optional(),
  }).optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Safely validate data against a schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages
 * @returns {Object} { success: boolean, data: any, error: string }
 */
export function validateSchema(schema, data, context = 'Data') {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated,
      error: null,
    };
  } catch (error) {
    console.error(`${context} validation failed:`, error.errors);
    return {
      success: false,
      data: null,
      error: error.errors?.[0]?.message || 'Validation failed',
      details: error.errors,
    };
  }
}

/**
 * Validate data and throw on failure
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages
 * @returns {any} Validated data
 * @throws {Error} If validation fails
 */
export function validateOrThrow(schema, data, context = 'Data') {
  try {
    return schema.parse(data);
  } catch (error) {
    // Log the full error object for debugging
    console.error(`Validation error for ${context}:`, JSON.stringify(error, null, 2));

    // More robust error message extraction
    let errorMessage = 'Unknown validation error';
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      errorMessage = error.errors[0].message ||
                     error.errors[0].path?.join('.') ||
                     'Invalid data structure';
    } else if (error.message) {
      errorMessage = error.message;
    }

    const errorMsg = `${context} validation failed: ${errorMessage}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Safely parse data, returning defaults on failure
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {any} fallback - Fallback value if validation fails
 * @returns {any} Validated data or fallback
 */
export function safeParseWithFallback(schema, data, fallback = null) {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('Schema validation failed, using fallback:', result.error.errors);
  return fallback;
}

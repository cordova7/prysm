/**
 * Shared IC ID Fetcher Module
 * Used by both migration script and API routes
 * Fetches IC canister IDs from the IC API
 */

import { ICCanisterSchema, validateSchema } from './schemas/api-schemas';
import { fetchWithTimeout, TimeoutError } from './utils/error-handler';
import logger from './utils/logger';

const IC_API_BASE = 'https://ic-api.internetcomputer.org/api/v3';

// Cache for IC canister IDs to avoid excessive API calls
const icIdCache = new Map();
const IC_ID_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for API calls
const rateLimitState = {
  lastCall: 0,
  minInterval: 100, // 100ms between calls (10 req/sec max)
  nextAvailableAt: 0,
  retryCount: new Map(),
  maxRetries: 3
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create context logger
const log = logger.createContext('IC API');

/**
 * Rate limiting helper - ensures we don't call the API too frequently
 */
async function rateLimitedFetch(url, options = {}, retryCount = 0) {
  const now = Date.now();
  const waitTime = Math.max(0, rateLimitState.nextAvailableAt - now);
  rateLimitState.nextAvailableAt = now + waitTime + rateLimitState.minInterval;

  if (waitTime > 0) {
    log.debug(`Rate limiting: waiting ${waitTime}ms`);
    await sleep(waitTime);
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    rateLimitState.lastCall = Date.now();

    // If we get rate limited (429), retry with exponential backoff
    if (response.status === 429 && retryCount < rateLimitState.maxRetries) {
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s backoff
      log.warn(`Rate limited, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${rateLimitState.maxRetries})`);
      await sleep(backoffTime);
      return rateLimitedFetch(url, options, retryCount + 1);
    }

    return response;
  } catch (error) {
    // Network error - retry with exponential backoff
    if ((error.name === 'TypeError' || error.name === 'AbortError') && retryCount < rateLimitState.maxRetries) {
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
      log.warn(`Network error, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${rateLimitState.maxRetries})`);
      await sleep(backoffTime);
      return rateLimitedFetch(url, options, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Fetch IC canister ID and controllers for a single token
 * @param {string} tokenLedgerId - The token ledger ID
 * @returns {Promise<Object>} - Object with { id, controllers, canister_id } or zeros
 */
export const fetchICCanisterId = async (tokenLedgerId) => {
  try {
    // Check cache first
    const cached = icIdCache.get(tokenLedgerId);
    if (cached && (Date.now() - cached.timestamp) < IC_ID_CACHE_TTL) {
      log.debug(`Cache hit for IC ID: ${tokenLedgerId}`);
      return {
        id: cached.id,
        controllers: cached.controllers || [],
        canister_id: tokenLedgerId
      };
    }

    log.debug(`Fetching IC canister data for: ${tokenLedgerId}`);

    // Try proxy API first when running with a known base URL
    let response;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const proxyUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/ic-api?path=canisters/${tokenLedgerId}` : null;

    if (proxyUrl) {
      try {
        response = await rateLimitedFetch(proxyUrl);
      } catch (proxyError) {
        log.warn(`Proxy failed for ${tokenLedgerId}, falling back to direct API`, proxyError.message);
        // Fallback to direct API if proxy fails
        response = await rateLimitedFetch(`${IC_API_BASE}/canisters/${tokenLedgerId}`);
      }
    } else {
      response = await rateLimitedFetch(`${IC_API_BASE}/canisters/${tokenLedgerId}`);
    }

    if (response.ok) {
      const data = await response.json();

      // Validate response structure
      const validation = validateSchema(ICCanisterSchema, data, 'IC canister response');

      if (!validation.success) {
        log.warn(`IC API validation failed for ${tokenLedgerId}`, validation.error);
        return { id: 0, controllers: [], canister_id: tokenLedgerId };
      }

      const result = {
        id: validation.data.id || 0,
        controllers: validation.data.controllers || [],
        canister_id: validation.data.canister_id || tokenLedgerId
      };

      // Cache the result
      icIdCache.set(tokenLedgerId, {
        id: result.id,
        controllers: result.controllers,
        timestamp: Date.now()
      });

      log.debug(`Successfully fetched IC ID ${result.id} for ${tokenLedgerId}`);
      return result;
    }

    if (response.status === 429) {
      log.warn(`Rate limited by IC API for ${tokenLedgerId}`);
    } else {
      log.warn(`IC API returned ${response.status} for ${tokenLedgerId}`);
    }
    return { id: 0, controllers: [], canister_id: tokenLedgerId };
  } catch (error) {
    if (error.name === 'TimeoutError') {
      log.warn(`Timeout fetching IC ID for ${tokenLedgerId}`);
    } else {
      log.warn(`Failed to fetch IC ID for ${tokenLedgerId}`, { error: error.message });
    }
    return { id: 0, controllers: [], canister_id: tokenLedgerId };
  }
};


async function processWithConcurrency(items, concurrency, handler) {
  let index = 0;
  const results = new Array(items.length);

  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await handler(items[current]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Batch fetch IC canister IDs and controllers for multiple tokens
 * @param {string[]} tokenLedgerIds - Array of token ledger IDs
 * @param {number} batchSize - Number of tokens to process per batch (default: 25)
 * @returns {Promise<Map<string, Object>>} - Map of tokenLedgerId to { id, controllers, canister_id }
 */
export const batchFetchICIds = async (tokenLedgerIds, batchSize = 25) => {
  const results = new Map();
  const totalBatches = Math.ceil(tokenLedgerIds.length / batchSize);

  log.info(`Starting batch fetch for ${tokenLedgerIds.length} tokens in ${totalBatches} batches`);

  for (let i = 0; i < tokenLedgerIds.length; i += batchSize) {
    const batch = tokenLedgerIds.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const concurrency = Math.min(5, batch.length);

    const batchResults = await processWithConcurrency(batch, concurrency, async (tokenLedgerId) => {
      const data = await fetchICCanisterId(tokenLedgerId);
      return { tokenLedgerId, data };
    });

    // Store results
    batchResults.forEach(({ tokenLedgerId, data }) => {
      results.set(tokenLedgerId, data);
    });

    log.info(`Completed batch ${batchNumber}/${totalBatches} (${batch.length} tokens, concurrency ${concurrency})`);
  }

  log.info(`Batch fetch complete: ${results.size} tokens processed`);
  return results;
};

/**
 * Populate IC IDs for tokens that don't have them
 * @param {Object[]} tokens - Array of tokens (from JSON or API)
 * @returns {Promise<Object[]>} - Array of tokens with populated IC IDs
 */
export const populateICIdsForTokens = async (tokens) => {
  // Check which tokens need IC IDs
  const tokensNeedingIcId = tokens.filter(token => !token.icId || token.icId === 0);
  log.info(`Tokens needing IC ID: ${tokensNeedingIcId.length}/${tokens.length}`);

  if (tokensNeedingIcId.length === 0) {
    log.info('All tokens already have IC IDs');
    return tokens;
  }

  // Fetch IC IDs for tokens that need them
  const tokenLedgerIds = tokensNeedingIcId.map(token => token.tokenLedgerId || token.token_ledger_id);
  const icIdsMap = await batchFetchICIds(tokenLedgerIds, 25);

  // Update tokens with IC IDs
  let updated = 0;
  const updatedTokens = tokens.map(token => {
    const ledgerId = token.tokenLedgerId || token.token_ledger_id;
    if (icIdsMap.has(ledgerId)) {
      const icData = icIdsMap.get(ledgerId);
      // Always update icId
      token.icId = icData.id;

      // Update controllers if needed
      const needsControllerUpdate = !token.controllers ||
                                    token.controllers.length === 0 ||
                                    (icData.controllers && icData.controllers.length > 0);

      if (needsControllerUpdate && icData.controllers && icData.controllers.length > 0) {
        token.controllers = icData.controllers;
      }

      updated++;
    }
    return token;
  });

  log.info(`IC IDs populated: ${updated} tokens updated`);
  return updatedTokens;
};

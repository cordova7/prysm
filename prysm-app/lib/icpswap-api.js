// This file will contain functions to interact with the ICPSWAP APIs
// According to the documentation in the /docs folder

import { updateTokenRegistry, isNewToken } from './server/token-tracker';
import { fetchICCanisterId, batchFetchICIds } from './ic-id-fetcher';
import {
  ICPSwapAPIResponseSchema,
  ICPSwapPoolAPIResponseSchema,
  validateOrThrow
} from './schemas/api-schemas';
import {
  fetchWithTimeout,
  parseJSONResponse,
  validateAPIResponseCode,
  logError,
} from './utils/error-handler';
import logger, { createTimer } from './utils/logger';

// Base API URL based on the documentation
const API_BASE = process.env.NEXT_PUBLIC_ICPSWAP_API_BASE_URL || 'https://api.icpswap.com/info';

// Default timeout for API requests (10 seconds)
const DEFAULT_TIMEOUT = 10000;

// Create context logger
const log = logger.createContext('ICPSwap API');

// Fetch all tokens from ICPSWAP
export const fetchTokens = async (options = {}) => {
  const timer = createTimer('ICPSwap API', 'fetchTokens');

  try {
    log.debug('Fetching all tokens from ICPSwap');

    // Use enhanced fetch with timeout and retry
    const response = await fetchWithTimeout(`${API_BASE}/token/all`, {
      timeout: options.timeout || DEFAULT_TIMEOUT,
      retries: options.retries || 2,
      signal: options.signal,
    });

    // Parse JSON response with error handling
    const result = await parseJSONResponse(response, 'ICPSwap');

    // Validate API response structure
    const validatedData = validateOrThrow(
      ICPSwapAPIResponseSchema,
      result,
      'ICPSwap token response'
    );

    // Check API response code
    const tokenData = validateAPIResponseCode(validatedData, 200, 'ICPSwap');

    log.info(`Successfully fetched ${tokenData.length} tokens`);

    // Process the token data based on the actual API response structure
    const processedTokens = await processTokenData(tokenData);

    timer.end({ tokenCount: processedTokens.length, success: true });
    return processedTokens;
  } catch (error) {
    timer.end({ success: false });
    logError(error, 'ICPSwap API: fetchTokens');
    log.error('Failed to fetch tokens', error);
    throw error;
  }
};

// Fetch token details by ID
// Since the API doesn't have a single token endpoint, we'll get all tokens and filter
export const fetchTokenDetails = async (tokenLedgerId, options = {}) => {
  const timer = createTimer('ICPSwap API', 'fetchTokenDetails');

  try {
    log.debug(`Fetching details for token: ${tokenLedgerId}`);

    // Get all tokens and find the specific one
    const tokens = await fetchTokens(options);
    const token = tokens.find(t => t.tokenLedgerId === tokenLedgerId);

    if (!token) {
      const error = new Error(`Token with ledger ID "${tokenLedgerId}" not found`);
      error.statusCode = 404;
      throw error;
    }

    log.info(`Found token: ${token.symbol}`);
    timer.end({ success: true });
    return token;
  } catch (error) {
    timer.end({ success: false });
    logError(error, `ICPSwap API: fetchTokenDetails for ${tokenLedgerId}`);
    log.error(`Failed to fetch token details for ${tokenLedgerId}`, error);
    throw error;
  }
};

// Fetch pool data for a specific token
// This will get all pools and filter for those containing the specified token
export const fetchTokenPools = async (tokenLedgerId, options = {}) => {
  const timer = createTimer('ICPSwap API', 'fetchTokenPools');

  try {
    log.debug(`Fetching pools for token: ${tokenLedgerId}`);

    // Use enhanced fetch with timeout and retry
    const response = await fetchWithTimeout(`${API_BASE}/pool/all`, {
      timeout: options.timeout || DEFAULT_TIMEOUT,
      retries: options.retries || 2,
      signal: options.signal,
    });

    // Parse JSON response with error handling
    const result = await parseJSONResponse(response, 'ICPSwap Pools');

    // Validate API response structure
    const validatedData = validateOrThrow(
      ICPSwapPoolAPIResponseSchema,
      result,
      'ICPSwap pool response'
    );

    // Check API response code
    const poolData = validateAPIResponseCode(validatedData, 200, 'ICPSwap Pools');

    // Filter pools that contain the specified token
    const poolsWithToken = poolData.filter(pool =>
      pool.token0LedgerId === tokenLedgerId || pool.token1LedgerId === tokenLedgerId
    );

    log.info(`Found ${poolsWithToken.length} pools for token ${tokenLedgerId}`);
    timer.end({ poolCount: poolsWithToken.length, success: true });
    return poolsWithToken;
  } catch (error) {
    timer.end({ success: false });
    logError(error, `ICPSwap API: fetchTokenPools for ${tokenLedgerId}`);
    log.error(`Failed to fetch pools for token ${tokenLedgerId}`, error);
    throw error;
  }
};

// Process raw API data to match our component expectations
const processTokenData = async (apiData) => {
  // Extract token ledger IDs for batch fetching
  const tokenLedgerIds = apiData.map(token => token.tokenLedgerId);

  // Fetch IC canister IDs for all tokens (with caching and rate limiting)
  log.info(`Fetching IC canister IDs for ${tokenLedgerIds.length} tokens`);
  const icIdsMap = await batchFetchICIds(tokenLedgerIds, 50);

  // Add icId and controllers to each token BEFORE updating registry
  const tokensWithIcId = apiData.map(token => {
    const icData = icIdsMap.get(token.tokenLedgerId) || { id: -1, controllers: [] };
    return {
      ...token,
      icId: icData.id,
      controllers: icData.controllers
    };
  });

  // Update our token registry with the new data (now WITH icId) and identify new tokens
  const newTokens = await updateTokenRegistry(tokensWithIcId);

  // Create a set of new token IDs for quick lookup
  const newTokenIds = new Set(newTokens.map(token => token.tokenLedgerId));

  // Helper function to safely convert string to number
  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  // Process the token data based on the ICPSWAP API response structure
  // Now using tokensWithIcId which already has the icId field
  return tokensWithIcId.map((token) => {
    // Check if this token is new based on our registry
    const isNew = newTokenIds.has(token.tokenLedgerId);

    // Convert all string numbers to actual numbers
    const price = toNumber(token.price);
    const priceChange24h = toNumber(token.priceChange24H);
    const liquidity = toNumber(token.tvlUSD);
    const volume24h = toNumber(token.volumeUSD24H);
    const volume7d = toNumber(token.volumeUSD7D);
    const totalVolume = toNumber(token.totalVolumeUSD);
    const priceLow24h = toNumber(token.priceLow24H);
    const priceHigh24h = toNumber(token.priceHigh24H);
    const priceLow7d = toNumber(token.priceLow7D);
    const priceHigh7d = toNumber(token.priceHigh7D);
    const priceLow30d = toNumber(token.priceLow30D);
    const priceHigh30d = toNumber(token.priceHigh30D);

    return {
      id: token.tokenLedgerId,
      tokenLedgerId: token.tokenLedgerId,
      name: token.tokenName || 'Unknown',
      symbol: token.tokenSymbol || 'N/A',
      price: price,
      priceChange24h: priceChange24h,
      liquidity: liquidity,
      volume24h: volume24h,
      txCount24h: token.txCount24H || 0,
      volume7d: volume7d,
      totalVolume: totalVolume,
      priceLow24h: priceLow24h,
      priceHigh24h: priceHigh24h,
      priceLow7d: priceLow7d,
      priceHigh7d: priceHigh7d,
      priceLow30d: priceLow30d,
      priceHigh30d: priceHigh30d,
      isNew: isNew,
      icId: token.icId, // Use the icId we added earlier
      controllers: token.controllers || [] // Add controllers array
    };
  });
};
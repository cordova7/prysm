/**
 * ICPSwap Transaction Fetching Service
 *
 * This service fetches transaction data from ICPSwap canisters
 * and integrates with the token cards to show recent activity.
 *
 * Based on: 05.Fetching_Transaction.md
 */

import { Actor, HttpAgent } from '@dfinity/agent';

// ICPSwap Canister IDs
const CANISTER_IDS = {
  BASE_INDEX: 'g54jq-hiaaa-aaaag-qck5q-cai',
  NODE_INDEX: 'ggzvv-5qaaa-aaaag-qck7a-cai',
};

// ICP Network URL
const ICP_HOST = 'https://ic0.app';

// BaseStorage IDL (Interface Definition Language)
const baseStorageIDL = ({ IDL }) => {
  const TransactionType = IDL.Variant({
    'decreaseLiquidity': IDL.Null,
    'claim': IDL.Null,
    'swap': IDL.Null,
    'addLiquidity': IDL.Null,
    'increaseLiquidity': IDL.Null,
  });

  const Transaction = IDL.Record({
    'to': IDL.Text,
    'action': TransactionType,
    'token0Id': IDL.Text,
    'token1Id': IDL.Text,
    'liquidityTotal': IDL.Nat,
    'from': IDL.Text,
    'hash': IDL.Text,
    'tick': IDL.Int,
    'token1Price': IDL.Float64,
    'recipient': IDL.Text,
    'token0ChangeAmount': IDL.Float64,
    'sender': IDL.Text,
    'liquidityChange': IDL.Nat,
    'token1Standard': IDL.Text,
    'token0Fee': IDL.Float64,
    'token1Fee': IDL.Float64,
    'timestamp': IDL.Int,
    'token1ChangeAmount': IDL.Float64,
    'token1Decimals': IDL.Float64,
    'token0Standard': IDL.Text,
    'amountUSD': IDL.Float64,
    'amountToken0': IDL.Float64,
    'amountToken1': IDL.Float64,
    'poolFee': IDL.Nat,
    'token0Symbol': IDL.Text,
    'token0Decimals': IDL.Float64,
    'token0Price': IDL.Float64,
    'token1Symbol': IDL.Text,
    'poolId': IDL.Text,
  });

  const RecordPage = IDL.Record({
    content: IDL.Vec(Transaction),
    offset: IDL.Nat,
    limit: IDL.Nat,
    totalElements: IDL.Nat,
  });

  return IDL.Service({
    'baseStorage': IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'getByToken': IDL.Func([IDL.Nat, IDL.Nat, IDL.Text], [RecordPage], ['query']),
    'getBaseRecord': IDL.Func([IDL.Nat, IDL.Nat, IDL.Vec(IDL.Text)], [RecordPage], ['query']),
  });
};

// NodeIndex IDL
const nodeIndexIDL = ({ IDL }) => IDL.Service({
  'tokenStorage': IDL.Func([IDL.Text], [IDL.Opt(IDL.Text)], ['query']),
  'poolStorage': IDL.Func([IDL.Text], [IDL.Opt(IDL.Text)], ['query']),
  'userStorage': IDL.Func([IDL.Text], [IDL.Opt(IDL.Text)], ['query']),
});

// TokenStorage IDL
const tokenStorageIDL = ({ IDL }) => {
  const TransactionType = IDL.Variant({
    'decreaseLiquidity': IDL.Null,
    'claim': IDL.Null,
    'swap': IDL.Null,
    'addLiquidity': IDL.Null,
    'increaseLiquidity': IDL.Null,
  });

  const Transaction = IDL.Record({
    'to': IDL.Text,
    'action': TransactionType,
    'token0Id': IDL.Text,
    'token1Id': IDL.Text,
    'liquidityTotal': IDL.Nat,
    'from': IDL.Text,
    'hash': IDL.Text,
    'tick': IDL.Int,
    'token1Price': IDL.Float64,
    'recipient': IDL.Text,
    'token0ChangeAmount': IDL.Float64,
    'sender': IDL.Text,
    'liquidityChange': IDL.Nat,
    'token1Standard': IDL.Text,
    'token0Fee': IDL.Float64,
    'token1Fee': IDL.Float64,
    'timestamp': IDL.Int,
    'token1ChangeAmount': IDL.Float64,
    'token1Decimals': IDL.Float64,
    'token0Standard': IDL.Text,
    'amountUSD': IDL.Float64,
    'amountToken0': IDL.Float64,
    'amountToken1': IDL.Float64,
    'poolFee': IDL.Nat,
    'token0Symbol': IDL.Text,
    'token0Decimals': IDL.Float64,
    'token0Price': IDL.Float64,
    'token1Symbol': IDL.Text,
    'poolId': IDL.Text,
  });

  return IDL.Service({
    'getTokenTransactions': IDL.Func([IDL.Text, IDL.Nat, IDL.Nat], [IDL.Vec(Transaction)], ['query']),
  });
};

// Initialize agent for ICP network
let agent = null;
let baseStorageCache = null;
let baseStorageCacheTime = 0;
const BASE_STORAGE_CACHE_TTL = 5 * 60 * 1000; // Cache for 5 minutes

// Transaction cache to prevent redundant API calls
const transactionCache = new Map();
const TRANSACTION_CACHE_TTL = 60 * 1000; // Cache for 1 minute
const CACHE_VERSION = 'v2'; // Increment to invalidate old cache

// Promise-based cache to prevent concurrent duplicate requests (cache stampede prevention)
const inflightBaseStorageRequests = new Map();
const inflightTransactionRequests = new Map();

function getAgent() {
  if (!agent) {
    agent = new HttpAgent({
      host: ICP_HOST,
    });
  }
  return agent;
}

// Get list of BaseStorage canisters with promise-based caching (prevents cache stampede)
export async function getBaseStorageCanisters() {
  const cacheKey = 'base-storage-list';

  // If a request is already in progress, return that promise
  if (inflightBaseStorageRequests.has(cacheKey)) {
    return inflightBaseStorageRequests.get(cacheKey);
  }

  // Check regular cache first
  const now = Date.now();
  if (baseStorageCache && (now - baseStorageCacheTime) < BASE_STORAGE_CACHE_TTL) {
    return baseStorageCache;
  }

  // Make new request and cache the promise
  const requestPromise = (async () => {
    try {
      const actor = Actor.createActor(baseStorageIDL, {
        agent: getAgent(),
        canisterId: CANISTER_IDS.BASE_INDEX,
      });

      const result = await actor.baseStorage();

      // Cache the result
      baseStorageCache = result;
      baseStorageCacheTime = now;

      return result;
    } finally {
      // Remove from inflight requests when done
      inflightBaseStorageRequests.delete(cacheKey);
    }
  })();

  inflightBaseStorageRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Get TokenStorage canister for a specific token (via NodeIndex)
export async function getTokenStorageCanister(tokenId) {
  try {
    const actor = Actor.createActor(nodeIndexIDL, {
      agent: getAgent(),
      canisterId: CANISTER_IDS.NODE_INDEX,
    });

    const result = await actor.tokenStorage(tokenId);
    return result[0] || null; // IDL.Opt returns array with element or empty
  } catch (error) {
    console.error(`Error fetching TokenStorage for ${tokenId}:`, error);
    throw error;
  }
}

// Fetch transactions from BaseStorage canister directly with timeout
async function getTransactionsFromBaseStorage(baseStorageId, tokenId, offset = 0, limit = 10) {
  const TIMEOUT_MS = 5000; // 5 second timeout per canister

  try {
    const actor = Actor.createActor(baseStorageIDL, {
      agent: getAgent(),
      canisterId: baseStorageId,
    });

    // Create a promise that will timeout
    const queryPromise = actor.getByToken(offset, limit, tokenId);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), TIMEOUT_MS);
    });

    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (error) {
    // Don't log errors for empty results or timeouts - they're expected for many tokens
    if (!error.message.includes('timeout')) {
      console.debug(`BaseStorage query failed for ${baseStorageId}:`, error.message);
    }
    return null;
  }
}

// Fetch transactions for a specific token with timeout and promise-based caching
export async function getTokenTransactions(tokenId, offset = 0, limit = 10) {
  const cacheKey = `${CACHE_VERSION}-${tokenId}-${offset}-${limit}`;
  const OVERALL_TIMEOUT_MS = 15000; // 15 second overall timeout

  // If a request is already in progress for this exact query, return that promise
  if (inflightTransactionRequests.has(cacheKey)) {
    return inflightTransactionRequests.get(cacheKey);
  }

  // Check regular cache first
  const now = Date.now();
  const cached = transactionCache.get(cacheKey);

  if (cached && (now - cached.timestamp) < TRANSACTION_CACHE_TTL) {
    return cached.data;
  }

  // Make new request with timeout and cache the promise
  const requestPromise = (async () => {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transaction fetch timeout')), OVERALL_TIMEOUT_MS);
      });

      // Create the actual fetch promise
      const fetchPromise = (async () => {
        // First, get the list of BaseStorage canisters
        const baseStorageCanisters = await getBaseStorageCanisters();

        if (!baseStorageCanisters || baseStorageCanisters.length === 0) {
          return [];
        }

        // Try each BaseStorage canister until we find transactions (limit to first 3 to avoid long waits)
        const canistersToTry = baseStorageCanisters.slice(0, 3);
        for (const canisterId of canistersToTry) {
          const result = await getTransactionsFromBaseStorage(canisterId, tokenId, offset, limit);

          if (result && result.content && result.content.length > 0) {
            // Format and sort by timestamp (most recent first)
            const formatted = result.content
              .map(tx => formatTransaction(tx))
              .sort((a, b) => {
                const tsA = Number(a.timestamp) || 0;
                const tsB = Number(b.timestamp) || 0;
                return tsB - tsA; // Descending order (newest first)
              });

            // Cache the result
            transactionCache.set(cacheKey, {
              data: formatted,
              timestamp: now
            });

            return formatted;
          }
        }

        // Fallback: Try TokenStorage method (only if no transactions found in BaseStorage)
        const tokenStorageId = await getTokenStorageCanister(tokenId);

        if (!tokenStorageId) {
          // Cache empty result
          transactionCache.set(cacheKey, {
            data: [],
            timestamp: now
          });
          return [];
        }

        const actor = Actor.createActor(tokenStorageIDL, {
          agent: getAgent(),
          canisterId: tokenStorageId,
        });

        const transactions = await actor.getTokenTransactions(tokenId, offset, limit);
        // Format and sort by timestamp (most recent first)
        const formatted = transactions
          .map(tx => formatTransaction(tx))
          .sort((a, b) => {
            const tsA = Number(a.timestamp) || 0;
            const tsB = Number(b.timestamp) || 0;
            return tsB - tsA; // Descending order (newest first)
          });

        // Cache the result
        transactionCache.set(cacheKey, {
          data: formatted,
          timestamp: now
        });

        return formatted;
      })();

      // Race between fetch and timeout
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      // Don't log timeout errors - they're expected for many tokens
      if (!error.message.includes('timeout')) {
        console.debug(`Transaction fetch failed for ${tokenId}:`, error.message);
      }
      // Cache empty result on error
      transactionCache.set(cacheKey, {
        data: [],
        timestamp: now
      });
      return [];
    } finally {
      // Remove from inflight requests when done
      inflightTransactionRequests.delete(cacheKey);
    }
  })();

  inflightTransactionRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Format transaction for display
export function formatTransaction(tx) {
  // Helper to convert BigInt/number values
  const convertValue = (value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  };

  // Helper to get action variant key
  const getActionFromVariant = (action) => {
    if (typeof action === 'object' && action !== null) {
      // The action is a variant with a key
      const keys = Object.keys(action);
      return keys[0] || 'unknown';
    }
    return 'unknown';
  };

  return {
    hash: tx.hash,
    action: getActionDisplayName(getActionFromVariant(tx.action)),
    timestamp: convertValue(tx.timestamp),
    from: tx.from,
    to: tx.to,
    sender: tx.sender,
    recipient: tx.recipient,
    amountUSD: Number(tx.amountUSD || 0),
    amountToken0: Number(tx.amountToken0 || 0),
    amountToken1: Number(tx.amountToken1 || 0),
    token0Symbol: tx.token0Symbol,
    token1Symbol: tx.token1Symbol,
    poolId: tx.poolId,
    tick: convertValue(tx.tick),
    liquidityTotal: convertValue(tx.liquidityTotal),
    liquidityChange: convertValue(tx.liquidityChange),
    poolFee: convertValue(tx.poolFee),
    // Additional fields for completeness
    token0Id: tx.token0Id,
    token1Id: tx.token1Id,
    token0Price: Number(tx.token0Price || 0),
    token1Price: Number(tx.token1Price || 0),
    token0Fee: Number(tx.token0Fee || 0),
    token1Fee: Number(tx.token1Fee || 0),
    token0ChangeAmount: Number(tx.token0ChangeAmount || 0),
    token1ChangeAmount: Number(tx.token1ChangeAmount || 0),
    token0Decimals: Number(tx.token0Decimals || 0),
    token1Decimals: Number(tx.token1Decimals || 0),
    token0Standard: tx.token0Standard,
    token1Standard: tx.token1Standard,
  };
}

// Get display name for transaction action
function getActionDisplayName(action) {
  const actionNames = {
    'addLiquidity': 'Initial Liquidity',
    'increaseLiquidity': 'Add Liquidity',
    'decreaseLiquidity': 'Remove Liquidity',
    'swap': 'Swap',
    'claim': 'Claim',
  };

  return actionNames[action] || 'Unknown';
}

// Get recent activity summary for a token
export async function getTokenActivitySummary(tokenId, limit = 5) {
  try {
    const transactions = await getTokenTransactions(tokenId, 0, limit);

    if (transactions.length === 0) {
      return {
        hasActivity: false,
        message: 'No recent activity',
        transactions: [],
      };
    }

    // Group by action type
    const activityByType = {};
    transactions.forEach(tx => {
      const action = tx.action;
      if (!activityByType[action]) {
        activityByType[action] = 0;
      }
      activityByType[action]++;
    });

    // Calculate total volume
    const totalVolumeUSD = transactions.reduce((sum, tx) => sum + Number(tx.amountUSD || 0), 0);

    return {
      hasActivity: true,
      transactionCount: transactions.length,
      totalVolumeUSD,
      activityByType,
      transactions: transactions.slice(0, limit), // Return top transactions
    };
  } catch (error) {
    console.error(`Error getting activity summary for ${tokenId}:`, error);
    return {
      hasActivity: false,
      error: error.message,
      transactions: [],
    };
  }
}

// Batch fetch transactions for multiple tokens
export async function getBatchTokenActivity(tokenIds = []) {
  const results = {};

  for (const tokenId of tokenIds) {
    try {
      results[tokenId] = await getTokenActivitySummary(tokenId, 5);
    } catch (error) {
      console.error(`Error fetching activity for ${tokenId}:`, error);
      results[tokenId] = {
        hasActivity: false,
        error: error.message,
        transactions: [],
      };
    }
  }

  return results;
}

// UserStorage IDL for fetching user transactions
const userStorageIDL = ({ IDL }) => {
  const TransactionType = IDL.Variant({
    'decreaseLiquidity': IDL.Null,
    'claim': IDL.Null,
    'swap': IDL.Null,
    'addLiquidity': IDL.Null,
    'increaseLiquidity': IDL.Null,
  });

  const Transaction = IDL.Record({
    'to': IDL.Text,
    'action': TransactionType,
    'token0Id': IDL.Text,
    'token1Id': IDL.Text,
    'liquidityTotal': IDL.Nat,
    'from': IDL.Text,
    'hash': IDL.Text,
    'tick': IDL.Int,
    'token1Price': IDL.Float64,
    'recipient': IDL.Text,
    'token0ChangeAmount': IDL.Float64,
    'sender': IDL.Text,
    'liquidityChange': IDL.Nat,
    'token1Standard': IDL.Text,
    'token0Fee': IDL.Float64,
    'token1Fee': IDL.Float64,
    'timestamp': IDL.Int,
    'token1ChangeAmount': IDL.Float64,
    'token1Decimals': IDL.Float64,
    'token0Standard': IDL.Text,
    'amountUSD': IDL.Float64,
    'amountToken0': IDL.Float64,
    'amountToken1': IDL.Float64,
    'poolFee': IDL.Nat,
    'token0Symbol': IDL.Text,
    'token0Decimals': IDL.Float64,
    'token0Price': IDL.Float64,
    'token1Symbol': IDL.Text,
    'poolId': IDL.Text,
  });

  const RecordPage = IDL.Record({
    content: IDL.Vec(Transaction),
    offset: IDL.Nat,
    limit: IDL.Nat,
    totalElements: IDL.Nat,
  });

  return IDL.Service({
    'get': IDL.Func([IDL.Text, IDL.Nat, IDL.Nat, IDL.Vec(IDL.Text)], [RecordPage], ['query']),
  });
};

// User transactions cache
const userTransactionCache = new Map();
const USER_TX_CACHE_TTL = 60 * 1000; // Cache for 1 minute
const inflightUserTxRequests = new Map();

// Get UserStorage canister for a specific user (via NodeIndex)
export async function getUserStorageCanister(userPrincipalId) {
  try {
    const actor = Actor.createActor(nodeIndexIDL, {
      agent: getAgent(),
      canisterId: CANISTER_IDS.NODE_INDEX,
    });

    const result = await actor.userStorage(userPrincipalId);

    // IDL.Opt returns array with element or empty array
    const canisterId = result && result.length > 0 ? result[0] : null;

    return canisterId;
  } catch (error) {
    console.error(`Error fetching UserStorage for ${userPrincipalId}:`, error);
    throw error;
  }
}

// Fetch transactions for a specific user from ICPSwap
export async function getUserTransactions(userPrincipalId, offset = 0, limit = 10) {
  const cacheKey = `${CACHE_VERSION}-user-${userPrincipalId}-${offset}-${limit}`;
  const TIMEOUT_MS = 10000; // 10 second timeout

  // If a request is already in progress, return that promise
  if (inflightUserTxRequests.has(cacheKey)) {
    return inflightUserTxRequests.get(cacheKey);
  }

  // Check cache
  const now = Date.now();
  const cached = userTransactionCache.get(cacheKey);

  if (cached && (now - cached.timestamp) < USER_TX_CACHE_TTL) {
    return cached.data;
  }

  // Make new request
  const requestPromise = (async () => {
    try {
      // Get the UserStorage canister for this user
      const userStorageId = await getUserStorageCanister(userPrincipalId);

      if (!userStorageId) {
        // User hasn't transacted on ICPSwap
        const emptyResult = { transactions: [], totalElements: 0, noStorageCanister: true };
        userTransactionCache.set(cacheKey, { data: emptyResult, timestamp: now });
        return emptyResult;
      }

      const actor = Actor.createActor(userStorageIDL, {
        agent: getAgent(),
        canisterId: userStorageId,
      });

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('User transaction fetch timeout')), TIMEOUT_MS);
      });

      // Fetch transactions (empty pool filter = all pools)
      const fetchPromise = actor.get(userPrincipalId, BigInt(offset), BigInt(limit), []);

      const result = await Promise.race([fetchPromise, timeoutPromise]);

      // Format and sort by timestamp (most recent first)
      const formattedTransactions = result.content
        .map(tx => formatTransaction(tx))
        .sort((a, b) => {
          const tsA = Number(a.timestamp) || 0;
          const tsB = Number(b.timestamp) || 0;
          return tsB - tsA; // Descending order (newest first)
        });

      const formatted = {
        transactions: formattedTransactions,
        totalElements: Number(result.totalElements),
        offset: Number(result.offset),
        limit: Number(result.limit),
      };

      // Cache the result
      userTransactionCache.set(cacheKey, { data: formatted, timestamp: now });

      return formatted;
    } catch (error) {
      console.debug(`User transaction fetch failed for ${userPrincipalId}:`, error.message);
      const emptyResult = { transactions: [], totalElements: 0, error: error.message };
      userTransactionCache.set(cacheKey, { data: emptyResult, timestamp: now });
      return emptyResult;
    } finally {
      inflightUserTxRequests.delete(cacheKey);
    }
  })();

  inflightUserTxRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Export for use in React components
export default {
  getBaseStorageCanisters,
  getTokenStorageCanister,
  getTokenTransactions,
  getTokenActivitySummary,
  getBatchTokenActivity,
  getUserStorageCanister,
  getUserTransactions,
};

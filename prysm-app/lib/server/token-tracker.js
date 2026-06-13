// Token tracking service to identify new tokens
// Uses file-based persistent storage to survive server restarts
// Optimized with in-memory caching and batched writes

import fs from 'fs/promises';
import path from 'path';

const REGISTRY_FILE_PATH = path.join(process.cwd(), 'data', 'token-registry.json');

// In-memory cache with TTL to reduce file I/O
let tokenRegistryCache = null;
let isInitialized = false;
let lastFileSave = 0;
const SAVE_THROTTLE_MS = 5000; // Throttle file writes to 5 seconds

// Ensure data directory exists
const ensureDataDirectory = async () => {
  const dataDir = path.dirname(REGISTRY_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

// Load token registry from file
const loadTokenRegistry = async () => {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(REGISTRY_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    // Convert the object back to a Map
    const tokensMap = new Map();
    if (parsed.tokens && Array.isArray(parsed.tokens)) {
      parsed.tokens.forEach(token => {
        tokensMap.set(token.tokenLedgerId, token);
      });
    }

    return {
      tokens: tokensMap,
      lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date()
    };
  } catch (error) {
    // If file doesn't exist or is corrupted, return empty registry
    console.log('Creating new token registry (file not found or corrupted)');
    return {
      tokens: new Map(),
      lastUpdated: new Date()
    };
  }
};

// Save token registry to file (throttled to prevent excessive I/O)
const saveTokenRegistry = async (tokenRegistry) => {
  try {
    // Throttle file writes - only save every 5 seconds max
    const now = Date.now();
    if (now - lastFileSave < SAVE_THROTTLE_MS) {
      return; // Skip this save, will save later
    }

    await ensureDataDirectory();

    // Convert Map to array for JSON serialization
    const tokensArray = Array.from(tokenRegistry.tokens.values());

    const data = {
      tokens: tokensArray,
      lastUpdated: tokenRegistry.lastUpdated.toISOString(),
      version: 1
    };

    // Use writeFile with flag 'w' for faster writes
    await fs.writeFile(REGISTRY_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    lastFileSave = now;
  } catch (error) {
    console.error('Error saving token registry:', error);
    // Don't throw - continue operating without persistence
  }
};

// Initialize the token registry
export const initializeTokenRegistry = async () => {
  if (isInitialized && tokenRegistryCache) {
    return; // Already initialized
  }

  try {
    tokenRegistryCache = await loadTokenRegistry();
    isInitialized = true;
    console.log(`Token registry initialized with ${tokenRegistryCache.tokens.size} tokens`);
  } catch (error) {
    console.error('Error initializing token registry:', error);
    // Initialize with empty registry if loading fails
    tokenRegistryCache = {
      tokens: new Map(),
      lastUpdated: new Date()
    };
    isInitialized = true;
  }
};

// Check if a token is new by comparing with our registry
export const isNewToken = async (token) => {
  await initializeTokenRegistry();

  const tokenLedgerId = token.tokenLedgerId;

  if (!tokenLedgerId) {
    console.warn('Token without tokenLedgerId found:', token);
    return false;
  }

  const tokenExists = tokenRegistryCache.tokens.has(tokenLedgerId);

  if (!tokenExists) {
    // This is a new token, add it to the registry
    const newTokenEntry = {
      ...token,
      firstSeen: new Date().toISOString()
    };

    tokenRegistryCache.tokens.set(tokenLedgerId, newTokenEntry);
    tokenRegistryCache.lastUpdated = new Date();

    // Save to file asynchronously (don't await to avoid blocking)
    saveTokenRegistry(tokenRegistryCache).catch(err => {
      console.error('Failed to save token registry after adding new token:', err);
    });

    return true;
  }

  return false;
};

// Get all tokens from the registry
export const getAllTrackedTokens = async () => {
  await initializeTokenRegistry();
  return Array.from(tokenRegistryCache.tokens.values());
};

// Get only new tokens (added since specified date)
export const getNewTokens = async (sinceDate = null) => {
  await initializeTokenRegistry();

  let tokens = Array.from(tokenRegistryCache.tokens.values());

  if (sinceDate) {
    tokens = tokens.filter(token => new Date(token.firstSeen) > new Date(sinceDate));
  }

  // Return only tokens that were first seen (not updated) within the timeframe
  return tokens;
};

// Update the registry with a batch of tokens (optimized)
export const updateTokenRegistry = async (tokens) => {
  await initializeTokenRegistry();

  const newTokens = [];
  let hasChanges = false;

  // Use Map for O(1) lookups - batch process for better performance
  const tokenMap = tokenRegistryCache.tokens;
  const now = new Date().toISOString();

  // Single pass through tokens
  for (const token of tokens) {
    const tokenLedgerId = token.tokenLedgerId;

    if (!tokenLedgerId) {
      continue; // Skip invalid tokens silently for performance
    }

    const exists = tokenMap.has(tokenLedgerId);

    if (!exists) {
      // This is a new token
      const newTokenEntry = {
        ...token,
        firstSeen: now
      };

      tokenMap.set(tokenLedgerId, newTokenEntry);
      newTokens.push(newTokenEntry);
      hasChanges = true;
    } else if (hasChanges || token.lastUpdated) {
      // Update existing token only if we have changes or update timestamp
      const existingToken = tokenMap.get(tokenLedgerId);
      tokenMap.set(tokenLedgerId, {
        ...existingToken,
        ...token,
        firstSeen: existingToken.firstSeen // Preserve original firstSeen date
      });
      hasChanges = true;
    }
  }

  // Update lastUpdated timestamp
  if (hasChanges) {
    tokenRegistryCache.lastUpdated = new Date();

    // Save to file asynchronously (throttled)
    saveTokenRegistry(tokenRegistryCache).catch(err => {
      console.error('Failed to save token registry after batch update:', err);
    });
  }

  return newTokens;
};

// Force save the registry (useful for testing or before shutdown)
export const saveTokenRegistryNow = async () => {
  await initializeTokenRegistry();
  await saveTokenRegistry(tokenRegistryCache);
  console.log('Token registry saved to disk');
};

// Get registry statistics
export const getRegistryStats = async () => {
  await initializeTokenRegistry();
  return {
    totalTokens: tokenRegistryCache.tokens.size,
    lastUpdated: tokenRegistryCache.lastUpdated,
    filePath: REGISTRY_FILE_PATH
  };
};

// Seed the registry with tokens without marking them as "new"
// Use this for initial setup to avoid flagging existing tokens as new
export const seedRegistryWithTokens = async (tokens) => {
  // Force re-initialization by setting isInitialized to false
  isInitialized = false;

  console.log(`[SEEDING-START] tokens.length=${tokens.length}, registry.size=${tokenRegistryCache ? tokenRegistryCache.tokens.size : 'null'}`);
  await initializeTokenRegistry();
  console.log(`[SEEDING-AFTER-INIT] registry.size=${tokenRegistryCache.tokens.size}`);

  let addedCount = 0;

  for (const token of tokens) {
    const tokenLedgerId = token.tokenLedgerId;

    if (!tokenLedgerId) {
      console.warn('Token without tokenLedgerId found during seeding:', token);
      continue;
    }

    if (!tokenRegistryCache.tokens.has(tokenLedgerId)) {
      // Add token with a past timestamp to indicate it was seen before
      const seedTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        .toISOString();

      // Create a new token object WITHOUT firstSeen field to avoid conflicts
      const { firstSeen, ...tokenWithoutFirstSeen } = token;

      const newTokenEntry = {
        ...tokenWithoutFirstSeen,
        firstSeen: seedTime,
        isSeeded: true // Mark as seeded
      };

      console.log(`[SEEDING] Token ${tokenLedgerId}: excluded firstSeen=${firstSeen}, seedTime=${seedTime}`);

      tokenRegistryCache.tokens.set(tokenLedgerId, newTokenEntry);

      addedCount++;
    } else {
      // Update existing token but preserve its firstSeen date
      const existingToken = tokenRegistryCache.tokens.get(tokenLedgerId);
      tokenRegistryCache.tokens.set(tokenLedgerId, {
        ...existingToken,
        ...token,
        firstSeen: existingToken.firstSeen,
        isSeeded: true
      });
    }
  }

  tokenRegistryCache.lastUpdated = new Date();

  // Save to file asynchronously
  saveTokenRegistry(tokenRegistryCache).catch(err => {
    console.error('Failed to save token registry after seeding:', err);
  });

  console.log(`Registry seeded with ${addedCount} tokens`);
  return addedCount;
};

// Reset the registry (dangerous - only for testing)
export const resetTokenRegistry = async () => {
  tokenRegistryCache = {
    tokens: new Map(),
    lastUpdated: new Date()
  };
  isInitialized = false; // Allow re-initialization
  await saveTokenRegistry(tokenRegistryCache);
  console.log('Token registry has been reset');
};

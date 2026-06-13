/**
 * Background Token Updater
 * Automatically updates token data from ICPSWAP API to Supabase
 *
 * Usage:
 *   - Call updateTokens() function periodically
 *   - Set up with setInterval for automatic updates
 *   - Or use as a cron job
 */

import dotenv from 'dotenv';

dotenv.config();

// Check if we're in production (Vercel) or development
const isProduction = process.env.VERCEL_ENV === 'production';

console.log(`🌐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes - for automatic updates (not used in on-visit system)

// Get the API base URL dynamically
const getApiBaseUrl = () => {
  // Check if custom URL is configured
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  // For production on Vercel
  if (isProduction) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // For development - default to localhost:3000
  // Users can set NEXT_PUBLIC_APP_URL=http://localhost:3001 for custom ports
  return 'http://localhost:3000';
};

let lastUpdateTime = Date.now(); // Initialize to current time so first check doesn't think data is stale
let isUpdating = false;
let updateCount = 0;
let errorCount = 0;
let consecutiveErrors = 0;

// On-demand update system - updates happen when someone visits!
// MORE AGGRESSIVE for continuous token detection
const STALE_DATA_THRESHOLD = 30 * 1000; // 30 seconds - faster new token detection!

/**
 * Update tokens if data is stale (on-demand)
 * Enhanced to detect new tokens faster
 * @param {boolean} force - Force update even if not stale
 * @param {boolean} urgent - Urgent update (for new token detection)
 */
export async function updateTokens(force = false, urgent = false) {
  const now = Date.now();
  const maxRetries = 3;
  let lastError = null;

  // Prevent concurrent updates
  if (isUpdating) {
    console.log('⏳ Update already in progress, skipping...');
    return {
      success: false,
      message: 'Update already in progress',
      skipped: true
    };
  }

  // For urgent updates (new token detection), use shorter threshold
  const threshold = urgent ? 10 * 1000 : STALE_DATA_THRESHOLD;

  // Check if data is stale
  if (!force && now - lastUpdateTime < threshold) {
    const timeSinceLastUpdate = Math.floor((now - lastUpdateTime) / 1000);
    const timeUntilNext = Math.ceil((threshold - (now - lastUpdateTime)) / 1000);
    console.log(`ℹ️ Data is fresh (${timeSinceLastUpdate}s old). Next update in ${timeUntilNext}s`);
    return {
      success: false,
      message: `Data is fresh. Last update: ${timeSinceLastUpdate}s ago`,
      timeSinceLastUpdate,
      timeUntilNext
    };
  }

  isUpdating = true;
  console.log(`\n🔄 Starting on-demand token update (#${updateCount + 1}) at ${new Date().toISOString()}`);

  try {
    // Retry logic for robustness
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Call the seed-registry endpoint to update tokens
        const endpoint = `${getApiBaseUrl()}/api/seed-registry/supabase`;
        console.log(`🌐 Calling endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'seed' }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Unknown error from seed-registry');
        }

        // Update tracking
        lastUpdateTime = now;
        updateCount++;
        errorCount = 0;
        consecutiveErrors = 0; // Reset on success

        console.log('\n✅ On-demand update completed successfully!');
        console.log(`📊 Total tokens: ${result.totalInDatabase}`);
        console.log(`📊 With IC IDs: ${result.tokensWithICIds}`);
        console.log(`📊 Fetched from ICPSWAP: ${result.fetchedFromICPSWAP}`);
        console.log(`📊 New tokens detected: ${result.newTokensDetected}`);
        console.log(`📊 Upserted: ${result.upserted}`);
        console.log(`📊 Errors: ${result.errors}\n`);

        // If new tokens detected, trigger immediate relationship calculation
        if (result.newTokensDetected > 0) {
          console.log(`🚀 New tokens detected! Triggering relationship calculations...`);

          // Small delay to ensure DB upserts complete
          setTimeout(async () => {
            try {
              await fetch(`${getApiBaseUrl()}/api/precompute-relationships`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urgent: true }),
              });
              console.log(`✅ Relationship calculations triggered for new tokens`);
            } catch (err) {
              console.warn('⚠️ Failed to trigger relationship calculations:', err.message);
            }
          }, 2000);
        }

        return {
          success: true,
          ...result,
          updateNumber: updateCount,
          attempts: attempt,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        lastError = error;
        consecutiveErrors++;
        errorCount++;

        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);

        // Wait before retry (exponential backoff: 5s, 10s, 20s)
        if (attempt < maxRetries) {
          const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
          console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`\n💥 All ${maxRetries} attempts failed. Last error:`, lastError.message);

    return {
      success: false,
      error: lastError.message,
      updateCount: updateCount,
      errorCount: errorCount,
      consecutiveErrors,
      attempts: maxRetries,
      timestamp: new Date().toISOString()
    };
  } finally {
    isUpdating = false;
  }
}

/**
 * Start automatic background updates
 * @param {number} intervalMs - Update interval in milliseconds (default: 10 minutes)
 */
export function startBackgroundUpdates(intervalMs = UPDATE_INTERVAL) {
  console.log(`\n🚀 Starting automatic background token updates...`);
  console.log(`📅 Update interval: ${intervalMs / 1000 / 60} minutes`);
  console.log(`🌐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

  // Do an initial update
  updateTokens().then(result => {
    if (result.success) {
      console.log('✅ Initial update successful');
    } else if (!result.skipped) {
      console.log('⚠️ Initial update skipped or failed:', result.message);
    }
  });

  // Set up interval for subsequent updates
  const intervalId = setInterval(() => {
    updateTokens().catch(error => {
      console.error('💥 Unexpected error in update loop:', error);
    });
  }, intervalMs);

  // Return interval ID so it can be cleared if needed
  return intervalId;
}

/**
 * Get update status
 */
export function getUpdateStatus() {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;
  const timeUntilNext = Math.max(0, UPDATE_INTERVAL - timeSinceLastUpdate);

  return {
    isUpdating,
    lastUpdateTime,
    timeSinceLastUpdate,
    timeUntilNext,
    updateCount,
    errorCount,
    consecutiveErrors,
    nextUpdateIn: Math.ceil(timeUntilNext / 1000),
    health: consecutiveErrors === 0 ? 'healthy' : consecutiveErrors < 3 ? 'degraded' : 'unhealthy'
  };
}

/**
 * Stop automatic background updates
 * @param {number} intervalId - The interval ID returned by startBackgroundUpdates
 */
export function stopBackgroundUpdates(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('🛑 Background updates stopped');
  }
}

// Auto-start in development if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔧 Running background updater in standalone mode...\n');
  startBackgroundUpdates(5 * 60 * 1000); // 5 minutes for testing
}

import { fetchTokens } from '@/lib/icpswap-api';
import { initializeTokenRegistry, saveTokenRegistryNow, getRegistryStats, resetTokenRegistry, seedRegistryWithTokens } from '@/lib/server/token-tracker';

// API route to seed the token registry with existing tokens
// This should be called ONCE after initial setup to avoid marking all current tokens as "new"

export async function POST(request) {
  try {
    const { action, confirm } = await request.json();

    if (action === 'reset') {
      // Reset the registry (dangerous - requires explicit confirmation)
      if (confirm !== 'RESET_NOW') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'To reset the registry, you must send {"action": "reset", "confirm": "RESET_NOW"}'
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      await resetTokenRegistry();
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Token registry has been reset'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (action === 'seed') {
      // Seed the registry with current tokens without marking them as "new"
      const startTime = Date.now();
      console.log(`[${startTime}] Starting registry seeding process...`);

      // Fetch all tokens from the API
      const tokens = await fetchTokens();
      console.log(`[${Date.now()}] Fetched ${tokens.length} tokens from API`);

      // Reset the registry to empty after fetching
      console.log(`[${Date.now()}] About to reset registry...`);
      await resetTokenRegistry();
      console.log(`[${Date.now()}] Registry reset complete`);

      // Use the dedicated seeding function
      console.log(`[${Date.now()}] About to seed ${tokens.length} tokens...`);
      const addedCount = await seedRegistryWithTokens(tokens);
      console.log(`[${Date.now()}] Seeding complete, added ${addedCount} tokens`);

      // Save to disk
      await saveTokenRegistryNow();
      console.log(`[${Date.now()}] Registry saved to disk`);

      const stats = await getRegistryStats();
      console.log(`[${Date.now()}] Total in registry: ${stats.totalTokens}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Registry seeded successfully',
          data: {
            totalTokensInRegistry: stats.totalTokens,
            tokensFetched: tokens.length,
            tokensAddedDuringSeeding: addedCount,
            lastUpdated: stats.lastUpdated,
            duration: Date.now() - startTime
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (action === 'stats') {
      // Get registry statistics
      const stats = await getRegistryStats();

      return new Response(
        JSON.stringify({
          success: true,
          data: stats
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action. Supported actions: seed, reset, stats'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in seed-registry API:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Also support GET requests for stats
export async function GET() {
  try {
    const stats = await getRegistryStats();

    return new Response(
      JSON.stringify({
        success: true,
        data: stats
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error getting registry stats:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

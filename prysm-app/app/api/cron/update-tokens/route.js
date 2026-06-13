/**
 * Cron endpoint for scheduled token updates
 * This endpoint can be called by:
 * - Vercel Cron Jobs
 * - GitHub Actions
 * - External cron services
 * - Manual triggers
 */

import { updateTokens } from '@/lib/background-updater';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    console.log('🕐 Cron update triggered at', new Date().toISOString());

    const result = await updateTokens();

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('💥 Cron update failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}

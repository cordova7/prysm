/**
 * Background Updater Admin API
 * Provides endpoints to:
 * - Start/stop background updates
 * - Get update status
 * - Manually trigger an update
 * - Configure update interval
 */

import { getUpdateStatus, startBackgroundUpdates, stopBackgroundUpdates } from '@/lib/background-updater';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Store the interval ID globally (in production, use a proper job queue)
let globalIntervalId = null;

export async function GET() {
  try {
    const status = getUpdateStatus();

    return new Response(
      JSON.stringify({
        success: true,
        status,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('Error getting updater status:', error);

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

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, interval } = body;

    if (action === 'start') {
      if (globalIntervalId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Background updater already running',
            intervalId: globalIntervalId
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const intervalMs = interval || 10 * 60 * 1000; // 10 minutes default
      globalIntervalId = startBackgroundUpdates(intervalMs);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Background updater started',
          intervalId: globalIntervalId,
          intervalMs,
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } else if (action === 'stop') {
      if (!globalIntervalId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Background updater is not running'
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      stopBackgroundUpdates(globalIntervalId);
      globalIntervalId = null;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Background updater stopped',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid action. Use: start, stop'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error in background updater admin:', error);

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

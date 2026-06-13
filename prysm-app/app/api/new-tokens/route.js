import { getNewTokens } from '@/lib/server/token-tracker';

// API route to get specifically new tokens
// This returns tokens from the registry that were first seen within the specified timeframe
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // Get tokens that have been identified as new
    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const newTokens = await getNewTokens(sinceDate);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: newTokens,
        count: newTokens.length,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // Don't cache new tokens
        }
      }
    );
  } catch (error) {
    console.error('Error in new tokens API route:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
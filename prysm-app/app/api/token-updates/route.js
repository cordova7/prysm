// Real-time notification service using Server-Sent Events (SSE)
// This will provide real-time updates when new tokens are detected

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lastEventId = searchParams.get('lastEventId') || 0;

  // Set headers for SSE
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  };

  // Create a readable stream for the SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial event
      controller.enqueue(`data: {"type": "connected", "message": "Connected to token alert service"}\n\n`);

      // Set up interval to check for new tokens
      const interval = setInterval(async () => {
        try {
          // Check for new tokens since last check
          const response = await fetch(`${request.nextUrl.origin}/api/new-tokens`);
          if (response.ok) {
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
              // Send new token alerts
              for (const token of data.data) {
                const message = {
                  type: 'new_token',
                  token: {
                    id: token.tokenLedgerId,
                    name: token.name,
                    symbol: token.symbol,
                    price: token.price,
                  },
                  timestamp: new Date().toISOString()
                };
                
                controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
              }
            }
          }
        } catch (error) {
          console.error('Error checking for new tokens:', error);
          const errorMessage = {
            type: 'error',
            message: error.message
          };
          controller.enqueue(`data: ${JSON.stringify(errorMessage)}\n\n`);
        }
      }, 30000); // Check every 30 seconds

      // Handle connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, { headers });
}
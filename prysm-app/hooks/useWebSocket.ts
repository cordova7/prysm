import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketOptions {
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useWebSocket = (url: string, options: WebSocketOptions = {}) => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();

  const connect = () => {
    try {
      setConnectionStatus('connecting');
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'new_token') {
            // Update tokens query cache with new token
            queryClient.setQueryData(['tokens'], (old: any) => {
              if (!old) return [data.token];
              // Check if token already exists
              const exists = old.some((t: any) => t.tokenLedgerId === data.token.tokenLedgerId);
              if (!exists) {
                return [data.token, ...old];
              }
              return old;
            });
          } else if (data.type === 'token_update') {
            // Update specific token data
            queryClient.setQueryData(['token', data.tokenId], data.token);
          }

          onMessage?.(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        onError?.(error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onDisconnect?.();

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setTimeout(() => {
            console.log(`Reconnecting... Attempt ${reconnectAttempts.current}`);
            connect();
          }, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  };

  const send = (data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    connectionStatus,
    send,
    disconnect,
    reconnect: connect,
  };
};

// Alternative polling-based real-time for ICPSwap (optimized with throttling)
export const useRealTimeTokenUpdates = (intervalMs: number = 30000) => {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);
  const lastSeenLastUpdatedRef = useRef<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    let canceled = false;

    const poll = async () => {
      try {
        const response = await fetch('/api/tokens/last-updated', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json();
        const lastUpdated = payload?.lastUpdated ?? null;

        if (canceled) return;

        if (lastUpdated && lastSeenLastUpdatedRef.current && lastUpdated !== lastSeenLastUpdatedRef.current) {
          queryClient.invalidateQueries({ queryKey: ['tokens'] });
        }

        lastSeenLastUpdatedRef.current = lastUpdated;
      } catch {
        // Silent fail: fall back to existing React Query refetch intervals
      }
    };

    setIsPolling(true);
    poll(); // immediate check
    pollingRef.current = window.setInterval(poll, intervalMs);

    return () => {
      canceled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setIsPolling(false);
    };
  }, [intervalMs, queryClient]);

  return {
    isPolling,
  };
};

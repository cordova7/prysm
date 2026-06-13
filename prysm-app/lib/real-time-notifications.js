/**
 * Real-time Token Auto-Refresh
 * Uses Supabase Realtime to automatically refresh the token list when new tokens are added
 * This keeps the website showing the latest tokens in real-time!
 */

import { supabase } from './supabase.js';

let isListening = false;
let refreshCallback = null;
let hasInitialHydration = false;

/**
 * Subscribe to new tokens and auto-refresh the token list
 * @param {Function} onNewToken - Callback that refreshes the token list
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNewTokens(onNewToken) {
  if (!isListening) {
    startListening();
  }

  refreshCallback = onNewToken;

  // Return unsubscribe function
  return () => {
    refreshCallback = null;
    if (!refreshCallback) {
      stopListening();
    }
  };
}

function startListening() {
  console.log('🔄 Starting real-time token auto-refresh...');

  // Subscribe to changes on the tokens table
  const channel = supabase
    .channel('tokens-channel')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to ALL events: INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'tokens'
      },
      (payload) => {
        const eventType = payload.eventType;
        const token = payload.new || payload.old;
        const tokenId = token?.token_ledger_id;

        // Only trigger updates after initial hydration to prevent hydration mismatches
        if (!hasInitialHydration) {
          hasInitialHydration = true;
          console.log('✅ Initial hydration complete, enabling real-time updates');
          return;
        }

        if (eventType === 'INSERT') {
          console.log('🆕 New token detected:', tokenId);
        } else if (eventType === 'UPDATE') {
          console.log('🔄 Token updated:', tokenId);
        }

        // Trigger token list refresh for any change
        if (refreshCallback && token) {
          refreshCallback(token);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Real-time subscription active - will auto-refresh on all token changes');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Real-time subscription error');
      } else if (status === 'TIMED_OUT') {
        console.warn('⏰ Real-time subscription timed out');
      }
    });

  isListening = true;
  startListening.channel = channel;
}

function stopListening() {
  if (startListening.channel) {
    console.log('🔕 Stopping real-time token auto-refresh');
    supabase.removeChannel(startListening.channel);
    isListening = false;
  }
}

/**
 * Check if real-time is active
 */
export function isRealtimeActive() {
  return isListening;
}

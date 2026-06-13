/**
 * Custom Hook: Auto Token Refresh
 * Automatically checks for new tokens every 180 seconds when user is active
 * Optimized for Vercel free tier - minimal serverless function invocations
 * Works without cron jobs - purely client-driven
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAutoTokenRefresh() {
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);

  // Check if user is active (has moved mouse or clicked in last 60 seconds)
  const isUserActive = () => {
    return Date.now() - lastUserActivity < 60000;
  };

  let lastUserActivity = Date.now();

  // Track user activity
  useEffect(() => {
    const updateActivity = () => {
      lastUserActivity = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, []);

  // Start auto-refresh
  const startRefresh = () => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      // Only refresh if user is active and not currently refreshing
      if (isUserActive() && !isRefreshing) {
        await checkForNewTokens();
      }
    }, 180000); // Every 180 seconds (3 minutes) - optimized for Vercel free tier
  };

  // Stop auto-refresh
  const stopRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Check for new tokens
  const checkForNewTokens = async () => {
    setIsRefreshing(true);

    try {
      // Call the seed-registry endpoint to check for updates
      const response = await fetch('/api/seed-registry/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'seed' }),
      });

      if (response.ok) {
        const result = await response.json();

        // Only invalidate queries if new tokens were detected
        // This prevents unnecessary re-renders
        if (result.newTokensDetected > 0) {
          console.log(`🔄 ${result.newTokensDetected} new tokens detected, updating UI...`);
          queryClient.invalidateQueries({ queryKey: ['tokens'] });
          queryClient.invalidateQueries({ queryKey: ['homepageTokens'] });
          queryClient.invalidateQueries({ queryKey: ['newTokens'] });
        } else {
          console.log('ℹ️ No new tokens detected');
        }

        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error checking for new tokens:', error);
      // Don't throw - we don't want to break the UI for network errors
    } finally {
      setIsRefreshing(false);
    }
  };

  // Manual refresh trigger
  const manualRefresh = async () => {
    await checkForNewTokens();
  };

  // Start auto-refresh on mount
  useEffect(() => {
    // Wait 10 seconds before first check (gives time for initial page load)
    const timer = setTimeout(() => {
      startRefresh();
    }, 10000);

    // Check user activity every 10 seconds
    const activityCheck = setInterval(() => {
      if (isUserActive() && !intervalRef.current) {
        startRefresh();
      } else if (!isUserActive() && intervalRef.current) {
        // Stop refresh when user is inactive (saves resources)
        stopRefresh();
      }
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearInterval(activityCheck);
      stopRefresh();
    };
  }, []);

  return {
    isRefreshing,
    lastUpdate,
    updateCount,
    manualRefresh,
    startRefresh,
    stopRefresh,
  };
}
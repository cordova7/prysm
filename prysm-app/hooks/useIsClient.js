/**
 * Hook to detect if code is running on the client side
 * Prevents SSR hydration mismatches and handles SES conflicts
 */

import { useState, useEffect } from 'react';

export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark that we're on the client
    setIsClient(true);

    // Wait for hydration to complete
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return { isClient, isHydrated };
}

/**
 * Hook to check if browser APIs are available
 * Useful for handling SES (Secure EcmaScript) conflicts
 */
export function useBrowserAPIs() {
  const [apis, setApis] = useState({
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
    serviceWorker: false,
    window: false,
    document: false
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      setApis({
        localStorage: false,
        sessionStorage: false,
        indexedDB: false,
        serviceWorker: false,
        window: false,
        document: false
      });
      return;
    }

    setApis({
      localStorage: typeof window.localStorage !== 'undefined',
      sessionStorage: typeof window.sessionStorage !== 'undefined',
      indexedDB: typeof window.indexedDB !== 'undefined',
      serviceWorker: typeof navigator.serviceWorker !== 'undefined',
      window: typeof window !== 'undefined',
      document: typeof document !== 'undefined'
    });
  }, []);

  return apis;
}

/**
 * Hook to safely use localStorage
 * Handles SSR and SES conflicts
 */
export function useSafeLocalStorage(key, initialValue = null) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const { isClient } = useIsClient();

  useEffect(() => {
    if (!isClient) return;

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key, isClient]);

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (isClient) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

/**
 * Check if code is running in a secure context
 * Useful for detecting SES or hardened JS environments
 */
export function isSecureContext() {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || false;
}

/**
 * Safely execute code that might fail due to SES or browser restrictions
 */
export function safeExecute(fn, fallback = null) {
  try {
    return fn();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Safe execute failed:', error);
    }
    return fallback;
  }
}

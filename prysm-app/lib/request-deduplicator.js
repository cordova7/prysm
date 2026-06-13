/**
 * Global Request Deduplicator
 * Prevents duplicate API calls for the same resource
 * Useful for reducing API calls in React components
 */

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
    this.cache = new Map();
    this.cacheTTL = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cache key for request
   */
  getCacheKey(url, options = {}) {
    return `${url}:${JSON.stringify(options)}`;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(key) {
    if (!this.cacheTTL.has(key)) return false;
    return Date.now() - this.cacheTTL.get(key) < this.defaultTTL;
  }

  /**
   * Execute a request with deduplication
   */
  async deduplicate(url, options = {}, fetcher, ttl = this.defaultTTL) {
    const key = this.getCacheKey(url, options);

    // Return cached result if valid
    if (this.cache.has(key) && this.isCacheValid(key)) {
      return this.cache.get(key);
    }

    // Return pending request if already in progress
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create new request
    const request = (async () => {
      try {
        const result = await fetcher(url, options);

        // Cache successful results
        if (result !== null && result !== undefined) {
          this.cache.set(key, result);
          this.cacheTTL.set(key, Date.now());
        }

        return result;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, request);
    return request;
  }

  /**
   * Preload multiple requests
   */
  async preload(urls, fetcher, ttl = this.defaultTTL) {
    const results = await Promise.all(
      urls.map(url => this.deduplicate(url, {}, fetcher, ttl))
    );
    return results;
  }

  /**
   * Clear cache for specific URL pattern
   */
  clearCache(pattern) {
    const regex = new RegExp(pattern);
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.cacheTTL.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    this.cache.clear();
    this.cacheTTL.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
const requestDeduplicator = new RequestDeduplicator();

export default requestDeduplicator;

/**
 * React hook for request deduplication
 */
export function useRequestDeduplicator() {
  return requestDeduplicator;
}

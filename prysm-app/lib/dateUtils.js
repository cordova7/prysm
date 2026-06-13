/**
 * UTC Date Utilities
 * Provides consistent UTC date/time handling across the application
 */

import { format } from 'date-fns';

/**
 * Convert timestamp to epoch milliseconds
 * Ensures we always work with milliseconds, not seconds
 * @param {number|string} timestamp - Timestamp in seconds or milliseconds
 * @returns {number} Timestamp in milliseconds
 */
export const toEpochMillis = (timestamp) => {
  if (!timestamp) return 0;

  const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;

  // If timestamp is in seconds (less than 10 billion), convert to milliseconds
  if (numTimestamp < 10000000000) {
    return numTimestamp * 1000;
  }

  // Already in milliseconds
  return numTimestamp;
};

/**
 * Format timestamp for chart labels (compact)
 * Example: "Nov 16, 2025 10:30"
 * @param {number} timestamp - Epoch milliseconds
 * @returns {string} Formatted date string
 */
export const formatUTC = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return format(date, 'MMM dd, yyyy HH:mm');
};

/**
 * Format timestamp for tooltips (full)
 * Example: "November 16, 2025 10:30:45 UTC"
 * @param {number} timestamp - Epoch milliseconds
 * @returns {string} Formatted date string with UTC indicator
 */
export const formatFullUTC = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return format(date, 'MMMM dd, yyyy HH:mm:ss \'UTC\'');
};

/**
 * Format timestamp for display (date only)
 * Example: "Nov 16, 2025"
 * @param {number} timestamp - Epoch milliseconds
 * @returns {string} Formatted date string
 */
export const formatDateUTC = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return format(date, 'MMM dd, yyyy');
};

/**
 * Format timestamp for time axis
 * Example: "2025-11-16 10:30:00 UTC"
 * @param {number} timestamp - Epoch milliseconds
 * @returns {string} ISO-like formatted string
 */
export const formatTimeUTC = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return format(date, 'yyyy-MM-dd HH:mm:ss');
};

/**
 * Parse chart API response to standardized format
 * Ensures all timestamps are in epoch milliseconds
 * @param {Object} apiData - Raw API response
 * @returns {Array} Formatted chart data
 */
export const parseChartData = (apiData) => {
  if (!apiData || !apiData.data) return [];

  return apiData.data.map((item) => {
    // Ensure timestamp is in milliseconds
    const timestamp = toEpochMillis(item.snapshotTime);

    return {
      x: timestamp, // Chart.js expects milliseconds for time scale
      y: item.price || 0,
      volume: item.volume || 0,
      high: item.high || 0,
      low: item.low || 0,
      open: item.open || 0,
      close: item.close || 0,
      timestamp: timestamp, // Keep original for reference
    };
  });
};

/**
 * Calculate time range from chart data
 * @param {Array} chartData - Chart data points
 * @returns {Object} { minTime, maxTime }
 */
export const getTimeRange = (chartData) => {
  if (!chartData || chartData.length === 0) {
    return { minTime: 0, maxTime: 0 };
  }

  const timestamps = chartData.map((item) => toEpochMillis(item.x || item.timestamp));
  return {
    minTime: Math.min(...timestamps),
    maxTime: Math.max(...timestamps),
  };
};

/**
 * Format duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "5m 30s")
 */
export const formatDuration = (milliseconds) => {
  if (!milliseconds) return '0s';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || '0s';
};

/**
 * Get current UTC timestamp
 * @returns {number} Current time in epoch milliseconds
 */
export const getCurrentUTC = () => {
  return Date.now();
};

/**
 * Check if timestamp is within a specific time range
 * @param {number} timestamp - Timestamp to check
 * @param {string} range - Time range (e.g., '24h', '7d', '30d')
 * @returns {boolean} True if within range
 */
export const isWithinRange = (timestamp, range) => {
  if (!timestamp) return false;

  const now = getCurrentUTC();
  const time = toEpochMillis(timestamp);
  const ranges = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };

  const rangeMs = ranges[range] || ranges['24h'];
  return now - time <= rangeMs;
};

/**
 * Format number as currency
 * @param {number} value - Numeric value
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = 'USD') => {
  if (value === undefined || value === null) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
};

/**
 * Format number with commas
 * @param {number} value - Numeric value
 * @returns {string} Formatted number string
 */
export const formatNumber = (value) => {
  if (value === undefined || value === null) return '0';

  return new Intl.NumberFormat('en-US').format(value);
};
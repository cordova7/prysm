/**
 * Simple logging utility
 * Automatically strips console logs in production
 */

const logger = {
  log: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },

  info: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },

  warn: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },

  error: (...args) => {
    // Always log errors
    console.error(...args);
  },

  debug: (...args) => {
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default logger;

/**
 * Logging Utility
 * Provides structured logging with levels, context, and external service integration
 */

// ============================================================================
// Log Levels
// ============================================================================

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// ============================================================================
// Logger Configuration
// ============================================================================

class Logger {
  constructor() {
    this.level = this.getLogLevel();
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isClient = typeof window !== 'undefined';
  }

  getLogLevel() {
    const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.NODE_ENV;

    if (envLevel === 'development') return LogLevel.DEBUG;
    if (envLevel === 'production') return LogLevel.WARN;

    switch (envLevel?.toUpperCase()) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'NONE':
        return LogLevel.NONE;
      default:
        return LogLevel.INFO;
    }
  }

  shouldLog(level) {
    return level >= this.level;
  }

  formatMessage(level, context, message, data = {}) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LogLevel).find(key => LogLevel[key] === level);

    return {
      timestamp,
      level: levelName,
      context,
      message,
      ...(Object.keys(data).length > 0 && { data }),
      ...(this.isClient && { userAgent: navigator.userAgent }),
    };
  }

  logToConsole(level, formattedMessage) {
    const { timestamp, level: levelName, context, message, data } = formattedMessage;

    // Color codes for different log levels
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
    };

    const reset = '\x1b[0m';
    const color = colors[levelName] || '';

    if (this.isDevelopment) {
      // Pretty print in development
      const prefix = `${color}[${levelName}]${reset} ${timestamp} ${context ? `[${context}]` : ''}`;
      console.log(`${prefix} ${message}`);

      if (data && Object.keys(data).length > 0) {
        console.log('  Data:', data);
      }
    } else {
      // Structured logging in production
      console.log(JSON.stringify(formattedMessage));
    }
  }

  logToExternalService(level, formattedMessage) {
    // TODO: Integrate with external logging service
    // Examples: Sentry, Datadog, Logtail, etc.

    /*
    if (level >= LogLevel.ERROR) {
      // Send errors to Sentry
      if (window.Sentry) {
        Sentry.captureMessage(formattedMessage.message, {
          level: 'error',
          contexts: {
            logger: formattedMessage,
          },
        });
      }
    }
    */
  }

  log(level, context, message, data = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, context, message, data);

    // Log to console
    this.logToConsole(level, formattedMessage);

    // Log to external service in production
    if (!this.isDevelopment) {
      this.logToExternalService(level, formattedMessage);
    }
  }

  // Public API methods

  /**
   * Debug level logging (verbose, development only)
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  debug(context, message, data = {}) {
    this.log(LogLevel.DEBUG, context, message, data);
  }

  /**
   * Info level logging (general information)
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  info(context, message, data = {}) {
    this.log(LogLevel.INFO, context, message, data);
  }

  /**
   * Warning level logging
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  warn(context, message, data = {}) {
    this.log(LogLevel.WARN, context, message, data);
  }

  /**
   * Error level logging
   * @param {string} context - Context/module name
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or additional data
   */
  error(context, message, error = {}) {
    const errorData = error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: this.isDevelopment ? error.stack : undefined,
          ...error,
        }
      : error;

    this.log(LogLevel.ERROR, context, message, errorData);
  }

  /**
   * Performance logging
   * @param {string} context - Context/module name
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  perf(context, operation, duration, metadata = {}) {
    this.info(context, `Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...metadata,
    });
  }

  /**
   * API request logging
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {number} status - Response status code
   * @param {number} duration - Request duration in ms
   */
  apiRequest(method, url, status, duration) {
    const level = status >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, 'API', `${method} ${url}`, {
      method,
      url,
      status,
      duration: `${duration}ms`,
    });
  }

  /**
   * Create a child logger with a fixed context
   * @param {string} context - Fixed context for all logs
   * @returns {Object} Logger instance with fixed context
   */
  createContext(context) {
    return {
      debug: (message, data) => this.debug(context, message, data),
      info: (message, data) => this.info(context, message, data),
      warn: (message, data) => this.warn(context, message, data),
      error: (message, error) => this.error(context, message, error),
      perf: (operation, duration, metadata) => this.perf(context, operation, metadata),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

const logger = new Logger();

export default logger;

// ============================================================================
// Convenience Exports
// ============================================================================

export const debug = (context, message, data) => logger.debug(context, message, data);
export const info = (context, message, data) => logger.info(context, message, data);
export const warn = (context, message, data) => logger.warn(context, message, data);
export const error = (context, message, err) => logger.error(context, message, err);
export const perf = (context, operation, duration, metadata) =>
  logger.perf(context, operation, duration, metadata);
export const apiRequest = (method, url, status, duration) =>
  logger.apiRequest(method, url, status, duration);
export const createContext = (context) => logger.createContext(context);

// ============================================================================
// Performance Monitoring Helpers
// ============================================================================

/**
 * Time a function execution
 * @param {string} context - Context/module name
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to time
 * @returns {Promise<any>} Function result
 */
export async function timeAsync(context, operation, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.perf(context, operation, duration, { success: true });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.perf(context, operation, duration, { success: false, error: error.message });
    throw error;
  }
}

/**
 * Time a synchronous function execution
 * @param {string} context - Context/module name
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to time
 * @returns {any} Function result
 */
export function timeSync(context, operation, fn) {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    logger.perf(context, operation, duration, { success: true });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.perf(context, operation, duration, { success: false, error: error.message });
    throw error;
  }
}

/**
 * Create a performance timer
 * @param {string} context - Context/module name
 * @param {string} operation - Operation name
 * @returns {Object} Timer object with end() method
 */
export function createTimer(context, operation) {
  const start = performance.now();
  return {
    end: (metadata = {}) => {
      const duration = performance.now() - start;
      logger.perf(context, operation, duration, metadata);
      return duration;
    },
  };
}

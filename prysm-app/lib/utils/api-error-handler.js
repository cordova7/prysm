/**
 * API Error Handler
 * Centralized error handling for API calls
 */

/**
 * API Error class
 */
export class APIError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Handle API errors consistently
 */
export function handleAPIError(error, context = '') {
  // Network errors
  if (!error.response) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection.',
      error,
      recoverable: true
    };
  }

  const { status, data } = error.response;

  // Handle different status codes
  switch (status) {
    case 400:
      return {
        type: 'bad_request',
        message: data?.message || 'Bad request',
        error,
        recoverable: false
      };

    case 401:
      return {
        type: 'unauthorized',
        message: 'Unauthorized. Please log in again.',
        error,
        recoverable: true
      };

    case 403:
      return {
        type: 'forbidden',
        message: 'You do not have permission to perform this action.',
        error,
        recoverable: false
      };

    case 404:
      return {
        type: 'not_found',
        message: data?.message || 'Resource not found.',
        error,
        recoverable: false
      };

    case 429:
      return {
        type: 'rate_limited',
        message: 'Too many requests. Please try again later.',
        error,
        recoverable: true,
        retryAfter: error.response.headers?.['retry-after']
      };

    case 500:
      return {
        type: 'server_error',
        message: 'Server error. Please try again later.',
        error,
        recoverable: true
      };

    case 502:
    case 503:
    case 504:
      return {
        type: 'unavailable',
        message: 'Service unavailable. Please try again later.',
        error,
        recoverable: true
      };

    default:
      return {
        type: 'unknown',
        message: data?.message || error.message || 'An unexpected error occurred.',
        error,
        recoverable: false
      };
  }
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling(fn, context = '') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const handledError = handleAPIError(error, context);
      console.error(`Error in ${context}:`, handledError);
      throw new APIError(
        handledError.message,
        error.response?.status,
        handledError.type,
        handledError
      );
    }
  };
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      const errorInfo = handleAPIError(error);
      return errorInfo.recoverable;
    }
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      if (!shouldRetry(error)) {
        break;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Log error to monitoring service (placeholder)
 */
export function logError(error, context = '') {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error in ${context}`);
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.groupEnd();
  }

  // In production, send to monitoring service
  // e.g., Sentry, LogRocket, etc.
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error) {
  const errorInfo = handleAPIError(error);
  return errorInfo.recoverable;
}

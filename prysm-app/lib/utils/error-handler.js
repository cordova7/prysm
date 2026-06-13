/**
 * Standardized Error Handling Utility
 * Provides consistent error handling, logging, and response formatting
 */

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base API Error class
 */
// Custom error handler with support for context and user feedback
// Provides structured error handling with different severity levels
// Compatible with both client-side and server-side code

import * as Sentry from '@sentry/nextjs';

export class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture error in Sentry if DSN is configured (optional - no account needed!)
    if (typeof Sentry !== 'undefined' && (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) {
      try {
        Sentry.captureException(this, {
          tags: {
            errorCode: code,
            statusCode: statusCode.toString(),
          },
          extra: {
            details,
            timestamp: this.timestamp,
          },
        });
      } catch (sentryError) {
        // Silently fail if Sentry isn't initialized
        console.warn('Sentry capture failed:', sentryError);
      }
    }
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      status: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Network/Fetch related errors
 */
export class NetworkError extends APIError {
  constructor(message, details = null) {
    super(message, 0, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends APIError {
  constructor(message = 'Request timeout', details = null) {
    super(message, 408, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
  }
}

/**
 * Validation errors (4xx)
 */
export class ValidationError extends APIError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends APIError {
  constructor(resource = 'Resource', details = null) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

/**
 * Server errors (5xx)
 */
export class ServerError extends APIError {
  constructor(message, details = null) {
    super(message, 500, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}

// ============================================================================
// Fetch Wrapper with Timeout and Error Handling
// ============================================================================

/**
 * Enhanced fetch with timeout, retry, and standardized error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @param {AbortSignal} options.signal - External abort signal
 * @param {number} options.retries - Number of retries (default: 0)
 * @param {Function} options.shouldRetry - Custom retry logic
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}) {
  const {
    timeout = 10000,
    signal: externalSignal,
    retries = 0,
    shouldRetry = defaultShouldRetry,
    ...fetchOptions
  } = options;

  let lastError;
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine external signal with timeout signal
      const combinedSignal = externalSignal
        ? combineAbortSignals([externalSignal, controller.signal])
        : controller.signal;

      // Perform fetch
      const response = await fetch(url, {
        ...fetchOptions,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Check if we should retry based on response
      if (!response.ok && attempt < maxAttempts && shouldRetry(response, attempt)) {
        lastError = new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          `HTTP_${response.status}`
        );
        await delay(getRetryDelay(attempt));
        continue;
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new APIError('Request cancelled', 0, 'CANCELLED');
        }
        throw new TimeoutError(`Request timeout after ${timeout}ms`, { url, timeout });
      }

      lastError = new NetworkError(error.message, { url, originalError: error.message });

      // Retry on network errors
      if (attempt < maxAttempts) {
        await delay(getRetryDelay(attempt));
        continue;
      }
    }
  }

  throw lastError;
}

/**
 * Default retry logic - retry on 5xx and network errors, not on 4xx
 */
function defaultShouldRetry(response, attempt) {
  if (!response) return true; // Network error
  return response.status >= 500 && response.status < 600;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Combine multiple abort signals
 */
function combineAbortSignals(signals) {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort());
  }

  return controller.signal;
}

// ============================================================================
// Response Parsers
// ============================================================================

/**
 * Parse JSON response with error handling
 */
export async function parseJSONResponse(response, context = 'API') {
  if (!response.ok) {
    let errorMessage = `${context} request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }

    const statusCode = response.status;
    if (statusCode >= 400 && statusCode < 500) {
      throw new ValidationError(errorMessage, { status: statusCode });
    } else if (statusCode >= 500) {
      throw new ServerError(errorMessage, { status: statusCode });
    }

    throw new APIError(errorMessage, statusCode);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new APIError('Invalid JSON response', 500, 'PARSE_ERROR', {
      originalError: error.message,
    });
  }
}

/**
 * Validate API response code (for APIs that use { code, data, message } format)
 */
export function validateAPIResponseCode(data, expectedCode = 200, context = 'API') {
  if (!data || typeof data !== 'object') {
    throw new ServerError(`${context} returned invalid response format`);
  }

  if (data.code !== expectedCode) {
    const message = data.message || `${context} returned error code ${data.code}`;
    throw new ServerError(message, { code: data.code, data });
  }

  return data.data;
}

// ============================================================================
// Error Handlers
// ============================================================================

/**
 * Handle errors in API routes (Next.js)
 */
export function handleAPIError(error, context = 'API') {
  // If it's already an APIError, use it
  if (error instanceof APIError) {
    return {
      error: error.toJSON(),
      status: error.statusCode || 500,
    };
  }

  // Convert unknown errors to ServerError
  console.error(`${context} error:`, error);
  const serverError = new ServerError(
    error.message || 'An unexpected error occurred',
    { originalError: error.toString() }
  );

  return {
    error: serverError.toJSON(),
    status: 500,
  };
}

/**
 * Create an error response for API routes
 */
export function createErrorResponse(error, context = 'API') {
  const { error: errorData, status } = handleAPIError(error, context);

  return Response.json(errorData, { status });
}

/**
 * Handle errors in client-side code (React components, hooks)
 */
export function handleClientError(error, context = 'Client') {
  if (error instanceof APIError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  console.error(`${context} error:`, error);
  return {
    message: error.message || 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    details: null,
  };
}

// ============================================================================
// Success Response Formatters
// ============================================================================

/**
 * Create standardized success response
 */
export function createSuccessResponse(data, options = {}) {
  const response = {
    data,
  };

  // Add pagination if provided
  if (options.pagination) {
    response.pagination = {
      page: options.pagination.page,
      limit: options.pagination.limit,
      total: options.pagination.total,
      hasMore: options.pagination.hasMore,
    };
  }

  // Add metadata
  response.meta = {
    timestamp: new Date().toISOString(),
    cached: options.cached || false,
    ...options.meta,
  };

  return response;
}

/**
 * Create success JSON response for API routes
 */
export function createSuccessJSONResponse(data, options = {}) {
  return Response.json(
    createSuccessResponse(data, options),
    { status: options.status || 200 }
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  if (error instanceof NetworkError) return true;
  if (error instanceof TimeoutError) return true;
  if (error instanceof ServerError) return true;
  if (error instanceof APIError && error.statusCode >= 500) return true;
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
  if (error instanceof TimeoutError) {
    return 'Request timed out. Please try again.';
  }
  if (error instanceof NetworkError) {
    return 'Network error. Please check your connection.';
  }
  if (error instanceof NotFoundError) {
    return error.message;
  }
  if (error instanceof ValidationError) {
    return error.message;
  }
  if (error instanceof ServerError) {
    return 'Server error. Please try again later.';
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log error with context
 */
export function logError(error, context = '', additionalData = {}) {
  const errorInfo = {
    context,
    message: error.message,
    name: error.name,
    ...(error instanceof APIError && {
      code: error.code,
      status: error.statusCode,
      details: error.details,
    }),
    ...additionalData,
    timestamp: new Date().toISOString(),
  };

  // In development, log full details
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', errorInfo);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } else {
    // In production, log to error reporting service
    // TODO: Integrate with Sentry or other error reporting service
    console.error('Error:', JSON.stringify(errorInfo));
  }

  return errorInfo;
}

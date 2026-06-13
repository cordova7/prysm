/**
 * React Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree
 */

'use client';

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary caught an error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }

    // Capture error in Sentry (if available)
    try {
      const sentry = globalThis?.Sentry;
      if (sentry && typeof sentry.captureException === 'function') {
        sentry.captureException(error, {
          tags: {
            component: 'ErrorBoundary',
          },
          extra: {
            errorInfo,
          },
        });
      }
    } catch (e) {
      // ignore
    }

    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Customize error UI based on props
      const { fallback: Fallback, onError } = this.props;

      // If custom fallback UI is provided, use it
      if (Fallback) {
        return (
          <Fallback
            error={this.state.error}
            resetError={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          />
        );
      }

      // Default error UI
      return (
        <div className="error-boundary min-h-screen flex items-center justify-center bg-[#2a2a27]">
          <div className="text-center p-8 max-w-md">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-[#f6fdff] text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-6">
              We apologize for the inconvenience. The application encountered an unexpected error.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-[#f6fdff] hover:bg-[#e7eef0] text-[#161614] font-medium py-2 px-4 rounded-lg transition duration-200"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="w-full bg-[#2a2a27] hover:bg-[#2a2a27] text-[#f6fdff] font-medium py-2 px-4 rounded-lg transition duration-200"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-gray-400 cursor-pointer mb-2">Error Details (Dev Mode)</summary>
                <pre className="text-xs text-red-500 bg-[#2a2a27] p-4 rounded overflow-auto max-h-60">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary(Component, fallback) {
  const WrappedComponent = (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

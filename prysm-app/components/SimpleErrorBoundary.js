/**
 * Simple Client-Side Error Boundary
 * Lightweight error boundary for individual components
 */

'use client';

export default function SimpleErrorBoundary({ children, fallback = null }) {
  return (
    <ErrorBoundaryWrapper fallback={fallback}>
      {children}
    </ErrorBoundaryWrapper>
  );
}

class ErrorBoundaryWrapper extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="text-center p-4 text-gray-400">
          <p>Unable to load this component</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-gray-400 hover:text-gray-400 underline mt-2"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

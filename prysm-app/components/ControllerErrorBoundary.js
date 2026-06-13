/**
 * Error Boundary for ControllerPopup
 * Prevents errors in controller hover functionality from crashing the entire component tree
 */

'use client';

import { Component } from 'react';

export default class ControllerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('ControllerPopup Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI - simple controller display without relationships
      const { controller, children, fallbackComponent: FallbackComponent } = this.props;

      if (FallbackComponent) {
        return <FallbackComponent controller={controller} />;
      }

      // Default fallback - just show the controller without popup
      return (
        <div
          className="group relative flex items-center justify-between rounded p-1.5 transition-all text-gray-500 hover:bg-[#2a2a27]/20"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          data-controller-popup-trigger="true"
        >
          <p className="text-xs font-mono">
            {controller}
          </p>
          <div className="text-[10px] text-gray-600">⚠</div>
        </div>
      );
    }

    return this.props.children;
  }
}

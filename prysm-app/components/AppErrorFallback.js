/**
 * App Error Fallback UI
 * Used by ErrorBoundary to display error state
 */

'use client';

export default function AppErrorFallback({ error, resetError }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#161614]">
      <div className="max-w-md w-full bg-[#232320] rounded-lg p-6 border border-[#2a2a27]">
        <h2 className="text-xl font-light text-[#f6fdff] mb-2">App Error</h2>
        <p className="text-sm text-gray-400 mb-4">
          The app encountered an error and is recovering...
        </p>
        <button
          onClick={resetError}
          className="w-full bg-[#f6fdff] hover:bg-[#e7eef0] text-[#161614] font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Recover
        </button>
      </div>
    </div>
  );
}

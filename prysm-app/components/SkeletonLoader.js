'use client';

export function TokenListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-bg-card)] rounded-lg p-6 border border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[var(--color-bg-card)] rounded-full"></div>
              <div>
                <div className="h-5 bg-[var(--color-bg-card)] rounded w-24 mb-2"></div>
                <div className="h-4 bg-[var(--color-bg-secondary)]/60 rounded w-16"></div>
              </div>
            </div>

            <div className="text-right">
              <div className="h-6 bg-[var(--color-bg-card)] rounded w-20 mb-2"></div>
              <div className="h-4 bg-[var(--color-bg-secondary)]/60 rounded w-16 ml-auto"></div>
            </div>

            <div className="w-24 h-8 bg-[var(--color-bg-card)] rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TokenGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 animate-pulse">
      {Array.from({ length: 48 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tile-3)]/40 p-2"
        >
          <div className="flex items-start justify-between">
            <div className="h-3 w-12 rounded bg-[var(--color-bg-card)]" />
            <div className="h-3 w-6 rounded bg-[var(--color-bg-card)]" />
          </div>
          <div className="mt-3 h-4 w-20 rounded bg-[var(--color-bg-card)]" />
          <div className="mt-2 flex items-center justify-between">
            <div className="h-3 w-10 rounded bg-[var(--color-bg-card)]" />
            <div className="h-3 w-12 rounded bg-[var(--color-bg-card)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TokenCardSkeleton() {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-lg p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-[var(--color-bg-card)] rounded-full"></div>
          <div>
            <div className="h-5 bg-[var(--color-bg-card)] rounded w-24 mb-2"></div>
            <div className="h-4 bg-[var(--color-bg-card)] rounded w-16"></div>
          </div>
        </div>

        <div className="text-right">
          <div className="h-6 bg-[var(--color-bg-card)] rounded w-20 mb-2"></div>
          <div className="h-4 bg-[var(--color-bg-card)] rounded w-16 ml-auto"></div>
        </div>

        <div className="w-24 h-8 bg-[var(--color-bg-card)] rounded"></div>
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-2 border-[var(--color-text)] rounded-full animate-spin"></div>
          <div className="absolute top-2 left-2 w-12 h-12 border-2 border-[var(--color-primary)] rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
        </div>
        <p className="text-xl text-[var(--color-text)] font-light">
          Loading PRYSM...
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Preparing your trading interface
        </p>
      </div>
    </div>
  );
}

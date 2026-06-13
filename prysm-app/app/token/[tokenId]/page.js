export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { fetchTokenDetails } from '@/lib/icpswap-api';
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

const TokenDetailClient = nextDynamic(() => import('@/components/TokenDetailClient'), {
  ssr: false,
  loading: () => (
    <div className="max-w-7xl mx-auto px-6">
      <Header />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-text)] mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    </div>
  ),
});

export default async function TokenDetailPage({ params }) {
  const { tokenId } = params;

  let token;
  try {
    token = await fetchTokenDetails(tokenId);
  } catch (error) {
    return (
      <div className="max-w-7xl mx-auto px-6">
        <Header />
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-light transition-colors text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to PRYSM
          </Link>
        </div>
        <div className="text-center py-20 bg-[var(--color-bg-secondary)]/60 rounded-lg border border-[var(--color-border)] mt-8">
          <h1 className="text-2xl font-light text-[var(--color-text)] mb-4">Token Not Found</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">The token with ledger ID "{tokenId}" could not be found.</p>
          <Link
            href="/"
            className="snipe-button snipe-button-primary"
          >
            Back to Token List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6">
      <Header />
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-light transition-colors text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to PRYSM
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-text)] mb-4"></div>
              <p className="text-[var(--color-text-secondary)]">Loading...</p>
            </div>
          </div>
        }
      >
        <TokenDetailClient token={token} tokenId={tokenId} />
      </Suspense>
    </div>
  );
}

'use client';

import AdvancedChart from '@/components/AdvancedChart';

export default function TokenDetailClient({ token, tokenId }) {
  const priceChange = token?.priceChange24h ?? 0;
  const isNew = token?.isNew || false;
  const price = token?.price ?? 0;

  const formatPrice = (num) => {
    if (num === 0 || num === null || num === undefined || isNaN(num)) return '0.00'
    if (num < 0.01) return num.toFixed(6)
    if (num < 1) return num.toFixed(4)
    return num.toFixed(2)
  }

  return (
    <div className="bg-[var(--color-bg-secondary)]/60 rounded-lg p-8 border border-[var(--color-border)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-[var(--color-border)] rounded-xl flex items-center justify-center text-[var(--color-text)] font-light text-3xl">
                {token?.symbol?.charAt(0) || 'T'}
              </div>
              <div>
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl font-light text-[var(--color-text)]">{token?.symbol || 'TOKEN'}</h1>
                  {isNew && (
                    <span className="bg-green-500/20 text-green-500 text-sm font-medium px-3 py-1 rounded">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-text-secondary)] mt-2 text-lg">{token?.name || 'Token Name'}</p>
              </div>
            </div>

            <div className="bg-[var(--color-bg)]/60 rounded-xl p-6 min-w-[320px] backdrop-blur-sm">
              <p className="text-[var(--color-text-secondary)] text-sm mb-2">Price</p>
              <div className="flex items-end justify-between">
                <p className="text-5xl font-light text-[var(--color-text)]">${formatPrice(price)}</p>
                <span className={`text-xl font-medium ${
                  priceChange >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <AdvancedChart
            tokenId={token.tokenLedgerId}
            height={600}
            theme="dark"
            showVolume={false}
            showIndicators={false}
          />
    </div>
  );
}

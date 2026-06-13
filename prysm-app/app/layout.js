// Validate environment variables on module load
import '@/lib/validate-env'

import './globals.css'
import { Inter } from 'next/font/google'
import { NotificationProvider } from '@/components/NotificationProvider'
import { QueryProvider } from '@/components/QueryProvider'
import { WalletProvider } from '@/contexts/WalletContext'
import { PerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import ErrorBoundary from '@/components/ErrorBoundary'
import AppErrorFallback from '@/components/AppErrorFallback'
import AnnouncementBar from '@/components/AnnouncementBar'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true
})

export const metadata = {
  title: 'PRYSM - Crypto Community - Trade, Stake, Earn Rewards',
  description: 'Minimalist, ultra-fast token sniping interface for ICPSWAP. Instant loads, real-time updates, zero jank.',
  manifest: '/manifest.json',
  keywords: ['token sniping', 'ICPSWAP', 'crypto', 'trading', 'DeFi'],
  authors: [{ name: 'PRYSM Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'PRYSM - Token Sniping Interface',
    description: 'Lightning-fast token sniping for ICPSWAP',
    url: 'https://snpr.vercel.app',
    siteName: 'PRYSM',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PRYSM - Token Sniping Interface',
    description: 'Lightning-fast token sniping for ICPSWAP',
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to external APIs for faster loading */}
        <link rel="preconnect" href="https://api.icpswap.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.icpswap.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Preload wallet PNG placeholders for instant display */}
        <link rel="preload" href="/plug-wallet-logo.png" as="image" />
        <link rel="preload" href="/ii-wallet-logo.png" as="image" />

        {/* Manifest and PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#161614" />
        <meta name="msapplication-TileColor" content="#161614" />

        {/* Apple PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PRYSM" />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Security */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none focus:ring-2"
        >
          Skip to main content
        </a>

        <QueryProvider>
          <WalletProvider>
            <NotificationProvider>
              <ErrorBoundary fallback={AppErrorFallback}>
                <AnnouncementBar />
                <ServiceWorkerRegistrar />
                <main id="main-content" role="main">
                  {children}
                </main>
                {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
              </ErrorBoundary>
            </NotificationProvider>
          </WalletProvider>
        </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

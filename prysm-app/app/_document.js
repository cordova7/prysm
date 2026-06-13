import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnect to critical origins - fastest performance */}
        <link rel="preconnect" href="https://api.icpswap.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS prefetch for additional domains */}
        <link rel="dns-prefetch" href="https://api.icpswap.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />

        {/* Prefetch critical API endpoints */}
        <link rel="prefetch" href="/api/tokens" as="fetch" crossOrigin="anonymous" />
        <link rel="prefetch" href="/api/new-tokens" as="fetch" crossOrigin="anonymous" />

        {/* Fonts optimization - handled by next/font */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Favicon and app icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color */}
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="msapplication-TileColor" content="#0a0a0a" />

        {/* Apple PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SNPR" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Microsoft Tiles */}
        <meta name="msapplication-TileImage" content="/android-chrome-192x192.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Security headers */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Critical resource hints */}
        <link rel="preconnect" href="/" />

        {/* InstantPage for faster navigation */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Instant page loading - loads links before user clicks
              (function() {
                let pagesrc = window.location.pathname;
                document.addEventListener('DOMContentLoaded', function() {
                  if (!window.location.pathname.match(/\\/(api|_next\\/static|_next\\/image|favicon|manifest)/)) {
                    let link = document.createElement('link');
                    link.as = 'fetch';
                    link.crossOrigin = 'anonymous';
                    link.href = '/api/tokens';
                    document.head.appendChild(link);
                  }
                });
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

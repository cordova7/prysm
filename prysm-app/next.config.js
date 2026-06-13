// This file sets up custom configuration for your application
// Adds Vercel analytics, Sentry error tracking, and other optimizations

import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  env: {
    NEXT_PUBLIC_ICPSWAP_API_BASE_URL: process.env.NEXT_PUBLIC_ICPSWAP_API_BASE_URL || 'https://api.icpswap.com',
  },
  experimental: {
    serverComponentsExternalPackages: ["lightweight-charts"],
    optimizePackageImports: ["framer-motion", "react-icons"],
  },

  // Image optimization
  images: {
    domains: ['api.icpswap.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Core performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,

  // Console removal in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    reactRemoveProperties: process.env.NODE_ENV === 'production',
    styledComponents: true,
  },

  // Static optimization
  // Removed 'standalone' to prevent caching old builds
  generateEtags: true,
  // Use consistent build ID to prevent version mismatches
  generateBuildId: async () => {
    return 'snpr-build'
  },

  // Security and caching headers
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      ...(isDev ? [] : [
        {
          source: '/fonts/(.*).(woff2|woff)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ]),
      {
        source: '/.well-known/ii-alternative-origins',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/token',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Webpack optimizations for production
  webpack: (config, { dev, isServer, buildId, defaultLoaders, webpack }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Improve chunk splitting for better caching
      // Using Next.js defaults with minimal customization to avoid hash mismatches
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Default priority for everything else
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      };

      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Add bundle analyzer in production
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
          })
        );
      }
    }

    // Optimize for Vercel Edge Functions
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': __dirname,
      };
    }

    // Reduce memory usage
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    };

    return config;
  },
}

// Wrap next.config.js with Sentry configuration for error tracking (optional)
// Only wraps with Sentry if DSN is configured - otherwise exports config directly
const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
  automaticVercelMonitors: true,
};

// Check if Sentry is configured
const hasSentryConfig = Boolean(process.env.SENTRY_DSN);

export default hasSentryConfig
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

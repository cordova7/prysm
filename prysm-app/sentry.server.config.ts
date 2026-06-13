// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if DSN is configured (no account needed!)
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn: dsn,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
}

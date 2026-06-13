'use client';

import { useEffect } from 'react';

export default function ResourcePreloader() {
  useEffect(() => {
    // Preload critical resources
    const criticalResources = [
      { href: '/api/tokens/supabase', as: 'fetch', type: 'application/json' },
      { href: '/api/new-tokens/supabase', as: 'fetch', type: 'application/json' },
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      link.type = resource.type;
      document.head.appendChild(link);
    });

    // DNS prefetch for external domains
    const dnsPrefetchDomains = [
      'https://api.icpswap.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    dnsPrefetchDomains.forEach((domain) => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });

    // Preconnect to critical origins
    const preconnectOrigins = [
      'https://api.icpswap.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    preconnectOrigins.forEach((origin) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    return () => {
      // Cleanup
      criticalResources.forEach(() => {});
      dnsPrefetchDomains.forEach(() => {});
      preconnectOrigins.forEach(() => {});
    };
  }, []);

  return null;
}

// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Vercel Edge Caching - optimize for Vercel CDN
  response.headers.set('X-Vercel-Cache', 'MISS')

  // HSTS (HTTP Strict Transport Security)
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }

  // Optimize for different paths
  const url = request.nextUrl.pathname

  // Cache static assets aggressively
  if (
    url.includes('/_next/static/') ||
    url.includes('/fonts/') ||
    url.match(/\.(js|css|woff2|woff|ttf|eot|svg|png|jpg|jpeg|webp|avif)$/)
  ) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    response.headers.set('X-Vercel-Cache', 'HIT')
  }

  // Cache HTML with shorter TTL for real-time data
  if (url === '/' || url.startsWith('/token/')) {
    response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=60')
  }

  return response
}

// Apply middleware to all routes except Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - manifest.json (PWA manifest)
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|manifest.json).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}

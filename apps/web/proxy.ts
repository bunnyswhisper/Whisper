import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildAllSecurityHeaders, isDevelopmentCsp } from '@/lib/csp';

/**
 * Apply CSP + security headers per request so dev reliably gets unsafe-eval (webpack HMR).
 * Production also sets the same headers via next.config `headers()` for static assets.
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  const isDev = isDevelopmentCsp();
  for (const { key, value } of buildAllSecurityHeaders(isDev)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sw.js|manifest.json|icons|images|logo.png).*)',
  ],
};

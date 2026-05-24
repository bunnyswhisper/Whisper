/**
 * Content-Security-Policy values for Next.js `headers()` and middleware.
 * Development includes `unsafe-eval` for webpack / React dev tooling and
 * connect-src origins derived from NEXT_PUBLIC_API_URL (LAN-safe in middleware).
 */

const PAYMOB_CONNECT = [
  'https://*.paymob.com',
  'https://accept.paymob.com',
  'https://api.paymob.com',
] as const;

const SUPABASE_CONNECT = [
  'https://*.supabase.co',
  'wss://*.supabase.co',
] as const;

/** Fixed local dev origins (always allowed in development). */
const DEV_CONNECT_LOCAL = [
  "'self'",
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

const PROD_CONNECT_SRC_BASE = [
  "'self'",
  ...SUPABASE_CONNECT,
  ...PAYMOB_CONNECT,
] as const;

function originFromEnvUrl(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return null;
  }
}

/** LAN / env API + site origins (NEXT_PUBLIC_* — available in Edge middleware). */
function envDerivedConnectOrigins(): string[] {
  const out: string[] = [];
  const api = originFromEnvUrl(process.env.NEXT_PUBLIC_API_URL);
  const site = originFromEnvUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (api) out.push(api);
  if (site) out.push(site);
  return out;
}

/**
 * Optional LAN host → http origins (Node / next.config only; not relied on in Edge).
 * NEXT_PUBLIC_API_URL is the canonical source for middleware CSP.
 */
function lanHostConnectOrigins(): string[] {
  const host = process.env.NEXT_DEV_LAN_HOST?.trim();
  if (!host) return [];
  const origins = [
    `http://${host}:3001`,
    `http://${host}:3000`,
    `ws://${host}:3000`,
  ];
  return origins.filter((o) => !envDerivedConnectOrigins().includes(o));
}

function uniqueOrigins(sources: readonly string[]): string[] {
  return [...new Set(sources.filter(Boolean))];
}

function buildConnectSrc(isDev: boolean): string {
  if (isDev) {
    const parts = uniqueOrigins([
      ...DEV_CONNECT_LOCAL,
      ...envDerivedConnectOrigins(),
      ...lanHostConnectOrigins(),
      ...SUPABASE_CONNECT,
      ...PAYMOB_CONNECT,
      /* Broad https/wss/ws for dev tooling, Supabase edge cases, and webpack HMR */
      'https:',
      'wss:',
      'ws:',
    ]);
    return `connect-src ${parts.join(' ')}`;
  }

  const apiOrigin = originFromEnvUrl(process.env.NEXT_PUBLIC_API_URL);
  const parts = uniqueOrigins([
    ...PROD_CONNECT_SRC_BASE,
    ...(apiOrigin ? [apiOrigin] : []),
  ]);
  return `connect-src ${parts.join(' ')}`;
}

/** True when Next dev server is running (eval needed for webpack HMR). */
export function isDevelopmentCsp(): boolean {
  return process.env.NODE_ENV === 'development';
}

function buildScriptDirectives(isDev: boolean): string[] {
  if (isDev) {
    const devScript =
      "'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: data:";
    return [
      `script-src ${devScript}`,
      `script-src-elem ${devScript}`,
      "script-src-attr 'unsafe-inline'",
      "worker-src 'self' blob:",
    ];
  }

  const prodScript = "'self' 'unsafe-inline'";
  return [`script-src ${prodScript}`, `script-src-elem ${prodScript}`];
}

export function buildContentSecurityPolicy(isDev: boolean): string {
  return [
    "default-src 'self'",
    ...buildScriptDirectives(isDev),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    buildConnectSrc(isDev),
    "frame-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

export type SecurityHeader = { key: string; value: string };

/**
 * Production security headers (CSP applied separately).
 * HSTS is omitted in development so http://localhost HMR is unaffected.
 */
export function buildSecurityHeaders(isDev: boolean): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value:
        'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()',
    },
    /** Aligns with CSP `frame-ancestors 'self'` (clickjacking). */
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  ];

  if (!isDev) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  }

  return headers;
}

/** CSP + security headers for middleware / Next `headers()`. */
export function buildAllSecurityHeaders(isDev: boolean): SecurityHeader[] {
  return [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(isDev) },
    ...buildSecurityHeaders(isDev),
  ];
}

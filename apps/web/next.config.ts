import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";
import { fileURLToPath } from "url";
import withPWAInit from "@ducanh2912/next-pwa";
import { buildAllSecurityHeaders } from "./lib/csp";

/** Next app directory (`apps/web`) — used for stable monorepo tracing when multiple lockfiles exist. */
const webDir = path.dirname(fileURLToPath(import.meta.url));

/** Ensure `.env.local` is loaded before reading NEXT_DEV_LAN_HOST (next.config runs early). */
loadEnvConfig(webDir);

const isDev = process.env.NODE_ENV === "development";

/**
 * PWA / Workbox: production builds only.
 * In development the plugin is disabled, SW registration is off, and
 * scripts/dev-clear-pwa.mjs removes generated public/sw*.js before `next dev`.
 *
 * urlPattern callbacks must be self-contained (no external function refs) —
 * otherwise the generated sw.js throws ReferenceError at runtime.
 */
const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  register: !isDev,
  scope: "/",
  sw: "sw.js",
  cacheStartUrl: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    /**
     * Prepended before next-pwa defaults (extendDefaultRuntimeCaching).
     * Dynamic app routes must be NetworkOnly so Workbox never throws no-response
     * from NetworkFirst on navigations/RSC when cache is empty or stale.
     *
     * Matchers must stay self-contained (no outer function refs).
     */
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url }) =>
          sameOrigin && url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "api-requests" },
      },
      {
        urlPattern: ({ sameOrigin, url, request }) => {
          if (!sameOrigin) return false;
          const p = url.pathname;
          const dynamic =
            p.startsWith("/product/") ||
            p === "/cart" ||
            p === "/checkout" ||
            p === "/payment" ||
            p.startsWith("/payment/") ||
            p === "/auth" ||
            p.startsWith("/auth/") ||
            p === "/account" ||
            p.startsWith("/account/") ||
            p.startsWith("/orders/") ||
            p === "/points" ||
            p.startsWith("/points/") ||
            p === "/admin" ||
            p.startsWith("/admin/") ||
            p === "/event" ||
            p.startsWith("/event/") ||
            p.startsWith("/qr") ||
            p === "/logout" ||
            p.startsWith("/reset-password");
          if (!dynamic) return false;
          return (
            request.mode === "navigate" ||
            request.headers.get("RSC") === "1" ||
            request.headers.get("Next-Router-Prefetch") === "1"
          );
        },
        handler: "NetworkOnly",
        options: { cacheName: "dynamic-app-pages" },
      },
      {
        urlPattern: ({ sameOrigin, url }) => {
          if (!sameOrigin) return false;
          const p = url.pathname;
          if (!p.startsWith("/_next/data/")) return false;
          return (
            p.includes("/product/") ||
            p.includes("/cart") ||
            p.includes("/checkout") ||
            p.includes("/payment/") ||
            p.includes("/account/") ||
            p.includes("/orders/") ||
            p.includes("/points/") ||
            p.includes("/admin/") ||
            p.includes("/event/") ||
            p.includes("/auth/")
          );
        },
        handler: "NetworkOnly",
        options: { cacheName: "dynamic-app-data" },
      },
      {
        urlPattern: ({ sameOrigin }) => !sameOrigin,
        handler: "NetworkOnly",
        options: { cacheName: "cross-origin" },
      },
    ],
  },
});

/**
 * Next.js dev blocks requests to `/_next/*` from origins not in this list.
 * When you open the site from a phone at http://LAN_IP:3000, the Origin host is
 * that LAN IP — not `localhost` and not `0.0.0.0` (the bind address). Without
 * allowlisting it, client chunks / HMR can 403 and React never hydrates: native
 * links & form controls still work, but onClick does not.
 *
 * Set NEXT_DEV_LAN_HOST to your phone-reachable IP (hostname only, e.g. 172.20.10.3).
 */
const lanDevHost = process.env.NEXT_DEV_LAN_HOST?.trim();
/** Hostname-only entries (Next.js matches Origin host, not full URL). */
const LAN_DEV_HOSTS = [
  "192.168.1.86",
  ...(lanDevHost && lanDevHost !== "192.168.1.86" ? [lanDevHost] : []),
] as const;

function supabaseStorageHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseStorageHostname();

const nextConfig: NextConfig = {
  images: {
    /** Load Supabase (and other remote) URLs directly — avoids `/_next/image` upstream timeouts in prod. */
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [48, 64, 96, 128, 256, 384],
    qualities: [75, 80, 85, 90],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'jakrahdrpnfsfhylvfjd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      ...(supabaseHost && supabaseHost !== 'jakrahdrpnfsfhylvfjd.supabase.co'
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },
  /** Monorepo package root (`clothing-brand`): avoids wrong inference from `D:\\Whisper\\package-lock.json` breaking dev CSS/chunk resolution. */
  outputFileTracingRoot: path.join(webDir, "..", ".."),
  allowedDevOrigins: [
    "refinance-sedation-opium.ngrok-free.dev",
    "*.ngrok-free.dev",
    ...LAN_DEV_HOSTS,
    /* Common phone hotspot range used for local testing (override via NEXT_DEV_LAN_HOST) */
    "172.20.10.3",
  ],
  async headers() {
    /** Dev: middleware sets CSP (unsafe-eval) + security headers per request. */
    if (process.env.NODE_ENV === "development") return [];
    return [
      {
        source: "/(.*)",
        headers: buildAllSecurityHeaders(false),
      },
    ];
  },
};

export default withPWA(nextConfig);

# Deployment Notes — Bunny's Whisper

## Current architecture (do not migrate in V1.1)

| Component | Platform | Root directory |
|-----------|----------|----------------|
| Web | **Vercel** | `apps/web` |
| API | **Render** | `apps/api` |
| Database | **Supabase** | — |

## Deploy order (safe)

1. Apply Supabase SQL migrations (through `20260526120000_security_hardening_indexes_rls.sql`)
2. Deploy API (Render)
3. Deploy web (Vercel)
4. Smoke test checkout + wishlist + admin finance + security checklist

## Vercel (web)

- Build command: `npm run build` (uses `next build --webpack`)
- `proxy.ts` must stay Edge-safe (no `@/lib/csp` import)
- Static PWA assets in `public/` (manifest, icons)

## Render (API)

- Start command: typically `node dist/main` or `npm run start:prod`
- Required env: Supabase, `ADMIN_EMAILS`, Paymob, Resend, Telegram, CORS origins
- Port from `PORT` env (default 3001)

## Environment variables (reference — never commit values)

**API (`apps/api/.env`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, `PAYMOB_HMAC_SECRET`, etc.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `RESEND_API_KEY`, email from-address vars
- `FRONTEND_URL`, `CORS_ORIGIN`

**Web (`apps/web/.env.local`):**
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Rollback

- Revert git deploy on Vercel/Render
- New DB tables are additive — rollback does not require dropping tables immediately
- Wishlist/finance features simply stop working if API reverted before web

## What not to change during deploy fixes

- Paymob webhook handlers
- Order creation RPC usage
- Middleware/proxy matcher (keep static string array)

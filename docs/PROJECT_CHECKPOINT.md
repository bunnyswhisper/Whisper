# Project Checkpoint — Bunny's Whisper

**Status:** Production store live (Vercel + Render + Supabase)

## Working (verified before V1.1)

- [x] Product catalog and product detail pages
- [x] Cart and checkout (COD + Paymob)
- [x] Order creation with inventory RPC
- [x] Admin orders, inventory, products
- [x] Bunny Points (claim codes, redeem coupons, order claim QR)
- [x] Event QR campaigns
- [x] Customer reviews (token + public submit + admin moderation)
- [x] Abandoned cart recovery emails
- [x] Telegram admin notifications
- [x] Resend transactional emails
- [x] PWA (admin install banner, icons)
- [x] SEO (sitemap, robots, JSON-LD)

## V1.1 new features

- [x] Customer wishlist + first-wishlist 100 points reward
- [x] Admin wishlist analytics tab
- [x] Admin finance tracker (manual ledger)
- [x] Project documentation (`docs/`)

## Deployment

| Service | Host | App path |
|---------|------|----------|
| Web | Vercel | `apps/web` |
| API | Render | `apps/api` |
| DB | Supabase | — |

## Critical env vars (names only)

**API:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `PAYMOB_*`, `TELEGRAM_*`, `RESEND_*`, `FRONTEND_URL`, `CORS_ORIGIN`

**Web:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Next safe improvements (not in V1.1)

- Auto-sync finance income from paid orders (read-only import)
- Wishlist email reminders
- PDF export for finance (CSV implemented)

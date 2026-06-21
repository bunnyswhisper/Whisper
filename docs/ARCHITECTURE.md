# Architecture — Bunny's Whisper

## High-level

```
Browser / PWA
    │
    ▼
Next.js (Vercel) ──REST──► NestJS API (Render)
    │                           │
    │                           ▼
    └── Supabase Auth ─────────► Supabase Postgres (service role)
    └── Supabase Storage ◄──── (product images, admin upload)
```

## Web (`apps/web`)

- **App Router** — React 19, TanStack Query, Tailwind 4
- **Auth:** Supabase client session; API calls use Bearer token via `fetchJsonWithBootstrapRetry`
- **Cart:** localStorage (`readCart` / `writeCart`) — not server cart until checkout
- **PWA:** `@ducanh2912/next-pwa` — production service worker only
- **Proxy:** `proxy.ts` — Edge-safe CSP headers (inlined, no `@/lib/csp` import)

## API (`apps/api`)

- **Modules:** feature folders under `src/modules/`
- **DB access:** single `SupabaseService` with service role key
- **Guards:** `AdminGuard` for admin routes; customer routes validate JWT in services
- **Atomic writes:** Postgres RPCs for orders, points, wishlist toggle

## Data flow — checkout (unchanged in V1.1)

1. Client builds cart locally
2. `POST /orders` → `create_order_with_inventory` RPC
3. Paymob or COD path
4. Webhooks / status updates → emails + Telegram

## Data flow — wishlist (V1.1)

1. Customer clicks heart → `POST /customer/wishlist/toggle`
2. API calls `toggle_wishlist_atomic` RPC
3. First-ever add inserts `customer_reward_events` row (`first_wishlist`) once
4. 100 points credited only if unique insert succeeds

## Data flow — finance (V1.1)

1. Admin adds entry at `/admin/finance`
2. Stored in `finance_entries` table
3. Summaries computed in API from filtered rows
4. **Not** auto-linked to order revenue in V1.1

## External services

| Service | Used for |
|---------|----------|
| Supabase | Postgres, Auth, Storage |
| Paymob | Card payments |
| Resend | Transactional email |
| Telegram | Admin order alerts |
| Vercel | Web hosting |
| Render | API hosting |

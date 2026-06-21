# Routes — Bunny's Whisper

## Public (web)

| Route | Purpose |
|-------|---------|
| `/` | Home / product catalog |
| `/product/[slug]` | Product detail |
| `/cart` | Shopping cart |
| `/checkout` | Checkout (**do not refactor casually**) |
| `/payment` | Paymob return / status |
| `/auth` | Login / signup |
| `/reviews` | Public reviews |
| `/reviews/new` | Submit public review |
| `/review/[token]` | Order-token review form |
| `/contact`, `/terms`, `/privacy`, `/shipping`, `/returns` | Legal / info |
| `/account-cancellation` | Account cancellation policy |

## Customer (auth required)

| Route | Purpose |
|-------|---------|
| `/account` | Profile |
| `/account/orders` | Order history |
| `/account/wishlist` | **V1.1** Saved products |
| `/points` | Bunny Points dashboard |

## Admin (auth + `ADMIN_EMAILS`)

| Route | Purpose |
|-------|---------|
| `/admin/orders` | Order management |
| `/admin/inventory` | Stock checker |
| `/admin/products` | Product editor |
| `/admin/analytics` | Analytics (+ Wishlist tab) |
| `/admin/finance` | **V1.1** Finance tracker |
| `/admin/reviews` | Review moderation |
| `/admin/events-qr` | Event QR campaigns |

## API — customer

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/customer/orders` | My orders |
| GET | `/customer/wishlist` | **V1.1** Full wishlist |
| GET | `/customer/wishlist/ids` | **V1.1** Wishlisted product IDs |
| POST | `/customer/wishlist/toggle` | **V1.1** Add/remove wishlist |
| GET | `/points/me` | Points balance |

## API — admin

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/orders` | All orders |
| GET | `/admin/analytics-extra` | Extra analytics dump |
| GET | `/admin/wishlist/analytics` | **V1.1** Wishlist stats |
| GET/POST/PATCH/DELETE | `/admin/finance` | **V1.1** Finance CRUD |

## API — public

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/products` | Featured products |
| GET | `/products/:slug` | Product detail |
| POST | `/orders` | Create order (**critical**) |
| POST | `/payments/paymob/*` | Paymob webhooks |

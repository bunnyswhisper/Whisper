# Auth and Permissions — Bunny's Whisper

## Customer authentication

- Supabase email/password or OAuth (Google)
- Session token sent as `Authorization: Bearer <access_token>`
- First login: `POST /auth/bootstrap-customer` creates `customer_profiles` + `customer_points`
- **Never** write `customer_points` from the browser (RLS blocks direct inserts)

## Admin authentication

- Same Supabase login as customers
- Admin access determined by **`ADMIN_EMAILS`** env var on the API (comma-separated, case-insensitive)
- `GET /auth/me` returns `isAdmin: true` for UI hints only — **API enforces `AdminGuard`**

## Permission matrix

| Action | Customer | Admin |
|--------|----------|-------|
| Browse products | Yes | Yes |
| Checkout / pay | Yes | Yes |
| View own orders | Yes | — |
| View own wishlist | Yes | — |
| View others' wishlist | No | No |
| Manage products | No | Yes |
| Manage orders | No | Yes |
| Finance tracker | No | Yes |
| Wishlist analytics | No | Yes |
| Moderate reviews | No | Yes |

## API patterns

**Customer route:**
```typescript
private getToken(authorization?: string) {
  if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException(...);
  return authorization.replace('Bearer ', '');
}
// service: supabase.auth.getUser(token)
// filter all queries by user.id
```

**Admin route:**
```typescript
@Controller('admin/...')
@UseGuards(AdminGuard)
```

## Security notes

- Service role bypasses RLS — always scope queries by user or admin check in code
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the web app
- Do not commit `.env` files
- Admin UI (`AdminOnly`) is not sufficient alone — every `/admin/*` API route uses `@UseGuards(AdminGuard)`
- Paymob HMAC secret and webhook verification live on API only
- Finance CSV export escapes formula-injection characters (`=`, `+`, `-`, `@`, tab)

## Hardening pass (reference)

See `docs/SECURITY_CHECKLIST.md` for audit summary, rate limits, and remaining risks.

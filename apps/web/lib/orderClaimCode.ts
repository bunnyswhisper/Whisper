/**
 * Matches server-generated order claim codes (`generateSecureOrderClaimCode`):
 * BW-ORDER-XXXX-XXXX-XXXX using Crockford-style alphabet (no O/0/I/1).
 */
const SECURE_ORDER_CLAIM_CODE_RE =
  /^BW-ORDER-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

export function isSecureOrderClaimCodeForPrint(
  code: string | null | undefined,
): boolean {
  const c = String(code ?? '').trim().toUpperCase();
  return SECURE_ORDER_CLAIM_CODE_RE.test(c);
}

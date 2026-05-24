/**
 * Maps API errors to safe customer-facing copy. Raw DB/provider messages stay server-side.
 */
export function friendlyCustomerMessage(
  raw: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const m = String(raw ?? '').trim();
  if (!m) return fallback;
  if (m.length > 280) return fallback;
  if (/duplicate key|violates foreign key|relation "|column "|syntax error|postgres|supabase/i.test(m)) {
    return fallback;
  }
  return m;
}

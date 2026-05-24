/** Avoid PII in structured logs (public testing / log aggregation). */

export function maskEmailForLog(email: string | null | undefined): string {
  if (!email) return 'none';
  const e = email.trim().toLowerCase();
  const [local, domain] = e.split('@');
  if (!domain) return '***';
  const safeLocal =
    local.length <= 1 ? '*' : `${local[0]}***${local.slice(-1)}`;
  return `${safeLocal}@${domain}`;
}

export function shortIdForLog(id: string | null | undefined): string {
  if (!id) return 'none';
  const s = id.replace(/-/g, '');
  return s.length <= 8 ? `${s}…` : `${s.slice(0, 8)}…`;
}

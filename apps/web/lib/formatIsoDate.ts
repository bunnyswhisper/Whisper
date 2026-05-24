/**
 * Calendar date from an ISO timestamp (YYYY-MM-DD), no locale formatting.
 * Use for UI that must match between SSR and client (avoids hydration drift).
 */
export function formatIsoDateYmd(iso: string | null | undefined): string {
  const s = String(iso || '').trim();
  if (!s) return '';
  const day = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : s.slice(0, 16);
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** UTC date + time; identical on server and client (no `toLocaleString` drift). */
export function formatIsoUtcDateTime(iso: string | null | undefined): string {
  const s = String(iso || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getUTCFullYear();
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  const day = d.getUTCDate();
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mon} ${day}, ${y} · ${h}:${min} UTC`;
}

/** Short UTC calendar date for lists (e.g. orders). */
export function formatIsoUtcDateShort(iso: string | null | undefined): string {
  const s = String(iso || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  return `${mon} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

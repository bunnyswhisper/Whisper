/**
 * First token from shipping/customer name for reward card greeting (e.g. "Hesham,").
 * Title-cases Latin letters; does not alter scripts that do not use case.
 */
export function customerFirstNameForRewardCard(
  fullName: string | null | undefined,
): string {
  const raw = String(fullName ?? '').trim();
  if (!raw) return 'Friend';
  const first = raw.split(/\s+/)[0] ?? '';
  if (!first) return 'Friend';
  const lower = first.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

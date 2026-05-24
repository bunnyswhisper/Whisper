/**
 * Returns true when the URL can be passed to `next/image` (HTTP(S) or same-origin path).
 * Blob/data URLs (admin previews, QR data) must stay on `<img>`.
 */
export function isOptimizableImageSrc(src: string | null | undefined): src is string {
  if (!src?.trim()) return false;
  const trimmed = src.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const protocol = new URL(trimmed).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

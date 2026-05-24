import { isOptimizableImageSrc } from '@/lib/images/isOptimizableImageSrc';

function supabaseProjectHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/**
 * True when `next/image` can optimize this URL without throwing (hostname allowlist).
 * Unknown external hosts fall back to a plain `<img>` so product pages never crash.
 */
export function canOptimizeWithNextImage(src: string): boolean {
  if (!isOptimizableImageSrc(src)) return false;

  if (src.startsWith('/')) return true;

  try {
    const { hostname } = new URL(src);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname.endsWith('.supabase.co')) return true;

    const projectHost = supabaseProjectHost();
    if (projectHost && hostname === projectHost) return true;

    return false;
  } catch {
    return false;
  }
}

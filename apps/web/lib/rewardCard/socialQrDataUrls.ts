import QRCode from 'qrcode';
import { brandSocialUrls } from '@/lib/brandSocialUrls';

export type SocialQrDataUrls = {
  instagram: string;
  tiktok: string;
  facebook: string;
};

/**
 * PNG data URLs for Instagram / TikTok / Facebook QRs.
 * Payloads are **only** `brandSocialUrls.*.url` (same strings as footer links and icon hrefs).
 */
export async function generateSocialQrDataUrls(options?: {
  width?: number;
  margin?: number;
}): Promise<SocialQrDataUrls> {
  const width = options?.width ?? 200;
  const margin = options?.margin ?? 1;
  const opts = { margin, width };
  const [instagram, tiktok, facebook] = await Promise.all([
    QRCode.toDataURL(brandSocialUrls.instagram.url, opts),
    QRCode.toDataURL(brandSocialUrls.tiktok.url, opts),
    QRCode.toDataURL(brandSocialUrls.facebook.url, opts),
  ]);
  return { instagram, tiktok, facebook };
}

/**
 * Canonical brand social profile URLs.
 *
 * These exact strings are encoded in every social QR on the site:
 * - Site footer (`SocialQrFooter` → `generateSocialQrDataUrls` → `RewardCardBack`)
 * - Printable reward card back (admin print → `generateSocialQrDataUrls` → `buildRewardCardBackHtml`)
 *
 * Do not duplicate these URLs elsewhere; import from this module only.
 */
export const brandSocialProfileUrls = {
  instagram:
    'https://www.instagram.com/bunnyswhisper?igsh=aGFvMms2bjM3Z3lr&utm_source=qr',
  tiktok: 'https://www.tiktok.com/@bunnyswhisper0?_r=1&_t=ZS-96OPyV5Nbsq',
  facebook: 'https://www.facebook.com/share/1avoDZHYeV/?mibextid=wwXIfr',
} as const;

export const brandSocialUrls = {
  instagram: {
    label: 'Instagram',
    url: brandSocialProfileUrls.instagram,
  },
  tiktok: {
    label: 'TikTok',
    url: brandSocialProfileUrls.tiktok,
  },
  facebook: {
    label: 'Facebook',
    url: brandSocialProfileUrls.facebook,
  },
} as const;

import type { Metadata } from 'next';
import { SITE_URL, siteUrl } from '@/lib/api';
import { brandSocialProfileUrls } from '@/lib/brandSocialUrls';

export const SEO_SITE_NAME = "Bunny's Whisper";

export const SEO_DEFAULT_TITLE = "Bunny's Whisper | Luxury Dark Streetwear";

export const SEO_TITLE_TEMPLATE = "%s | Bunny's Whisper";

export const SEO_DEFAULT_DESCRIPTION =
  "Bunny's Whisper is an Egypt-based luxury dark streetwear brand crafting limited SS25 pieces with a quiet, premium edge.";

export const SEO_KEYWORDS = [
  "Bunny's Whisper",
  'dark streetwear',
  'Egyptian streetwear',
  'luxury streetwear Egypt',
  'SS25',
  'limited clothing drops',
];

/** Brand OG/social image — uses existing public logo. */
export const SEO_OG_IMAGE_PATH = '/logo.png';

export function absoluteUrl(path: string): string {
  return siteUrl(path);
}

export function ogImageUrl(): string {
  return absoluteUrl(SEO_OG_IMAGE_PATH);
}

export const SEO_ORGANIZATION_SAME_AS = [
  brandSocialProfileUrls.instagram,
  brandSocialProfileUrls.facebook,
  brandSocialProfileUrls.tiktok,
] as const;

export const SEO_OPEN_GRAPH_DEFAULTS = {
  type: 'website' as const,
  siteName: SEO_SITE_NAME,
  locale: 'en_EG',
  title: SEO_DEFAULT_TITLE,
  description: SEO_DEFAULT_DESCRIPTION,
  url: SITE_URL,
  images: [
    {
      url: ogImageUrl(),
      width: 512,
      height: 512,
      alt: `${SEO_SITE_NAME} logo`,
    },
  ],
};

export const SEO_TWITTER_DEFAULTS = {
  card: 'summary_large_image' as const,
  title: SEO_DEFAULT_TITLE,
  description: SEO_DEFAULT_DESCRIPTION,
  images: [ogImageUrl()],
};

/** Shared public-page metadata fragment (canonical + indexable). */
export function indexablePageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const canonical = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      ...SEO_OPEN_GRAPH_DEFAULTS,
      title: `${title} | ${SEO_SITE_NAME}`,
      description,
      url: canonical,
    },
    twitter: {
      ...SEO_TWITTER_DEFAULTS,
      title: `${title} | ${SEO_SITE_NAME}`,
      description,
    },
  };
}

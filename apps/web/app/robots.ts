import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/api';
import { buildRobotsDisallowPaths } from '@/lib/seo/robotsDisallow';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: buildRobotsDisallowPaths(),
    },
    /** Uses NEXT_PUBLIC_SITE_URL via SITE_URL (localhost only when env unset). */
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

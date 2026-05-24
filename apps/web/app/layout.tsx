import type { Metadata, Viewport } from 'next';
import { DevServiceWorkerCleanup } from '@/components/DevServiceWorkerCleanup';
import { SiteJsonLd } from '@/components/seo/SiteJsonLd';
import './globals.css';
import DeferredSocialFooter from '@/components/DeferredSocialFooter';
import Providers from './providers';
import { SITE_URL } from '@/lib/api';
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_TITLE,
  SEO_KEYWORDS,
  SEO_OPEN_GRAPH_DEFAULTS,
  SEO_SITE_NAME,
  SEO_TITLE_TEMPLATE,
  SEO_TWITTER_DEFAULTS,
} from '@/lib/seo/siteConfig';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SEO_SITE_NAME,
  title: {
    default: SEO_DEFAULT_TITLE,
    template: SEO_TITLE_TEMPLATE,
  },
  description: SEO_DEFAULT_DESCRIPTION,
  authors: [{ name: SEO_SITE_NAME }],
  creator: SEO_SITE_NAME,
  publisher: SEO_SITE_NAME,
  keywords: SEO_KEYWORDS,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SEO_SITE_NAME,
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: SEO_OPEN_GRAPH_DEFAULTS,
  twitter: SEO_TWITTER_DEFAULTS,
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: '#07030d',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className="min-h-full antialiased"
    >
      <body
        suppressHydrationWarning
        className="min-h-screen overflow-y-auto bg-[#07030d] text-white flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
      >
        <SiteJsonLd />
        <Providers>
          <DevServiceWorkerCleanup />
          <div className="relative flex min-h-0 flex-1 flex-col pointer-events-auto">
            {children}
          </div>
          <DeferredSocialFooter />
        </Providers>
      </body>
    </html>
  );
}

import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '@/lib/seo/jsonLd';

/** Organization + WebSite schema on every public page (via root layout). */
export function SiteJsonLd() {
  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildWebSiteJsonLd()} />
    </>
  );
}

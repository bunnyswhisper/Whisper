import type { Metadata } from 'next';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalLi, LegalP, LegalStrong, LegalUl } from '@/components/legal/LegalProse';
import { brandSocialUrls } from '@/lib/brandSocialUrls';
import {
  LEGAL_BRAND_NAME,
  LEGAL_BUSINESS_HOURS,
  LEGAL_INSTAGRAM_HANDLE,
  LEGAL_RESPONSE_TIME,
  LEGAL_SUPPORT_EMAIL,
  LEGAL_TIKTOK_HANDLE,
  LEGAL_WHATSAPP_STATUS,
} from '@/lib/legal/constants';
import { buildLegalPageMetadata } from '@/lib/legal/metadata';

export const metadata: Metadata = buildLegalPageMetadata(
  '/contact',
  'Contact',
  `Contact ${LEGAL_BRAND_NAME} for orders, exchanges, and support in Egypt.`,
);

export default function ContactPage() {
  return (
    <LegalPageShell
      title="Contact"
      currentPath="/contact"
      intro="We’re a small team building something we care about. Reach out for order help, exchanges, account questions, or thoughtful collaboration — we read every message."
      sections={[
        {
          id: 'response',
          title: 'Response times',
          body: (
            <>
              <LegalP>{LEGAL_RESPONSE_TIME}</LegalP>
              <LegalP>
                For urgent delivery or payment issues, include your{' '}
                <LegalStrong>order number</LegalStrong> in the subject line so we can find your
                order quickly.
              </LegalP>
            </>
          ),
        },
        {
          id: 'hours',
          title: 'Business hours',
          body: (
            <LegalP>
              <LegalStrong>{LEGAL_BUSINESS_HOURS}</LegalStrong>
            </LegalP>
          ),
        },
        {
          id: 'channels',
          title: 'How to reach us',
          body: (
            <LegalUl>
              <LegalLi>
                <LegalStrong>Email:</LegalStrong>{' '}
                <a
                  href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                  className="text-purple-300 hover:underline"
                >
                  {LEGAL_SUPPORT_EMAIL}
                </a>{' '}
                — best for orders, returns, and account requests.
              </LegalLi>
              <LegalLi>
                <LegalStrong>Instagram:</LegalStrong>{' '}
                <a
                  href={brandSocialUrls.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:underline"
                >
                  {LEGAL_INSTAGRAM_HANDLE}
                </a>{' '}
                — updates, styling, and DMs (we reply when we can).
              </LegalLi>
              <LegalLi>
                <LegalStrong>TikTok:</LegalStrong>{' '}
                <a
                  href={brandSocialUrls.tiktok.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:underline"
                >
                  {LEGAL_TIKTOK_HANDLE}
                </a>
              </LegalLi>
              <LegalLi>
                <LegalStrong>WhatsApp:</LegalStrong> {LEGAL_WHATSAPP_STATUS} — not an active
                support channel yet; please use email for order support.
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'press',
          title: 'Press & collaborations',
          body: (
            <LegalP>
              For press, creators, styling partnerships, or wholesale enquiries, email{' '}
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}?subject=Collaboration%20%E2%80%94%20Bunny%27s%20Whisper`}
                className="text-purple-300 hover:underline"
              >
                {LEGAL_SUPPORT_EMAIL}
              </a>{' '}
              with a short introduction, links to your work, and what you have in mind. We
              review collaboration requests regularly but cannot respond to every submission.
            </LegalP>
          ),
        },
        {
          id: 'policies',
          title: 'Policies',
          body: (
            <>
              <LegalP>Helpful links:</LegalP>
              <LegalUl>
                <LegalLi>
                  <InternalNavLink href="/shipping" className="text-purple-300 hover:underline">
                    Shipping Policy
                  </InternalNavLink>
                </LegalLi>
                <LegalLi>
                  <InternalNavLink href="/returns" className="text-purple-300 hover:underline">
                    Returns &amp; Exchange
                  </InternalNavLink>
                </LegalLi>
                <LegalLi>
                  <InternalNavLink href="/privacy" className="text-purple-300 hover:underline">
                    Privacy Policy
                  </InternalNavLink>
                </LegalLi>
                <LegalLi>
                  <InternalNavLink href="/terms" className="text-purple-300 hover:underline">
                    Terms of Service
                  </InternalNavLink>
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
      ]}
    />
  );
}

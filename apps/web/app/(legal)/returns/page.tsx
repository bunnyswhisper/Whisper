import type { Metadata } from 'next';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalLi, LegalP, LegalStrong, LegalUl } from '@/components/legal/LegalProse';
import { LEGAL_BRAND_NAME } from '@/lib/legal/constants';
import { buildLegalPageMetadata } from '@/lib/legal/metadata';

export const metadata: Metadata = buildLegalPageMetadata(
  '/returns',
  'Returns & Exchange',
  `Exchange window, eligibility, refunds, and how to report damaged or incorrect ${LEGAL_BRAND_NAME} orders.`,
);

export default function ReturnsPolicyPage() {
  return (
    <LegalPageShell
      title="Returns & Exchange"
      currentPath="/returns"
      intro="We want you to love what you wear. This policy explains how exchanges work, when refunds may apply, and what to do if something arrives wrong or damaged."
      sections={[
        {
          id: 'overview',
          title: 'Overview',
          body: (
            <LegalP>
              Bunny&apos;s Whisper operates in Egypt and focuses on{' '}
              <LegalStrong>exchanges</LegalStrong> rather than routine cash refunds. We handle
              faulty items and fulfillment errors separately, as described below.
            </LegalP>
          ),
        },
        {
          id: 'window',
          title: '7-day exchange window',
          body: (
            <LegalP>
              You may request an exchange within{' '}
              <LegalStrong>7 calendar days</LegalStrong> of delivery, provided the item meets
              the eligibility conditions below. The window starts on the date shown in your
              delivery confirmation or courier record.
            </LegalP>
          ),
        },
        {
          id: 'refunds',
          title: 'Refunds',
          body: (
            <>
              <LegalP>
                We do <LegalStrong>not</LegalStrong> offer cash refunds for change-of-mind,
                sizing preference, or style preference once an order has been fulfilled.
              </LegalP>
              <LegalP>
                A refund may be considered only when:
              </LegalP>
              <LegalUl>
                <LegalLi>
                  The item is <LegalStrong>faulty or defective</LegalStrong> (not normal wear
                  or damage after delivery), or
                </LegalLi>
                <LegalLi>
                  We made a <LegalStrong>fulfillment error</LegalStrong> (wrong item, wrong
                  size/colour, or missing piece).
                </LegalLi>
              </LegalUl>
              <LegalP>
                <LegalStrong>Refund processing timeline:</LegalStrong> Approved refunds are
                processed within <LegalStrong>7–14 business days</LegalStrong> after
                inspection and approval. Bank, card, and payment-provider timelines may vary
                and are outside our direct control.
              </LegalP>
            </>
          ),
        },
        {
          id: 'eligibility',
          title: 'Exchange eligibility',
          body: (
            <>
              <LegalP>To qualify for a standard exchange, items must:</LegalP>
              <LegalUl>
                <LegalLi>Be unworn, unwashed, and in original condition.</LegalLi>
                <LegalLi>Include original tags and packaging where provided.</LegalLi>
                <LegalLi>Be free of perfume, stains, alterations, or damage.</LegalLi>
                <LegalLi>Match the product and variant listed on your order.</LegalLi>
              </LegalUl>
              <LegalP>
                We reserve the right to refuse an exchange that does not meet these conditions.
              </LegalP>
            </>
          ),
        },
        {
          id: 'damaged',
          title: 'Damaged or incorrect items',
          body: (
            <>
              <LegalP>
                If your order arrives damaged, defective, or incorrect, contact us within{' '}
                <LegalStrong>48 hours</LegalStrong> of delivery with your order number and
                clear photos of the item and packaging.
              </LegalP>
              <LegalP>
                We will prioritise these cases and work with you on exchange, replacement, or
                refund as appropriate.
              </LegalP>
            </>
          ),
        },
        {
          id: 'sale',
          title: 'Sale & discounted items',
          body: (
            <LegalP>
              Items purchased on sale, outlet pricing, or marked{' '}
              <LegalStrong>final sale</LegalStrong> are not eligible for change-of-mind
              exchanges unless faulty or incorrectly sent. Defective or incorrect sale items
              are still covered under the damaged/incorrect section above.
            </LegalP>
          ),
        },
        {
          id: 'shipping-costs',
          title: 'Return & exchange shipping',
          body: (
            <LegalUl>
              <LegalLi>
                <LegalStrong>Standard exchanges:</LegalStrong> You are responsible for return
                shipping to us unless we state otherwise for your case.
              </LegalLi>
              <LegalLi>
                <LegalStrong>Outbound exchange delivery:</LegalStrong> Bunny&apos;s Whisper
                covers courier delivery of the replacement item for approved exchanges within
                Egypt, subject to our review.
              </LegalLi>
              <LegalLi>
                <LegalStrong>Faulty / our error:</LegalStrong> We will arrange or reimburse
                reasonable return shipping when the issue is confirmed as our responsibility.
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'how-to',
          title: 'How to start a request',
          body: (
            <LegalP>
              Email{' '}
              <a
                href="mailto:support@bunnyswhisper.com"
                className="text-purple-300 hover:underline"
              >
                support@bunnyswhisper.com
              </a>{' '}
              from the email used on your order with your order number, the item(s) involved,
              and the reason for your request. See also our{' '}
              <InternalNavLink href="/contact" className="text-purple-300 hover:underline">
                Contact
              </InternalNavLink>{' '}
              page for support hours.
            </LegalP>
          ),
        },
      ]}
    />
  );
}

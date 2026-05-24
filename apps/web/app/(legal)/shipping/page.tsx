import type { Metadata } from 'next';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalLi, LegalP, LegalStrong, LegalUl } from '@/components/legal/LegalProse';
import { LEGAL_BRAND_NAME } from '@/lib/legal/constants';
import { buildLegalPageMetadata } from '@/lib/legal/metadata';

export const metadata: Metadata = buildLegalPageMetadata(
  '/shipping',
  'Shipping Policy',
  `Shipping times, Egypt delivery zones, cash on delivery, and pre-orders for ${LEGAL_BRAND_NAME}.`,
);

export default function ShippingPolicyPage() {
  return (
    <LegalPageShell
      title="Shipping Policy"
      currentPath="/shipping"
      intro="Bunny’s Whisper ships across Egypt from our SS25 operations. Below is how we process, dispatch, and deliver your order — clearly and without surprises."
      sections={[
        {
          id: 'processing',
          title: 'Order processing',
          body: (
            <>
              <LegalP>
                We begin preparing your order after{' '}
                <LegalStrong>payment is confirmed</LegalStrong> (card) or after your{' '}
                <LegalStrong>COD order is placed</LegalStrong> and accepted.
              </LegalP>
              <LegalUl>
                <LegalLi>
                  <LegalStrong>Standard processing:</LegalStrong> 1–3 business days after
                  payment confirmation.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Launches &amp; peak demand:</LegalStrong> up to 5 business days
                  while we maintain quality and accurate packing.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Business days:</LegalStrong> Sunday–Thursday (Egypt). Orders
                  placed on Thursday evening or Friday–Saturday are processed from the next
                  business week.
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
        {
          id: 'zones',
          title: 'Egypt delivery zones',
          body: (
            <>
              <LegalP>
                Delivery times below are estimates <em>after</em> dispatch, in addition to
                processing time. Your courier will contact you before delivery where possible.
              </LegalP>
              <LegalUl>
                <LegalLi>
                  <LegalStrong>Cairo &amp; Giza:</LegalStrong> typically 1–3 business days
                  after dispatch.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Alexandria &amp; nearby coast:</LegalStrong> typically 2–4
                  business days after dispatch.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Delta &amp; Canal cities:</LegalStrong> typically 3–5 business
                  days after dispatch.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Upper Egypt &amp; remote areas:</LegalStrong> typically 4–7
                  business days after dispatch; some locations may require an additional day
                  depending on courier coverage.
                </LegalLi>
              </LegalUl>
              <LegalP>
                Delivery fees are calculated at checkout based on your city and order details.
              </LegalP>
            </>
          ),
        },
        {
          id: 'cod',
          title: 'Cash on delivery (COD)',
          body: (
            <>
              <LegalP>
                COD is available for eligible orders within our Egypt delivery network. By
                choosing COD, you agree to pay the full order amount in cash to the courier at
                delivery.
              </LegalP>
              <LegalUl>
                <LegalLi>
                  Please ensure your phone number and address are correct so the courier can
                  reach you.
                </LegalLi>
                <LegalLi>
                  Repeated failed delivery attempts or refusal without a valid reason may
                  affect future COD eligibility on your account.
                </LegalLi>
                <LegalLi>
                  If you need to change delivery details, contact us as soon as possible —
                  see our <InternalNavLink href="/contact" className="text-purple-300 hover:underline">Contact</InternalNavLink> page.
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
        {
          id: 'preorders',
          title: 'Pre-orders',
          body: (
            <>
              <LegalP>
                Some SS25 pieces may be offered as <LegalStrong>pre-order</LegalStrong> when
                noted on the product page or at checkout.
              </LegalP>
              <LegalUl>
                <LegalLi>
                  Pre-order items ship according to the estimated timeline shown at purchase.
                </LegalLi>
                <LegalLi>
                  Processing time for pre-orders starts from the stated availability date,
                  not necessarily from the day you pay.
                </LegalLi>
                <LegalLi>
                  Mixed carts (in-stock + pre-order) may ship in one parcel or split
                  shipments; we will inform you if your order is affected.
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
        {
          id: 'delays',
          title: 'Delays Outside Our Control',
          body: (
            <LegalP>
              Bunny&apos;s Whisper is not responsible for delays caused by events outside our
              reasonable control, including courier disruption, weather, public holidays,
              payment-provider outages, internet or platform outages, government restrictions,
              or other operational disruptions. We will still do our best to keep you updated
              when we have information from our delivery partners.
            </LegalP>
          ),
        },
        {
          id: 'lost-damaged',
          title: 'Lost or damaged shipments',
          body: (
            <>
              <LegalP>
                If your parcel arrives damaged, missing items, or does not arrive within a
                reasonable time after the estimated delivery window, contact us promptly at{' '}
                <a
                  href="mailto:support@bunnyswhisper.com"
                  className="text-purple-300 hover:underline"
                >
                  support@bunnyswhisper.com
                </a>{' '}
                with your order number and photos where applicable.
              </LegalP>
              <LegalUl>
                <LegalLi>
                  We will review the case with our courier partner and respond with the
                  appropriate next step (replacement, exchange, or other resolution in line
                  with our{' '}
                  <InternalNavLink href="/returns" className="text-purple-300 hover:underline">
                    Returns &amp; Exchange
                  </InternalNavLink>{' '}
                  policy).
                </LegalLi>
                <LegalLi>
                  Claims are easier to resolve when reported soon after delivery or the
                  expected delivery date.
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
      ]}
    />
  );
}

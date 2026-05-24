import type { Metadata } from 'next';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalLi, LegalP, LegalStrong, LegalUl } from '@/components/legal/LegalProse';
import { LEGAL_BRAND_NAME, LEGAL_SUPPORT_EMAIL } from '@/lib/legal/constants';
import { buildLegalPageMetadata } from '@/lib/legal/metadata';

export const metadata: Metadata = buildLegalPageMetadata(
  '/terms',
  'Terms of Service',
  `Terms for shopping with ${LEGAL_BRAND_NAME} in Egypt, including orders, payments, loyalty, and liability.`,
);

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      currentPath="/terms"
      intro="By using the Bunny’s Whisper website and placing an order, you agree to these terms. Please read them carefully — they are written to be clear, not confusing."
      sections={[
        {
          id: 'overview',
          title: 'Overview',
          body: (
            <>
              <LegalP>
                These Terms of Service (&quot;Terms&quot;) apply to your use of the Bunny&apos;s
                Whisper online store and related services for our SS25 Collection in Egypt.
              </LegalP>
              <LegalP>
                These Terms are governed by the laws of the{' '}
                <LegalStrong>Arab Republic of Egypt</LegalStrong>. Disputes shall be subject to
                the competent courts in Egypt, without prejudice to mandatory consumer
                protections that apply to you.
              </LegalP>
            </>
          ),
        },
        {
          id: 'products',
          title: 'Products & accuracy',
          body: (
            <LegalUl>
              <LegalLi>
                We describe products as accurately as possible, including images, colours,
                sizes, and materials. Minor variations may occur due to screens, lighting, or
                production batches.
              </LegalLi>
              <LegalLi>
                Availability is shown on the site but may change quickly during launches.
              </LegalLi>
              <LegalLi>
                If an item becomes unavailable after you order, we will contact you with
                options (exchange, credit, or refund where appropriate).
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'pricing',
          title: 'Pricing & orders',
          body: (
            <LegalUl>
              <LegalLi>
                Prices are shown in Egyptian Pounds (EGP) unless stated otherwise and may
                include applicable taxes or fees as displayed at checkout.
              </LegalLi>
              <LegalLi>
                An order is confirmed when you receive an order confirmation from us and we
                accept the order. We may refuse or cancel orders in cases of error, suspected
                fraud, or stock unavailability.
              </LegalLi>
              <LegalLi>
                You are responsible for providing accurate delivery and contact information.
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'payments',
          title: 'Payments & order status',
          body: (
            <>
              <LegalP>
                We accept payment methods shown at checkout, including card payments and cash
                on delivery (COD) where available.
              </LegalP>
              <LegalP>
                Online card payments are processed through{' '}
                <LegalStrong>Paymob</LegalStrong>.{' '}
                <LegalStrong>
                  Pending, failed, cancelled, or expired payment attempts do not create a
                  confirmed paid order
                </LegalStrong>{' '}
                unless payment is verified as successful. Bunny&apos;s Whisper may cancel or
                expire unpaid pending orders and release reserved or deducted stock so items
                can be sold to other customers.
              </LegalP>
              <LegalP>
                COD orders are payable in cash to the courier on delivery, subject to our{' '}
                <InternalNavLink href="/shipping" className="text-purple-300 hover:underline">
                  Shipping Policy
                </InternalNavLink>
                .
              </LegalP>
            </>
          ),
        },
        {
          id: 'account',
          title: 'Your account',
          body: (
            <LegalUl>
              <LegalLi>
                Keep your login details confidential and notify us if you suspect unauthorised
                access.
              </LegalLi>
              <LegalLi>
                You must provide accurate registration and checkout information.
              </LegalLi>
              <LegalLi>
                One person may not maintain multiple accounts to abuse promotions or loyalty
                benefits.
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'conduct',
          title: 'Prohibited conduct',
          body: (
            <>
              <LegalP>You agree not to:</LegalP>
              <LegalUl>
                <LegalLi>
                  Use the site for unlawful purposes or to harass, abuse, or harm others.
                </LegalLi>
                <LegalLi>
                  Attempt to interfere with site security, scrape data, or overload our
                  systems.
                </LegalLi>
                <LegalLi>
                  Resell or commercially exploit products obtained through abuse of promotions,
                  loyalty, or QR systems.
                </LegalLi>
                <LegalLi>
                  Submit false orders, payment disputes, or return claims.
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
        {
          id: 'loyalty',
          title: 'Loyalty, points & QR offers',
          body: (
            <LegalUl>
              <LegalLi>
                Bunny Points, coupons, and QR or event rewards are subject to programme rules
                shown at the time of offer.
              </LegalLi>
              <LegalLi>
                Rewards have no cash value unless we explicitly state otherwise.
              </LegalLi>
              <LegalLi>
                We may modify, suspend, or cancel loyalty benefits to prevent fraud, technical
                abuse, or duplicate accounts.
              </LegalLi>
              <LegalLi>
                Sharing or selling reward codes, or using automated tools to claim offers, is
                prohibited.
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'ip',
          title: 'Intellectual property',
          body: (
            <LegalP>
              All content on this site — including the Bunny&apos;s Whisper name, logo,
              product photography, designs, and text — is owned by or licensed to us. You may
              not copy, reproduce, or use our branding without written permission.
            </LegalP>
          ),
        },
        {
          id: 'shipping-returns',
          title: 'Shipping, returns & exchanges',
          body: (
            <LegalP>
              Delivery, exchanges, and related matters are governed by our{' '}
              <InternalNavLink href="/shipping" className="text-purple-300 hover:underline">
                Shipping Policy
              </InternalNavLink>{' '}
              and{' '}
              <InternalNavLink href="/returns" className="text-purple-300 hover:underline">
                Returns &amp; Exchange
              </InternalNavLink>{' '}
              policies, which are incorporated into these Terms.
            </LegalP>
          ),
        },
        {
          id: 'delays',
          title: 'Delays Outside Our Control',
          body: (
            <LegalP>
              Bunny&apos;s Whisper is not liable for failure or delay in performing obligations
              where caused by events outside our reasonable control, including courier
              disruption, weather, public holidays, payment-provider outages, internet or
              platform outages, government restrictions, or similar operational disruptions.
            </LegalP>
          ),
        },
        {
          id: 'liability',
          title: 'Limitation of liability',
          body: (
            <>
              <LegalP>
                To the fullest extent permitted by Egyptian law, Bunny&apos;s Whisper is not
                liable for indirect, incidental, or consequential losses (such as lost
                profits or goodwill) arising from your use of the site or products.
              </LegalP>
              <LegalP>
                Our total liability for any claim relating to an order is limited to the amount
                you paid for that order, except where the law requires otherwise (for example
                in cases of personal injury caused by our proven negligence).
              </LegalP>
            </>
          ),
        },
        {
          id: 'privacy',
          title: 'Privacy',
          body: (
            <LegalP>
              Our{' '}
              <InternalNavLink href="/privacy" className="text-purple-300 hover:underline">
                Privacy Policy
              </InternalNavLink>{' '}
              explains how we handle personal data and is part of your agreement with us.
            </LegalP>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to these Terms',
          body: (
            <LegalP>
              We may update these Terms from time to time. The version on this page applies when
              you place an order. Material changes will be reflected by updating the effective
              date shown at the top of our legal pages.
            </LegalP>
          ),
        },
        {
          id: 'contact',
          title: 'Contact',
          body: (
            <LegalP>
              Questions about these Terms? Email{' '}
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                className="text-purple-300 hover:underline"
              >
                {LEGAL_SUPPORT_EMAIL}
              </a>{' '}
              or visit our{' '}
              <InternalNavLink href="/contact" className="text-purple-300 hover:underline">
                Contact
              </InternalNavLink>{' '}
              page.
            </LegalP>
          ),
        },
      ]}
    />
  );
}

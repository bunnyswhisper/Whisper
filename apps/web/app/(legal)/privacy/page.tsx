import type { Metadata } from 'next';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalLi, LegalP, LegalStrong, LegalUl } from '@/components/legal/LegalProse';
import { LEGAL_BRAND_NAME, LEGAL_SUPPORT_EMAIL } from '@/lib/legal/constants';
import { buildLegalPageMetadata } from '@/lib/legal/metadata';

export const metadata: Metadata = buildLegalPageMetadata(
  '/privacy',
  'Privacy Policy',
  `How ${LEGAL_BRAND_NAME} collects, uses, and protects your personal data in Egypt.`,
);

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      currentPath="/privacy"
      intro="Your privacy matters to us. This policy explains what information we collect when you shop with Bunny’s Whisper, how we use it, and the choices you have."
      sections={[
        {
          id: 'who',
          title: 'Who we are',
          body: (
            <LegalP>
              Bunny&apos;s Whisper is a clothing brand operating in Egypt (SS25 Collection).
              For privacy questions, contact us at{' '}
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                className="text-purple-300 hover:underline"
              >
                {LEGAL_SUPPORT_EMAIL}
              </a>
              .
            </LegalP>
          ),
        },
        {
          id: 'collect',
          title: 'Information we collect',
          body: (
            <>
              <LegalP>Depending on how you use our website, we may collect:</LegalP>
              <LegalUl>
                <LegalLi>
                  <LegalStrong>Account &amp; profile:</LegalStrong> name, email, phone,
                  delivery address, and preferences you save.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Order data:</LegalStrong> items purchased, payment method
                  type, delivery details, and order status.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Authentication:</LegalStrong> login identifiers managed through
                  our auth provider (see below).
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Device &amp; usage:</LegalStrong> browser type, pages viewed,
                  and similar technical data via cookies or analytics tools.
                </LegalLi>
                <LegalLi>
                  <LegalStrong>Loyalty &amp; event rewards:</LegalStrong> participation in
                  Bunny Points, QR campaigns, or in-person event offers where you choose to
                  take part.
                </LegalLi>
              </LegalUl>
            </>
          ),
        },
        {
          id: 'auth',
          title: 'Authentication (Supabase)',
          body: (
            <LegalP>
              Customer accounts and secure sign-in are handled through{' '}
              <LegalStrong>Supabase Authentication</LegalStrong>. Supabase processes login
              credentials and session tokens on our behalf. We use this to identify your
              account, protect access, and link orders to you where applicable.
            </LegalP>
          ),
        },
        {
          id: 'payments',
          title: 'Payments (Paymob)',
          body: (
            <>
              <LegalP>
                Online card payments are processed by{' '}
                <LegalStrong>Paymob</LegalStrong>, our payment partner. When you pay by card,
                you may be redirected to Paymob&apos;s secure checkout. Paymob handles card
                processing in line with its own privacy and security practices.
              </LegalP>
              <LegalP>
                <LegalStrong>Bunny&apos;s Whisper does not store your full card number or
                card security code.</LegalStrong> We may receive payment status, transaction
                references, and amounts needed to fulfil and support your order.
              </LegalP>
            </>
          ),
        },
        {
          id: 'cookies',
          title: 'Cookies & local storage',
          body: (
            <>
              <LegalP>
                We use cookies and browser local storage to run the site — for example to keep
                you signed in, remember your cart, save addresses, and support loyalty
                features.
              </LegalP>
              <LegalP>
                <LegalStrong>Cookie &amp; analytics consent:</LegalStrong> You can manage
                cookies and local storage through your browser settings. Disabling storage may
                affect login, cart, saved addresses, loyalty features, or checkout.
              </LegalP>
            </>
          ),
        },
        {
          id: 'analytics',
          title: 'Analytics',
          body: (
            <LegalP>
              We may use analytics tools to understand how visitors use our store (for example
              which pages are viewed and how checkout performs). This helps us improve
              products, sizing information, and the shopping experience. Where required, we
              rely on appropriate consent mechanisms.
            </LegalP>
          ),
        },
        {
          id: 'loyalty',
          title: 'Loyalty & QR rewards',
          body: (
            <LegalP>
              If you join Bunny Points, scan event QR codes, or redeem offers, we process the
              data needed to grant rewards, prevent abuse, and show your balance or coupons in
              your account. This may be linked to your user ID and email.
            </LegalP>
          ),
        },
        {
          id: 'communications',
          title: 'Order & service communications',
          body: (
            <LegalP>
              If you are logged in or have provided contact details at checkout, Bunny&apos;s
              Whisper may send order updates, abandoned-cart reminders, or other service
              messages related to your purchase. Marketing messages are sent only where
              permitted or consented, and you can opt out where applicable.
            </LegalP>
          ),
        },
        {
          id: 'sharing',
          title: 'How we share information',
          body: (
            <LegalUl>
              <LegalLi>
                <LegalStrong>Service providers:</LegalStrong> hosting, authentication,
                payments, email, analytics, and delivery partners who need data to perform
                their services.
              </LegalLi>
              <LegalLi>
                <LegalStrong>Legal &amp; safety:</LegalStrong> when required by law, to
                protect our rights, or to prevent fraud and abuse.
              </LegalLi>
              <LegalLi>
                We do <LegalStrong>not</LegalStrong> sell your personal data.
              </LegalLi>
            </LegalUl>
          ),
        },
        {
          id: 'retention',
          title: 'Data retention & deletion',
          body: (
            <>
              <LegalP>
                We keep personal data only as long as needed for the purposes above, including
                order history, accounting, fraud prevention, and customer support.
              </LegalP>
              <LegalP>
                <LegalStrong>Account &amp; data requests:</LegalStrong> You may request
                access, correction, or deletion of personal data by emailing{' '}
                <a
                  href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                  className="text-purple-300 hover:underline"
                >
                  {LEGAL_SUPPORT_EMAIL}
                </a>{' '}
                from the email address on your account. Some records may be retained where
                required for legal, accounting, fraud prevention, payment disputes, courier,
                or order-support reasons.
              </LegalP>
            </>
          ),
        },
        {
          id: 'security',
          title: 'Security',
          body: (
            <LegalP>
              Bunny&apos;s Whisper uses reasonable technical and organizational safeguards to
              protect your information. No online platform can be guaranteed 100% secure, so
              we encourage strong passwords and caution when using shared devices.
            </LegalP>
          ),
        },
        {
          id: 'rights',
          title: 'Your choices',
          body: (
            <LegalP>
              You may update profile details in your account where available, manage browser
              storage as described above, and contact us for other requests. For full terms of
              using the site, see our{' '}
<InternalNavLink href="/terms" className="text-purple-300 hover:underline">
              Terms of Service
            </InternalNavLink>
              .
            </LegalP>
          ),
        },
      ]}
    />
  );
}

import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalP, LegalStrong } from '@/components/legal/LegalProse';
import { LEGAL_BRAND_NAME, LEGAL_SUPPORT_EMAIL } from '@/lib/legal/constants';
import { buildLegalPageMetadata } from '@/lib/legal/metadata';

export const metadata: Metadata = buildLegalPageMetadata(
  '/account-cancellation',
  'Account Cancellation',
  `How to request deletion or cancellation of your ${LEGAL_BRAND_NAME} account.`,
);

export default function AccountCancellationPage() {
  return (
    <LegalPageShell
      title="Account Cancellation"
      currentPath="/account-cancellation"
      intro="At Bunny’s Whisper, you are always in control of your account. If you would like to delete or cancel your Bunny’s Whisper account, please contact us by email and we will help process your request."
      sections={[
        {
          id: 'request',
          title: 'How to request cancellation',
          body: (
            <>
              <LegalP>
                To request account cancellation, email us from the{' '}
                <LegalStrong>same email address</LegalStrong> linked to your Bunny&apos;s
                Whisper account with the subject line{' '}
                <LegalStrong>&ldquo;Account Cancellation Request&rdquo;</LegalStrong>.
              </LegalP>
              <LegalP>
                <a
                  href={`mailto:${LEGAL_SUPPORT_EMAIL}?subject=Account%20Cancellation%20Request`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white"
                >
                  Email {LEGAL_SUPPORT_EMAIL}
                </a>
              </LegalP>
            </>
          ),
        },
        {
          id: 'verification',
          title: 'Identity verification',
          body: (
            <LegalP>
              For your security, we may ask you to verify your identity before completing
              the request. Once processed, your account access may be removed and you may
              no longer be able to view your account history from the website.
            </LegalP>
          ),
        },
        {
          id: 'retention',
          title: 'Records we may retain',
          body: (
            <LegalP>
              Please note that some order, payment, delivery, or support records may be
              retained where required for legal, accounting, fraud-prevention, or
              dispute-resolution purposes.
            </LegalP>
          ),
        },
        {
          id: 'confirmation',
          title: 'Confirmation',
          body: (
            <LegalP>
              We will confirm by email once your request has been reviewed or completed.
              If you have questions before submitting, you can reach us anytime at{' '}
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
      ]}
    />
  );
}

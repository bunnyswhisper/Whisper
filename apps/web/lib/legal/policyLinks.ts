export type LegalPolicyLink = {
  href: string;
  label: string;
  shortLabel?: string;
};

export const legalPolicyLinks: LegalPolicyLink[] = [
  { href: '/reviews', label: 'Customer Reviews', shortLabel: 'Reviews' },
  { href: '/shipping', label: 'Shipping Policy', shortLabel: 'Shipping' },
  { href: '/returns', label: 'Returns & Exchange', shortLabel: 'Returns' },
  { href: '/privacy', label: 'Privacy Policy', shortLabel: 'Privacy' },
  {
    href: '/account-cancellation',
    label: 'Account Cancellation',
    shortLabel: 'Account',
  },
  { href: '/terms', label: 'Terms of Service', shortLabel: 'Terms' },
  { href: '/contact', label: 'Contact', shortLabel: 'Contact' },
];

export function findLegalPolicyLink(pathname: string) {
  return legalPolicyLinks.find((link) => link.href === pathname);
}

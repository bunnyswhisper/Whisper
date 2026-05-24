'use client';

import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { legalPolicyLinks } from '@/lib/legal/policyLinks';

/** Compact legal links for the site footer — unobtrusive, not a full redesign. */
export function LegalFooterLinks() {
  return (
    <nav
      aria-label="Policies and support"
      className="mx-auto mt-10 flex max-w-lg flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-8"
    >
      {legalPolicyLinks.map((link) => (
        <InternalNavLink
          key={link.href}
          href={link.href}
          className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35 transition hover:text-purple-200/90 sm:text-[11px] sm:tracking-[0.26em]"
        >
          {link.shortLabel ?? link.label}
        </InternalNavLink>
      ))}
    </nav>
  );
}

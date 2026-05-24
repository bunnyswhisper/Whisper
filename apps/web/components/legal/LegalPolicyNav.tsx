'use client';

import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { legalPolicyLinks } from '@/lib/legal/policyLinks';

export function LegalPolicyNav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Legal policies" className="mt-6 flex flex-wrap gap-2">
      {legalPolicyLinks.map((link) => {
        const active = link.href === currentPath;
        return (
          <InternalNavLink
            key={link.href}
            href={link.href}
            className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
              active
                ? 'border-purple-300/50 bg-purple-500/20 text-purple-100'
                : 'border-purple-950/80 bg-[#0b0f1a] text-gray-400 hover:border-purple-400/40 hover:text-white'
            }`}
          >
            {link.shortLabel ?? link.label}
          </InternalNavLink>
        );
      })}
    </nav>
  );
}

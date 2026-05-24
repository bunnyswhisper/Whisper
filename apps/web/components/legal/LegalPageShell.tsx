import type { ReactNode } from 'react';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { LegalPolicyNav } from '@/components/legal/LegalPolicyNav';
import {
  LEGAL_BRAND_NAME,
  LEGAL_LAST_UPDATED,
  LEGAL_METADATA_LINE,
  LEGAL_SUPPORT_EMAIL,
} from '@/lib/legal/constants';

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

type LegalPageShellProps = {
  title: string;
  intro: string;
  currentPath: string;
  sections: LegalSection[];
};

export function LegalPageShell({
  title,
  intro,
  currentPath,
  sections,
}: LegalPageShellProps) {
  return (
    <article className="mx-auto max-w-3xl">
        <header className="rounded-3xl border border-purple-950/80 bg-[#0b0f1a] p-6 shadow-[0_18px_50px_rgba(168,85,247,0.12)] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-purple-300/80">
            {LEGAL_BRAND_NAME}
          </p>
          <h1 className="mt-3 bg-linear-to-r from-white via-purple-100 to-fuchsia-400 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-300 sm:text-base">
            {intro}
          </p>
          <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-purple-200/50">
            {LEGAL_METADATA_LINE}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">{LEGAL_LAST_UPDATED}</p>
        </header>

        <LegalPolicyNav currentPath={currentPath} />

        <div className="mt-8 space-y-5">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-purple-950/70 bg-[#0b0f1a]/90 p-5 sm:p-6"
            >
              <h2 className="text-lg font-bold text-purple-100 sm:text-xl">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-300 sm:text-[15px]">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 rounded-2xl border border-purple-900/40 bg-gradient-to-br from-purple-950/40 to-[#0b0f1a] p-6 text-center sm:p-8">
          <p className="text-sm font-semibold text-white">Need help?</p>
          <p className="mt-2 text-sm text-gray-400">
            Our team is here for orders, exchanges, and account questions.
          </p>
          <a
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full border border-purple-300/40 bg-purple-500/15 px-6 text-sm font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black"
          >
            Email {LEGAL_SUPPORT_EMAIL}
          </a>
          <p className="mt-4 text-xs text-gray-500">
            Or visit our{' '}
            <InternalNavLink
              href="/contact"
              className="text-purple-300 underline-offset-2 hover:underline"
            >
              Contact page
            </InternalNavLink>
            .
          </p>
        </footer>
    </article>
  );
}

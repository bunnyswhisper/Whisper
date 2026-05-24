'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { interactivePressable } from '@/lib/interactivePressable';

export type PremiumEmptyStateVariant = 'default' | 'muted' | 'error' | 'search';

export type PremiumEmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type PremiumEmptyStateProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  variant?: PremiumEmptyStateVariant;
  primaryAction?: PremiumEmptyStateAction;
  secondaryAction?: PremiumEmptyStateAction;
  icon?: ReactNode;
  showMark?: boolean;
  compact?: boolean;
  className?: string;
};

const variantChrome: Record<
  PremiumEmptyStateVariant,
  { border: string; eyebrow: string; orb: string }
> = {
  default: {
    border: 'border-purple-300/25',
    eyebrow: 'text-purple-300',
    orb: 'bg-[radial-gradient(circle,rgba(168,85,247,0.35)_0%,transparent_68%)]',
  },
  muted: {
    border: 'border-purple-950/90',
    eyebrow: 'text-purple-300/85',
    orb: 'bg-[radial-gradient(circle,rgba(88,28,135,0.28)_0%,transparent_70%)]',
  },
  error: {
    border: 'border-red-400/35',
    eyebrow: 'text-red-300',
    orb: 'bg-[radial-gradient(circle,rgba(248,113,113,0.22)_0%,transparent_68%)]',
  },
  search: {
    border: 'border-purple-300/22',
    eyebrow: 'text-fuchsia-300/90',
    orb: 'bg-[radial-gradient(circle,rgba(192,132,252,0.28)_0%,transparent_68%)]',
  },
};

function EmptyStateAction({
  action,
  primary,
}: {
  action: PremiumEmptyStateAction;
  primary?: boolean;
}) {
  const className = primary
    ? `inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-8 py-3 text-sm font-bold text-black sm:text-base hover:bg-white hover:shadow-[0_0_35px_rgba(168,85,247,0.55)] ${interactivePressable}`
    : `inline-flex min-h-11 items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/10 px-6 py-2.5 text-sm font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/20 ${interactivePressable}`;

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export function PremiumEmptyState({
  eyebrow,
  title,
  description,
  variant = 'default',
  primaryAction,
  secondaryAction,
  icon,
  showMark = true,
  compact = false,
  className = '',
}: PremiumEmptyStateProps) {
  const chrome = variantChrome[variant];
  const titleId = 'bw-empty-title';

  return (
    <section
      className={`bw-empty-enter relative overflow-hidden rounded-3xl border bg-[#0d0716] text-center shadow-[0_18px_60px_rgba(168,85,247,0.18)] ${chrome.border} ${
        compact ? 'min-h-[200px] p-5 sm:p-7' : 'min-h-[280px] p-6 sm:p-10'
      } ${className}`}
      aria-labelledby={titleId}
    >
      <div
        className={`pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full blur-3xl ${chrome.orb} bw-empty-glow`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -bottom-24 -right-12 h-56 w-56 rounded-full blur-3xl ${chrome.orb} bw-empty-glow`}
        style={{ animationDelay: '1.2s' }}
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex max-w-xl flex-col items-center">
        {showMark ? (
          <div
            className={`bw-empty-glow relative flex items-center justify-center rounded-full border border-purple-300/20 bg-[#05070d]/80 ${
              compact ? 'mb-4 h-14 w-14' : 'mb-5 h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]'
            }`}
          >
            {icon ?? (
              <img
                src="/logo.png"
                alt=""
                width={compact ? 36 : 44}
                height={compact ? 36 : 44}
                decoding="async"
                className={`object-contain opacity-90 drop-shadow-[0_0_18px_rgba(168,85,247,0.45)] ${
                  compact ? 'h-9 w-9' : 'h-11 w-11'
                }`}
              />
            )}
          </div>
        ) : icon ? (
          <div className={compact ? 'mb-4' : 'mb-5'}>{icon}</div>
        ) : null}

        {eyebrow ? (
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.28em] sm:text-xs sm:tracking-[0.32em] ${chrome.eyebrow}`}
          >
            {eyebrow}
          </p>
        ) : null}

        <h2
          id={titleId}
          className={`font-black text-white ${
            compact
              ? 'mt-2 text-xl sm:text-2xl'
              : 'mt-3 text-2xl sm:mt-4 sm:text-3xl md:text-4xl'
          }`}
        >
          {title}
        </h2>

        {description ? (
          <p
            className={`mx-auto text-gray-400 ${
              compact ? 'mt-2 max-w-md text-xs sm:text-sm' : 'mt-3 max-w-lg text-sm sm:text-base'
            }`}
          >
            {description}
          </p>
        ) : null}

        {primaryAction || secondaryAction ? (
          <div
            className={`flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center ${
              compact ? 'mt-5' : 'mt-7 sm:mt-8'
            }`}
          >
            {primaryAction ? (
              <EmptyStateAction action={primaryAction} primary />
            ) : null}
            {secondaryAction ? (
              <EmptyStateAction action={secondaryAction} />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

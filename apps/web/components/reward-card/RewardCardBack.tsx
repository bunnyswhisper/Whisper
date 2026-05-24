'use client';

import type { ReactNode } from 'react';
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks';
import { brandSocialUrls } from '@/lib/brandSocialUrls';

export type RewardCardBackProps = {
  instagramQrSrc?: string | null;
  tiktokQrSrc?: string | null;
  facebookQrSrc?: string | null;
  qrLoading?: boolean;
  qrError?: boolean;
  className?: string;
  /** Fade-up motion when footer enters view (site footer only). */
  footerRevealed?: boolean;
};

/**
 * Site footer: editorial branding + social QR grid.
 * (Print reward card back uses HTML in lib/rewardCard — not this component.)
 */
export function RewardCardBack({
  instagramQrSrc,
  tiktokQrSrc,
  facebookQrSrc,
  qrLoading,
  qrError,
  footerRevealed = true,
  className = '',
}: RewardCardBackProps) {
  const year = new Date().getFullYear();
  const reveal = footerRevealed;

  return (
    <div
      className={`px-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16 sm:pb-20 sm:pt-24 ${className}`}
    >
      <header
        className={`mx-auto flex max-w-2xl flex-col items-center text-center motion-safe:transition-all motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
          reveal ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <img
          src="/logo.png"
          alt="Bunny&apos;s Whisper"
          width={96}
          height={96}
          decoding="async"
          className="size-[5.25rem] object-contain motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:hover:scale-[1.03] sm:size-28 drop-shadow-[0_0_36px_rgba(168,85,247,0.38)]"
        />
        <h2 className="mt-10 font-light text-[clamp(1.65rem,5vw,2.75rem)] uppercase leading-none tracking-[0.42em] text-white/[0.94] sm:tracking-[0.48em]">
          Bunny&apos;s Whisper
        </h2>
        <p className="mt-6 max-w-[22rem] text-[10px] font-medium uppercase leading-relaxed tracking-[0.32em] text-purple-200/50 sm:text-[11px] sm:tracking-[0.36em]">
          Stay close — scan to follow
        </p>
      </header>

      <div
        className={`mx-auto mt-10 max-w-3xl motion-safe:transition-all motion-safe:delay-150 motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] sm:mt-20 ${
          reveal ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
        }`}
      >
        {qrError ? (
          <p className="text-center text-[13px] font-light tracking-wide text-rose-300/75">
            Unable to load codes. Pull down to refresh.
          </p>
        ) : qrLoading || !instagramQrSrc || !tiktokQrSrc || !facebookQrSrc ? (
          <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-row sm:justify-center sm:gap-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 sm:gap-4">
                <div className="size-[4.5rem] rounded-2xl bg-white/[0.04] motion-safe:animate-pulse ring-1 ring-white/[0.06] sm:size-[7.25rem]" />
                <div className="h-2 w-10 rounded-full bg-white/[0.06] motion-safe:animate-pulse sm:w-14" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-row sm:justify-center sm:gap-16 lg:gap-20">
            <SocialQrCell
              href={brandSocialUrls.instagram.url}
              label={brandSocialUrls.instagram.label}
              src={instagramQrSrc}
              floatClassName="bw-qr-float"
            />
            <SocialQrCell
              href={brandSocialUrls.tiktok.url}
              label={brandSocialUrls.tiktok.label}
              src={tiktokQrSrc}
              floatClassName="bw-qr-float bw-qr-float-delay-1"
            />
            <SocialQrCell
              href={brandSocialUrls.facebook.url}
              label={brandSocialUrls.facebook.label}
              src={facebookQrSrc}
              floatClassName="bw-qr-float bw-qr-float-delay-2"
            />
          </div>
        )}
      </div>

      <nav
        aria-label="Social profiles"
        className={`mx-auto mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 motion-safe:transition-all motion-safe:delay-300 motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] sm:mt-16 ${
          reveal ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        <SocialIconLink href={brandSocialUrls.instagram.url} label={brandSocialUrls.instagram.label}>
          <IconInstagram />
        </SocialIconLink>
        <SocialIconLink href={brandSocialUrls.tiktok.url} label={brandSocialUrls.tiktok.label}>
          <IconTikTok />
        </SocialIconLink>
        <SocialIconLink href={brandSocialUrls.facebook.url} label={brandSocialUrls.facebook.label}>
          <IconFacebook />
        </SocialIconLink>
      </nav>

      <LegalFooterLinks />

      <p
        className={`mx-auto mt-8 max-w-md text-center font-light text-[10px] uppercase tracking-[0.38em] text-white/[0.28] motion-safe:transition-opacity motion-safe:delay-500 motion-safe:duration-1000 sm:mt-10 sm:text-[11px] sm:tracking-[0.42em] ${
          reveal ? 'opacity-100' : 'opacity-0'
        }`}
      >
        © {year} Bunny&apos;s Whisper
      </p>
    </div>
  );
}

function SocialIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group flex h-11 w-11 items-center justify-center rounded-full text-purple-200/70 motion-safe:transition-all motion-safe:duration-500 hover:text-white motion-safe:hover:shadow-[0_0_28px_rgba(168,85,247,0.35)] motion-safe:hover:ring-1 motion-safe:hover:ring-purple-400/35"
    >
      <span className="motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-110">
        {children}
      </span>
    </a>
  );
}

function IconInstagram() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-90">
      <path
        d="M12 16a4 4 0 100-8 4 4 0 000 8z"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M3 16V8a5 5 0 015-5h8a5 5 0 015 5v8a5 5 0 01-5 5H8a5 5 0 01-5-5z"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-90">
      <path
        d="M14.5 5v10.2c0 2.4-1.8 4.3-4 4.3s-4-1.9-4-4.3 1.8-4.2 4-4.2c.3 0 .6 0 .9.1V8.1c-.3 0-.6-.1-.9-.1-3.3 0-6 2.6-6 5.9 0 3.2 2.7 5.9 6 5.9s6-2.6 6-5.9V5h-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-90">
      <path
        d="M14 9h2V6h-2c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.5l.5-3H13v-2c0-.6.4-1 1-1z"
        fill="currentColor"
      />
    </svg>
  );
}

function SocialQrCell({
  href,
  label,
  src,
  floatClassName,
}: {
  href: string;
  label: string;
  src: string;
  floatClassName: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex min-w-0 flex-col items-center gap-2 text-purple-100/90 motion-safe:transition-colors motion-safe:duration-500 hover:text-white sm:gap-5 ${floatClassName} motion-reduce:animate-none`}
    >
      <span className="relative">
        <span
          className="pointer-events-none absolute -inset-2 rounded-[1.35rem] bg-[radial-gradient(circle_at_50%_40%,rgba(168,85,247,0.22),transparent_68%)] opacity-70 blur-lg motion-safe:transition-opacity motion-safe:duration-700 motion-safe:group-hover:opacity-100 sm:-inset-4 sm:blur-xl"
          aria-hidden
        />
        <span className="relative block rounded-[1.15rem] bg-gradient-to-br from-purple-400/25 via-white/[0.08] to-fuchsia-500/15 p-[1px] shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:shadow-[0_0_52px_-8px_rgba(168,85,247,0.65),0_0_0_1px_rgba(255,255,255,0.1)_inset] motion-safe:group-hover:scale-[1.025]">
          <span className="block rounded-[1.1rem] bg-[#0a0612]/90 p-2 backdrop-blur-sm sm:p-3.5">
            <img
              src={src}
              alt=""
              width={112}
              height={112}
              className="size-[4.5rem] object-contain sm:size-[7.25rem]"
            />
          </span>
        </span>
      </span>
      <span className="max-w-full truncate text-center text-[8px] font-medium uppercase tracking-[0.16em] text-purple-200/65 motion-safe:transition-colors motion-safe:duration-500 motion-safe:group-hover:text-purple-100 sm:text-[10px] sm:tracking-[0.28em]">
        {label}
      </span>
    </a>
  );
}

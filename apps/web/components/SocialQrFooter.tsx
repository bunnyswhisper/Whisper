'use client';

import { useEffect, useRef, useState } from 'react';
import { RewardCardBack } from '@/components/reward-card/RewardCardBack';
import type { SocialQrDataUrls } from '@/lib/rewardCard/socialQrDataUrls';
import { generateSocialQrDataUrls } from '@/lib/rewardCard/socialQrDataUrls';

export default function SocialQrFooter() {
  const [data, setData] = useState<SocialQrDataUrls | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [footerRevealed, setFooterRevealed] = useState(false);
  const [qrEnabled, setQrEnabled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const qrStartedRef = useRef(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setFooterRevealed(true);
      setQrEnabled(true);
    }
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setFooterRevealed(true);
        setQrEnabled(true);
      },
      { threshold: 0.06, rootMargin: '200px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!qrEnabled || qrStartedRef.current) return;
    qrStartedRef.current = true;

    let cancelled = false;
    setStatus('loading');

    void (async () => {
      try {
        const urls = await generateSocialQrDataUrls({ width: 112 });
        if (!cancelled) {
          setData(urls);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qrEnabled]);

  const qrLoading = !qrEnabled || status === 'loading' || status === 'idle';

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/[0.06] bg-[#020105]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-25%,rgba(168,85,247,0.16),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-[min(420px,65vh)] max-w-[900px] bg-[radial-gradient(ellipse_at_50%_100%,rgba(139,92,246,0.14),transparent_65%)] blur-[48px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-[28%] mx-auto h-px max-w-md bg-gradient-to-r from-transparent via-purple-400/25 to-transparent"
        aria-hidden
      />

      <div ref={sentinelRef} className="relative z-[1] mx-auto max-w-4xl">
        <RewardCardBack
          instagramQrSrc={data?.instagram}
          tiktokQrSrc={data?.tiktok}
          facebookQrSrc={data?.facebook}
          qrLoading={qrLoading}
          qrError={status === 'error'}
          footerRevealed={footerRevealed}
        />
      </div>
    </footer>
  );
}

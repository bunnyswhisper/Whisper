'use client';

import { useId } from 'react';
import { useDialog } from '@/lib/a11y/useDialog';
import { interactivePressable } from '@/lib/interactivePressable';

type Props = {
  open: boolean;
  customerName: string;
  claimCode: string;
  qrImageDataUrl: string;
  onClose: () => void;
  onPrint: () => void;
};

function displayName(name: string) {
  const clean = String(name || '').trim();
  if (!clean) return 'Bunny Guest';
  return clean;
}

export default function QrRewardPreviewModal({
  open,
  customerName,
  claimCode,
  qrImageDataUrl,
  onClose,
  onPrint,
}: Props) {
  const titleId = useId();
  const { dialogProps } = useDialog({ open, onClose, labelId: titleId });

  if (!open) return null;
  const titleName = displayName(customerName).toUpperCase();
  const shortCode = String(claimCode || '').slice(0, 10);
  const particles = Array.from({ length: 14 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[100000] overflow-y-auto bg-black/85 px-4 py-6 backdrop-blur-sm sm:py-10">
      <button
        type="button"
        aria-label="Close reward preview"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        {...dialogProps}
        className="relative z-10 mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-fuchsia-300/30 bg-[#06030c] shadow-[0_0_120px_rgba(168,85,247,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(236,72,153,0.16),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(168,85,247,0.24),transparent_34%),radial-gradient(circle_at_52%_85%,rgba(139,92,246,0.18),transparent_36%),linear-gradient(140deg,#090510,#130820_45%,#090510)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background:repeating-linear-gradient(to_bottom,transparent_0px,transparent_3px,rgba(255,255,255,0.16)_4px)]" />
          <div className="pointer-events-none absolute inset-0 animate-[borderShift_8s_linear_infinite] bg-[conic-gradient(from_0deg,rgba(216,180,254,0.0),rgba(216,180,254,0.2),rgba(236,72,153,0.12),rgba(216,180,254,0.0))] mix-blend-screen opacity-35" />
          <div className="pointer-events-none absolute inset-0 animate-[shimmer_5.2s_linear_infinite] bg-[linear-gradient(112deg,transparent_35%,rgba(255,255,255,0.14)_50%,transparent_65%)] opacity-25" />
          {particles.map((p) => (
            <span
              key={p}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-fuchsia-200/70 blur-[0.5px] animate-[particleDrift_10s_linear_infinite]"
              style={{
                left: `${8 + ((p * 13) % 86)}%`,
                top: `${10 + ((p * 17) % 75)}%`,
                animationDelay: `${(p % 7) * 0.9}s`,
                opacity: 0.28 + (p % 5) * 0.1,
              }}
            />
          ))}
          <div className="pointer-events-none absolute -left-20 top-8 h-56 w-56 animate-[floatBloom_8s_ease-in-out_infinite] rounded-full bg-purple-500/22 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-60 w-60 animate-[floatBloom_9.5s_ease-in-out_infinite] rounded-full bg-fuchsia-500/18 blur-3xl [animation-delay:1.2s]" />
          <div className="pointer-events-none absolute right-[8%] top-[14%] animate-[bunnyFloat_4.2s_ease-in-out_infinite] text-[26px] text-fuchsia-100/75">
            ૮ ˶ᵔ ᵕ ᵔ˶ ა
          </div>
        </div>

        <div className="relative border-b border-fuchsia-300/20 px-6 py-5 sm:px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.34em] text-purple-300/90">
            Members Gift Reward
          </p>
          <h2
            id={titleId}
            className="mt-3 bg-linear-to-r from-white via-fuchsia-100 to-purple-300 bg-clip-text text-3xl font-black text-transparent sm:text-4xl lg:text-[44px]"
          >
            THANK YOU, {titleName}
          </h2>
          <p className="mt-2 text-sm leading-relaxed font-medium tracking-[0.02em] text-purple-100/80 sm:text-base">
            Thank you for shopping with us.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-pink-200/90">
            here&apos;s a little something from us,
          </p>
          <p className="mt-1 text-[10px] italic tracking-[0.08em] text-fuchsia-100/50 sm:text-[11px]">
            (shhh… don&apos;t tell anyone)
          </p>
        </div>

        <div className="relative px-6 py-6 sm:px-8">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-fuchsia-200/25 bg-white/5 p-5 backdrop-blur-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-fuchsia-100/95">
                Bunny Points are waiting.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
                Hidden inside every order is a small thank-you from our members circle.
                Keep this insert close and unlock it once your order arrives.
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100/90">
                CLAIM YOUR POINTS
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[320px] rounded-2xl border border-fuchsia-200/30 bg-[#130b21]/90 p-4 shadow-[0_0_45px_rgba(216,180,254,0.18),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-fuchsia-300/35 [mask-image:linear-gradient(to_bottom,rgba(255,255,255,0.9),transparent_70%)]" />
              <div className="relative mx-auto w-fit rounded-2xl border border-purple-200/50 bg-white p-3 shadow-[0_0_38px_rgba(216,180,254,0.18)]">
                <img
                  src={qrImageDataUrl}
                  alt="Bunny Points QR code"
                  className="h-52 w-52 rounded-lg object-contain sm:h-56 sm:w-56"
                />
              </div>
              <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                {shortCode}
              </p>
              <p className="mt-2 text-center text-sm text-gray-300">Scan after delivery.</p>
              <p className="mt-1 text-center text-[11px] text-gray-500">Keep this insert safe.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-purple-900/70 bg-[#090511] px-6 py-4 sm:px-8">
          <p className="mb-3 text-center text-[11px] uppercase tracking-[0.18em] text-purple-300/80">
            Bunny&apos;s Whisper
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full border border-purple-900 bg-[#11091d] px-5 py-2.5 text-sm font-bold text-purple-100 ${interactivePressable}`}
            >
              Close
            </button>
            <button
              type="button"
              onClick={onPrint}
              aria-label="Print premium reward insert with QR code"
              className={`rounded-full border border-fuchsia-200/70 bg-fuchsia-300/20 px-5 py-2.5 text-sm font-black text-fuchsia-50 ${interactivePressable}`}
            >
              Print Premium Insert
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0%,
          100% {
            transform: translateX(35%);
          }
        }
        @keyframes particleDrift {
          0% {
            transform: translateY(8px) scale(0.9);
          }
          50% {
            transform: translateY(-6px) scale(1);
          }
          100% {
            transform: translateY(-20px) scale(0.92);
          }
        }
        @keyframes floatBloom {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(8px, -10px, 0);
          }
        }
        @keyframes bunnyFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes borderShift {
          from {
            transform: rotate(0deg) scale(1.2);
          }
          to {
            transform: rotate(360deg) scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}

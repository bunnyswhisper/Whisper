'use client';

import { useId } from 'react';
import { useDialog } from '@/lib/a11y/useDialog';
import { interactivePressable } from '@/lib/interactivePressable';

type Props = {
  open: boolean;
  qrImageDataUrl: string;
  onClose: () => void;
  onPrint: () => void;
};

export default function EventQrBoothSignModal({
  open,
  qrImageDataUrl,
  onClose,
  onPrint,
}: Props) {
  const titleId = useId();
  const { dialogProps } = useDialog({ open, onClose, labelId: titleId });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] overflow-y-auto bg-black/85 px-4 py-6 backdrop-blur-sm sm:py-10">
      <button
        type="button"
        aria-label="Close booth QR preview"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        {...dialogProps}
        className="relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-purple-400/35 bg-[#080312] shadow-[0_0_120px_rgba(168,85,247,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.22),transparent_42%),radial-gradient(circle_at_85%_25%,rgba(236,72,153,0.14),transparent_38%),linear-gradient(165deg,#0c0618,#140a24_48%,#07030d)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(135deg,transparent_0px,transparent_8px,rgba(255,255,255,0.08)_9px)]" />

        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-[10px] font-black uppercase tracking-[0.42em] text-purple-300/95">
            Bunny&apos;s Whisper
          </p>
          <h2
            id={titleId}
            className="mt-4 bg-linear-to-r from-white via-purple-100 to-fuchsia-200 bg-clip-text text-3xl font-black text-transparent sm:text-4xl"
          >
            Booth gift sign
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-purple-100/75">
            Preview matches the printable booth card — dark luxury layout, large QR for scanning at your stand.
          </p>

          <div className="mt-8 flex justify-center">
            <div
              id="bw-event-booth-print-root"
              className="w-full max-w-md rounded-2xl border border-purple-400/40 bg-[#12091f]/95 p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:p-8"
            >
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.38em] text-fuchsia-200/90">
                  Bunny&apos;s Whisper
                </p>
                <p className="mt-3 text-xl font-black uppercase tracking-[0.12em] text-white sm:text-2xl">
                  Booth gift
                </p>
                <p className="mt-4 text-sm font-semibold text-purple-100/85">
                  Scan to unlock your booth discount.
                </p>
                <p className="mt-3 text-xs italic leading-relaxed text-purple-200/65">
                  Thanks for visiting us — here&apos;s a little something from Bunny&apos;s Whisper.
                </p>
              </div>
              <div className="mx-auto mt-6 flex justify-center">
                <div className="rounded-2xl border border-white/25 bg-white p-4 shadow-[0_0_48px_rgba(216,180,254,0.2)]">
                  <img
                    src={qrImageDataUrl}
                    alt="Event booth QR code"
                    className="h-52 w-52 object-contain sm:h-60 sm:w-60"
                  />
                </div>
              </div>
              <p className="mt-6 text-center text-xs font-bold uppercase tracking-[0.22em] text-purple-200/90">
                Use this today at checkout.
              </p>
            </div>
          </div>
        </div>

        <div className="relative border-t border-purple-900/70 bg-[#06030c] px-6 py-4 sm:px-10">
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
              aria-label="Print event booth QR sign"
              className={`rounded-full border border-purple-300/70 bg-purple-400/25 px-5 py-2.5 text-sm font-black text-purple-50 ${interactivePressable}`}
            >
              Print booth sign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

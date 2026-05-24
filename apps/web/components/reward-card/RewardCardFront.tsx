'use client';

export type RewardCardFrontProps = {
  /** Full customer name as on printed insert (e.g. &quot;Ahmed Hesham&quot;). */
  customerDisplayName: string;
  /** Plain claim code for display under QR. */
  claimCode: string;
  rewardQrSrc: string;
  className?: string;
};

/** Lucide-style Gift outline — matches print SVG */
function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="8"
        width="18"
        height="4"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8v13"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CARD_BG = [
  'radial-gradient(ellipse 100% 85% at 14% 10%, rgba(168,85,247,0.3), transparent 56%)',
  'radial-gradient(ellipse 95% 75% at 90% 86%, rgba(124,58,237,0.24), transparent 52%)',
  'radial-gradient(ellipse 70% 55% at 50% 102%, rgba(88,28,135,0.38), transparent 58%)',
  'linear-gradient(168deg, #1c0d2e 0%, #140a22 35%, #0a0514 68%, #030206 100%)',
].join(', ');

/**
 * Admin screen preview — ID-1 proportions + purple neon layout (matches print HTML).
 */
export function RewardCardFront({
  customerDisplayName,
  claimCode,
  rewardQrSrc,
  className = '',
}: RewardCardFrontProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[min(340px,calc(100vw-24px))] rounded-xl shadow-[0_0_0_1px_rgba(168,85,247,0.28),0_0_24px_rgba(168,85,247,0.38),0_22px_60px_-12px_rgba(0,0,0,0.75)] ${className}`}
      style={{ aspectRatio: '85.6 / 53.98' }}
    >
      <section
        className="relative flex h-full min-h-0 overflow-hidden rounded-xl border border-[rgba(192,132,252,0.42)]"
        style={{ backgroundImage: CARD_BG }}
        aria-label="Reward card front"
      >
        <div
          className="pointer-events-none absolute inset-[-45%] z-[1] rotate-[-7deg] opacity-[0.065] mix-blend-overlay"
          style={{
            backgroundImage: `repeating-linear-gradient(92deg, rgba(216,180,254,0.08) 0px, rgba(216,180,254,0.08) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(2deg, rgba(192,132,252,0.06) 0px, rgba(192,132,252,0.06) 1px, transparent 1px, transparent 4px)`,
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(closest-side_at_28%_20%,rgba(233,213,255,0.16),transparent_58%)] opacity-[0.65] mix-blend-screen" />
        <div className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_28mm_rgba(0,0,0,0.45)]" />

        <div className="relative z-[2] grid h-full min-h-0 grid-cols-[minmax(0,1fr)_clamp(5.5rem,30%,6.75rem)] grid-rows-[auto_minmax(0,1fr)] gap-x-[1.5mm] gap-y-[0.55mm] px-[1.85mm] pb-[1.75mm] pt-[1.5mm]">
          <header className="col-span-2 row-start-1 flex flex-col gap-[0.38mm] pb-[0.1mm]">
            <div className="flex items-start justify-between gap-[1.25mm]">
              <p className="m-0 min-w-0 max-w-[52%] text-[clamp(5px,1.35vw,7px)] font-extrabold uppercase leading-[1.15] tracking-[0.14em] text-[rgba(216,180,254,0.88)]">
                MEMBERS GIFT REWARD
              </p>
              <img
                src="/logo.png"
                alt=""
                width={28}
                height={28}
                decoding="async"
                className="size-[5.25mm] shrink-0 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.55)]"
              />
            </div>
            <p className="m-0 px-[max(1rem,4mm)] text-center text-[clamp(5.5px,1.5vw,7.5px)] font-bold uppercase leading-[1.12] tracking-[0.28em] text-[rgba(250,248,255,0.94)] drop-shadow-[0_0_10px_rgba(168,85,247,0.45),0_0_22px_rgba(124,58,237,0.22)]">
              Bunny&apos;s Whisper
            </p>
          </header>

          <div className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col">
            <p className="m-0 font-serif text-[clamp(12px,3.6vw,15px)] font-semibold leading-[1.12] tracking-[0.02em] text-[#faf6ff] drop-shadow-[0_0_12px_rgba(168,85,247,0.22)]">
              {customerDisplayName},
            </p>
            <p className="mt-[0.5mm] text-[clamp(7px,2vw,9px)] font-medium leading-[1.22] text-[rgba(248,245,255,0.9)]">
              Thank you for shopping with us.
            </p>
            <p className="mt-[0.35mm] font-serif text-[clamp(6.5px,1.85vw,8.5px)] font-normal italic leading-[1.22] text-[#f5cce8]">
              here&apos;s a little something from us,
            </p>
            <p className="mt-[0.28mm] text-[clamp(5.5px,1.55vw,7px)] font-normal leading-[1.2] text-[rgba(196,194,214,0.62)]">
              (shhh… don&apos;t tell anyone)
            </p>

            <div className="min-h-0 max-h-[3.25mm] flex-1 shrink" aria-hidden />

            <div className="shrink-0 rounded-[2mm] border border-[rgba(192,132,252,0.45)] bg-[linear-gradient(145deg,rgba(24,12,42,0.82),rgba(10,6,22,0.92))] px-[1.75mm] py-[1.25mm] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_rgba(168,85,247,0.2),0_6px_16px_rgba(0,0,0,0.42)] backdrop-blur-md">
              <div className="flex items-center gap-[1.1mm]">
                <GiftIcon className="size-[clamp(20px,5.2vw,24px)] shrink-0 text-[#e9d5ff] drop-shadow-[0_0_4px_rgba(168,85,247,0.45)]" />
                <p className="m-0 min-w-0 flex-1 text-[clamp(6px,1.75vw,8px)] font-extrabold uppercase leading-[1.18] tracking-[0.1em] text-[#f5d0fe] drop-shadow-[0_0_10px_rgba(168,85,247,0.35)]">
                  YOUR BUNNY POINTS ARE WAITING.
                </p>
              </div>
              <p className="mt-[0.45mm] text-[clamp(5.5px,1.55vw,7px)] font-normal leading-[1.28] text-[rgba(248,245,255,0.92)]">
                Hidden inside every order is a small thank-you from our members circle. Unlock it once
                your order arrives.
              </p>
              <p className="mt-[0.55mm] inline-flex items-center gap-[0.35mm] text-[clamp(5.25px,1.5vw,6.75px)] font-extrabold uppercase tracking-[0.14em] text-[#fde6f6] drop-shadow-[0_0_8px_rgba(168,85,247,0.35)]">
                CLAIM YOUR POINTS <span aria-hidden>→</span>
              </p>
            </div>
          </div>

          <aside className="relative col-start-2 row-start-2 flex items-center justify-center">
            <div
              className="pointer-events-none absolute inset-[-22%] rounded-[4mm] bg-[radial-gradient(circle_at_50%_48%,rgba(168,85,247,0.55),transparent_62%)] opacity-[0.65] blur-[5px]"
              aria-hidden
            />
            <div className="relative flex w-full flex-col items-center gap-[0.42mm] text-center">
              <div className="rounded-[1.6mm] border-[1.5px] border-[rgba(216,180,254,0.75)] bg-gradient-to-b from-white to-[#faf8ff] p-[0.75mm] shadow-[0_0_12px_rgba(168,85,247,0.62),0_0_28px_rgba(124,58,237,0.35),0_0_44px_rgba(88,28,135,0.22),inset_0_0_0_1px_rgba(255,255,255,0.95)]">
                <img
                  src={rewardQrSrc}
                  alt=""
                  width={96}
                  height={96}
                  className="aspect-square w-[clamp(56px,42%,72px)] max-h-[72px] max-w-[72px] object-contain"
                />
              </div>
              <p className="m-0 max-w-full whitespace-nowrap font-mono text-[clamp(4.75px,1.35vw,6.25px)] font-bold uppercase leading-[1.12] tracking-[0.025em] text-[#f5f3ff]">
                {claimCode}
              </p>
              <p className="m-0 text-[clamp(4.75px,1.35vw,6.25px)] leading-[1.2] text-[rgba(210,208,222,0.76)]">
                Scan after delivery. Enter code manually if needed.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

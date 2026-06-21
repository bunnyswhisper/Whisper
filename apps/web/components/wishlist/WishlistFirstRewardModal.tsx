'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { interactivePressable } from '@/lib/interactivePressable';
import { resolveWishlistRewardCustomerName } from '@/lib/customerDisplayName';

type WishlistFirstRewardContextValue = {
  openFirstWishlistReward: () => void;
  closeFirstWishlistReward: () => void;
};

const WishlistFirstRewardContext =
  createContext<WishlistFirstRewardContextValue | null>(null);

function WishlistFirstRewardOverlay({
  open,
  customerName,
  onClose,
}: {
  open: boolean;
  customerName: string;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wishlist-reward-title"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-purple-400/25 bg-[#0a0712]/95 p-6 shadow-[0_0_80px_rgba(168,85,247,0.35)] sm:p-7"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-3xl"
        />

        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-purple-300/70">
            Bunny&apos;s Whisper
          </p>
          <p className="mt-3 inline-flex rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/90">
            First Wish Reward
          </p>

          <div className="mt-5 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2
                id="wishlist-reward-title"
                className="bg-linear-to-r from-white via-purple-100 to-fuchsia-300 bg-clip-text text-xl font-black leading-tight text-transparent sm:text-2xl"
              >
                Congrats, {customerName} ✦
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                You just earned 100 Bunny points for saving your first favorite
                piece.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-purple-200/75">
                Your points have been added to your account and can be used toward
                future rewards.
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-purple-300/40 bg-linear-to-br from-purple-500/25 via-fuchsia-500/20 to-purple-900/40 px-3 py-2.5 text-center shadow-[0_0_24px_rgba(168,85,247,0.45)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-purple-200/80">
                Earned
              </p>
              <p className="mt-0.5 text-lg font-black text-purple-100">+100</p>
              <p className="text-[10px] font-semibold text-fuchsia-200/90">
                Bunny Points
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={`rounded-full border border-purple-800 px-6 py-3 font-bold text-purple-200 hover:bg-purple-950 ${interactivePressable}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }}
            >
              Continue shopping
            </button>
            <button
              type="button"
              className={`rounded-full border border-purple-300 bg-purple-300/20 px-6 py-3 font-bold text-purple-50 shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:bg-purple-300/35 ${interactivePressable}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                router.push('/account/wishlist');
              }}
            >
              View my wishlist
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function WishlistFirstRewardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState('there');
  const openingRef = useRef(false);

  const closeFirstWishlistReward = useCallback(() => {
    setOpen(false);
    openingRef.current = false;
  }, []);

  const openFirstWishlistReward = useCallback(() => {
    if (open || openingRef.current) return;

    openingRef.current = true;

    void resolveWishlistRewardCustomerName()
      .then((name) => {
        setCustomerName(name);
        setOpen(true);
      })
      .catch(() => {
        setCustomerName('there');
        setOpen(true);
      });
  }, [open]);

  const value = useMemo(
    () => ({ openFirstWishlistReward, closeFirstWishlistReward }),
    [openFirstWishlistReward, closeFirstWishlistReward],
  );

  return (
    <WishlistFirstRewardContext.Provider value={value}>
      {children}
      <WishlistFirstRewardOverlay
        open={open}
        customerName={customerName}
        onClose={closeFirstWishlistReward}
      />
    </WishlistFirstRewardContext.Provider>
  );
}

export function useWishlistFirstReward() {
  const ctx = useContext(WishlistFirstRewardContext);
  if (!ctx) {
    return {
      openFirstWishlistReward: () => {},
      closeFirstWishlistReward: () => {},
    };
  }
  return ctx;
}

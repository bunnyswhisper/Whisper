'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { interactivePressable } from '@/lib/interactivePressable';

type WishlistGuestPromptContextValue = {
  openGuestPrompt: (redirectPath: string) => void;
  closeGuestPrompt: () => void;
};

const WishlistGuestPromptContext =
  createContext<WishlistGuestPromptContextValue | null>(null);

function WishlistGuestPromptOverlay({
  open,
  redirectPath,
  onClose,
}: {
  open: boolean;
  redirectPath: string;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!open || typeof document === 'undefined') return null;

  const authHref = `/auth?redirect=${encodeURIComponent(redirectPath)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wishlist-guest-title"
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
        className="w-full max-w-md rounded-3xl border border-purple-400/20 bg-[#0a0712]/95 p-6 shadow-[0_0_80px_rgba(168,85,247,0.25)]"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-purple-300/70">
          Bunny&apos;s Whisper
        </p>
        <h2 id="wishlist-guest-title" className="mt-2 text-xl font-black text-white">
          Save it to your wishlist
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Create an account or log in to keep track of your favorite pieces.
        </p>
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
            Continue browsing
          </button>
          <button
            type="button"
            className={`rounded-full border border-purple-300 bg-purple-300/20 px-6 py-3 font-bold text-purple-50 hover:bg-purple-300/35 ${interactivePressable}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
              router.push(authHref);
            }}
          >
            Login / Sign up
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function WishlistGuestPromptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/');

  const closeGuestPrompt = useCallback(() => {
    setOpen(false);
  }, []);

  const openGuestPrompt = useCallback((path: string) => {
    setRedirectPath(path || '/');
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ openGuestPrompt, closeGuestPrompt }),
    [openGuestPrompt, closeGuestPrompt],
  );

  return (
    <WishlistGuestPromptContext.Provider value={value}>
      {children}
      <WishlistGuestPromptOverlay
        open={open}
        redirectPath={redirectPath}
        onClose={closeGuestPrompt}
      />
    </WishlistGuestPromptContext.Provider>
  );
}

export function useWishlistGuestPrompt() {
  const ctx = useContext(WishlistGuestPromptContext);
  if (!ctx) {
    return {
      openGuestPrompt: () => {},
      closeGuestPrompt: () => {},
    };
  }
  return ctx;
}

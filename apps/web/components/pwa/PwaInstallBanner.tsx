'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearCapturedDeferredPrompt,
  dismissInstallPrompt,
  getCapturedDeferredPrompt,
  initBeforeInstallPromptCapture,
  isStandaloneDisplayMode,
  logPwaDev,
  subscribeDeferredInstallPrompt,
  wasInstallPromptDismissed,
  type BeforeInstallPromptEvent,
} from '@/lib/pwaInstall';
import { useIsAdmin } from '@/lib/useIsAdmin';

initBeforeInstallPromptCapture();

function useAdminInstallState() {
  const { isAdmin, ready } = useIsAdmin();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => getCapturedDeferredPrompt(),
  );
  const loggedRoleRef = useRef<boolean | null>(null);

  const syncPrompt = useCallback(() => {
    setDeferredPrompt(getCapturedDeferredPrompt());
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (isStandaloneDisplayMode()) {
      logPwaDev('standalone mode detected');
      return;
    }

    if (loggedRoleRef.current !== isAdmin) {
      loggedRoleRef.current = isAdmin;
      if (isAdmin) {
        logPwaDev('admin user detected');
      } else {
        logPwaDev('customer/non-admin, install prompt disabled');
      }
    }
  }, [ready, isAdmin]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    if (isStandaloneDisplayMode()) return;

    syncPrompt();

    if (!getCapturedDeferredPrompt()) {
      logPwaDev('install prompt unavailable');
    }

    return subscribeDeferredInstallPrompt(syncPrompt);
  }, [ready, isAdmin, syncPrompt]);

  const eligible =
    ready &&
    isAdmin &&
    !isStandaloneDisplayMode() &&
    Boolean(deferredPrompt);

  return { deferredPrompt, eligible, setDeferredPrompt };
}

/** Admin-only bottom banner when beforeinstallprompt was captured. No navbar button. */
export function PwaInstallBanner() {
  const { deferredPrompt, eligible, setDeferredPrompt } = useAdminInstallState();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!eligible || !deferredPrompt) {
      setVisible(false);
      return;
    }

    if (wasInstallPromptDismissed()) {
      setVisible(false);
      return;
    }

    logPwaDev('install prompt shown');
    setVisible(true);
  }, [eligible, deferredPrompt]);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    clearCapturedDeferredPrompt();
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    dismissInstallPrompt();
    setVisible(false);
  }

  if (!eligible || !visible || !deferredPrompt) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[99990] flex justify-center px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))]"
      role="region"
      aria-label="Install admin app"
    >
      <div className="pointer-events-auto w-full max-w-md">
        <div className="rounded-2xl border border-purple-400/30 bg-[#0b0f1a]/96 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <p className="text-sm font-bold text-white">
            Install Bunny&apos;s Whisper admin app?
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-300 sm:text-sm">
            Get quick access to your dashboard from your device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="min-h-10 flex-1 rounded-full bg-purple-300 px-4 py-2 text-sm font-bold text-black transition hover:bg-white"
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="min-h-10 rounded-full border border-purple-400/45 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:border-purple-300 hover:bg-purple-500/15"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

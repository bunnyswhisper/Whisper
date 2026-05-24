export const PWA_INSTALL_DISMISS_KEY = 'bw-pwa-install-dismissed';

const DISMISS_DAYS = 30;

/** Dev-only PWA diagnostics (never throws). */
export function logPwaDev(
  message: string,
  details?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    // eslint-disable-next-line no-console -- dev PWA diagnostics
    console.debug(`[PWA] ${message}`, details ?? {});
  } catch {
    /* ignore */
  }
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

export function wasInstallPromptDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { until?: number };
    if (typeof parsed.until !== 'number') return true;
    return Date.now() < parsed.until;
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      PWA_INSTALL_DISMISS_KEY,
      JSON.stringify({ until }),
    );
  } catch {
    /* ignore */
  }
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function isBeforeInstallPromptEvent(
  event: Event,
): event is BeforeInstallPromptEvent {
  return (
    'prompt' in event &&
    typeof (event as BeforeInstallPromptEvent).prompt === 'function'
  );
}

const PWA_PROMPT_READY_EVENT = 'bw:pwa-deferred-prompt';

let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let captureListenerAttached = false;
let appInstalledListenerAttached = false;

/** Capture beforeinstallprompt as early as possible (admin UI gates visibility). */
export function initBeforeInstallPromptCapture(): void {
  if (typeof window === 'undefined' || captureListenerAttached) return;
  captureListenerAttached = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    if (isBeforeInstallPromptEvent(event)) {
      capturedDeferredPrompt = event;
      logPwaDev('beforeinstallprompt captured');
      window.dispatchEvent(new CustomEvent(PWA_PROMPT_READY_EVENT));
    }
  });

  if (!appInstalledListenerAttached) {
    appInstalledListenerAttached = true;
    window.addEventListener('appinstalled', () => {
      logPwaDev('appinstalled fired');
      clearCapturedDeferredPrompt();
    });
  }

  if (isStandaloneDisplayMode()) {
    logPwaDev('standalone mode detected');
  }
}

export function getCapturedDeferredPrompt(): BeforeInstallPromptEvent | null {
  return capturedDeferredPrompt;
}

export function clearCapturedDeferredPrompt(): void {
  capturedDeferredPrompt = null;
}

export function subscribeDeferredInstallPrompt(
  listener: () => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => listener();
  window.addEventListener(PWA_PROMPT_READY_EVENT, handler);
  return () => window.removeEventListener(PWA_PROMPT_READY_EVENT, handler);
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { apiUrl } from '@/lib/api';
import {
  getOrCreateDeviceKey,
  saveBoothDiscount,
  type BoothDiscountStored,
} from '@/lib/boothDiscount';
import { supabase } from '@/lib/supabaseClient';
import { interactivePressable } from '@/lib/interactivePressable';

/** Same API origin as preview POST /events/qr/redeem */
const EVENT_QR_REDEEM_PATH = '/events/qr/redeem';

type LandingPhase =
  | 'loading'
  | 'not_started'
  | 'unavailable'
  | 'ready'
  | 'redeeming'
  | 'done'
  | 'already'
  | 'preview_error';

type CampaignPayload = {
  id?: string;
  name: string;
  code: string;
  discountPercent: number;
};

/**
 * Single mapping from preview JSON `status` → UI phase (+ campaign when needed).
 * Trust backend `status`; no client-side date/window overrides.
 */
function mapPreviewStatusToPhase(
  statusRaw: string | undefined,
  campaign: CampaignPayload | undefined,
  routeCode: string,
): { phase: LandingPhase; campaign: CampaignPayload | null } {
  const status = String(statusRaw ?? '').trim().toLowerCase();

  if (status === 'valid') {
    return {
      phase: 'ready',
      campaign:
        campaign ??
        ({
          name: 'Booth reward',
          code: routeCode.trim(),
          discountPercent: 0,
        }),
    };
  }

  if (status === 'already_saved') {
    return campaign
      ? { phase: 'already', campaign }
      : { phase: 'unavailable', campaign: null };
  }

  if (status === 'not_started') {
    return { phase: 'not_started', campaign: null };
  }

  if (
    status === 'not_found' ||
    status === 'inactive' ||
    status === 'expired' ||
    status === 'maxed'
  ) {
    return { phase: 'unavailable', campaign: null };
  }

  return { phase: 'unavailable', campaign: null };
}

function redeemFailureReason(data: Record<string, unknown>): string | undefined {
  const top = data.reason;
  if (typeof top === 'string') return top;
  const msg = data.message;
  if (
    msg &&
    typeof msg === 'object' &&
    'reason' in msg &&
    typeof (msg as { reason?: unknown }).reason === 'string'
  ) {
    return (msg as { reason: string }).reason;
  }
  return undefined;
}

/** NestJS HttpException / ValidationPipe JSON bodies vary; extract human-readable text. */
function extractNestErrorMessage(payload: unknown): string {
  if (payload == null) return 'Something went wrong.';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return String(payload);

  const o = payload as Record<string, unknown>;

  if (typeof o.message === 'string') return o.message;
  if (Array.isArray(o.message)) {
    return o.message.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('. ');
  }
  if (o.message && typeof o.message === 'object') {
    const inner = o.message as Record<string, unknown>;
    if (typeof inner.message === 'string') return inner.message;
  }

  if (typeof o.reason === 'string') return o.reason;
  if (typeof o.error === 'string' && o.error !== 'Bad Request') return o.error;

  const soft = o.error;
  if (typeof soft === 'string') return soft;

  try {
    return JSON.stringify(payload);
  } catch {
    return 'Something went wrong.';
  }
}

function redeemTopLevelReason(data: Record<string, unknown>): string | undefined {
  if (typeof data.reason === 'string') return data.reason;
  return redeemFailureReason(data);
}

function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function safeErrMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || 'Error';
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

/** Static markup only — no spin/random animation classes (avoids hydration noise). */
function LoadingShell({ subtitle }: { subtitle: string }) {
  return (
    <div className="rounded-3xl border border-purple-950 bg-[#0d0716] p-10 text-center shadow-[0_20px_80px_rgba(168,85,247,0.15)]">
      <div
        className="mx-auto h-10 w-10 rounded-full border-2 border-purple-300/30 border-t-purple-300"
        aria-hidden
      />
      <p className="mt-6 text-purple-200">{subtitle}</p>
    </div>
  );
}

export default function EventQrLandingPage() {
  const params = useParams();
  const rawCode = decodeURIComponent(String(params?.code || ''));

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<LandingPhase>('loading');
  const [campaign, setCampaign] = useState<CampaignPayload | null>(null);
  const [deviceKey, setDeviceKey] = useState('');
  const [previewFetchError, setPreviewFetchError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const previewRunIdRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);

  const commitPhase = useCallback((_reason: string, nextPhase: LandingPhase) => {
    setPhase(nextPhase);
  }, []);

  const loadPreview = useCallback(async () => {
    previewAbortRef.current?.abort();
    const runId = ++previewRunIdRef.current;

    if (!rawCode.trim()) {
      setPreviewFetchError(null);
      setCampaign(null);
      commitPhase('empty route code', 'unavailable');
      return;
    }

    const ac = new AbortController();
    previewAbortRef.current = ac;

    commitPhase('loadPreview start', 'loading');
    setCampaign(null);
    setPreviewFetchError(null);
    setRedeemError(null);

    try {
      const dk = getOrCreateDeviceKey();
      setDeviceKey(dk);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const urlToFetch = `${apiUrl(`/events/qr/preview/${encodeURIComponent(rawCode)}`)}?${new URLSearchParams({
        deviceKey: dk,
      }).toString()}`;

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      let res: Response;
      try {
        res = await fetch(urlToFetch, { headers, signal: ac.signal });
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        const msg = safeErrMessage(err);
        setPreviewFetchError(msg);
        if (runId !== previewRunIdRef.current) return;
        commitPhase('loadPreview fetch threw', 'preview_error');
        return;
      }

      const rawText = await res.text();

      let parsed: unknown;
      try {
        parsed = rawText.length ? JSON.parse(rawText) : {};
      } catch {
        setPreviewFetchError('Response body was not valid JSON');
        if (runId !== previewRunIdRef.current) return;
        commitPhase('loadPreview JSON parse failed', 'preview_error');
        return;
      }

      const data = parsed as {
        status?: string;
        campaign?: CampaignPayload;
      };

      const { phase: nextPhase, campaign: nextCampaign } = mapPreviewStatusToPhase(
        data.status,
        data.campaign,
        rawCode,
      );

      if (runId !== previewRunIdRef.current) {
        return;
      }

      setCampaign(nextCampaign);
      commitPhase(`preview status="${String(data.status ?? '')}" → mapPreviewStatusToPhase`, nextPhase);
      return;
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      const msg = safeErrMessage(err);
      setPreviewFetchError(msg);
      if (runId !== previewRunIdRef.current) return;
      commitPhase('loadPreview outer catch', 'preview_error');
    }
  }, [rawCode, commitPhase]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void loadPreview();
    return () => {
      previewAbortRef.current?.abort();
    };
  }, [mounted, loadPreview]);

  async function redeem() {
    if (!campaign) return;
    setRedeemError(null);
    commitPhase('redeem start', 'redeeming');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const dk = getOrCreateDeviceKey().trim();
    if (!dk || dk.length < 8) {
      commitPhase('redeem blocked — empty deviceKey', 'ready');
      setRedeemError(
        'Could not create a device key. Allow storage and try again.',
      );
      return;
    }
    setDeviceKey(dk);

    const redeemBody = {
      code: String(campaign.code ?? rawCode).trim(),
      deviceKey: dk,
    };

    if (!redeemBody.code) {
      commitPhase('redeem blocked — empty code', 'ready');
      setRedeemError('Missing campaign code. Refresh the page and try again.');
      return;
    }
    if (!redeemBody.deviceKey) {
      commitPhase('redeem blocked — empty deviceKey', 'ready');
      setRedeemError('Could not create a device key. Allow storage and try again.');
      return;
    }

    const redeemUrl = apiUrl(EVENT_QR_REDEEM_PATH);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    let res: Response;
    try {
      res = await fetch(redeemUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(redeemBody),
      });
    } catch {
      commitPhase('redeem network error → restore ready', 'ready');
      setRedeemError('Could not reach the server. Tap again to retry.');
      return;
    }

    const responseText = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = responseText.length ? (JSON.parse(responseText) as Record<string, unknown>) : {};
    } catch {
      parsed = { _nonJson: responseText.slice(0, 500) };
    }

    const friendlyHttp = extractNestErrorMessage(parsed);
    const reason = redeemTopLevelReason(parsed);

    if (res.ok && parsed.ok === true) {
      const camp = parsed.campaign as CampaignPayload | undefined;
      if (camp?.id) {
        const stored: BoothDiscountStored = {
          campaignId: camp.id,
          code: camp.code,
          name: camp.name,
          discountPercent: camp.discountPercent,
          deviceKey: dk,
        };
        saveBoothDiscount(stored);

        const st = typeof parsed.status === 'string' ? parsed.status : '';
        const alreadySaved =
          parsed.alreadyRedeemed === true || st === 'already_saved';

        if (alreadySaved) {
          commitPhase('redeem complete (already_saved)', 'already');
        } else {
          commitPhase('redeem complete (saved)', 'done');
        }
        return;
      }

      commitPhase('redeem ok:true but missing campaign.id → restore ready', 'ready');
      setRedeemError('Unexpected server response. Try again.');
      return;
    }

    if (res.ok && parsed.ok === false) {
      const soft =
        typeof parsed.error === 'string'
          ? parsed.error
          : extractNestErrorMessage(parsed);

      if (
        typeof soft === 'string' &&
        soft.toLowerCase().includes('device') &&
        soft.toLowerCase().includes('required')
      ) {
        commitPhase('redeem ok:false deviceKey required → restore ready', 'ready');
        setRedeemError(
          'Sign in or allow local storage so your device can save this booth discount.',
        );
        return;
      }

      commitPhase('redeem ok:false → restore ready', 'ready');
      setRedeemError(soft || 'Could not save your booth discount.');
      return;
    }

    if (!res.ok) {
      if (reason === 'not_started') {
        commitPhase('redeem API not_started', 'not_started');
        return;
      }

      if (
        reason === 'inactive' ||
        reason === 'ended' ||
        reason === 'maxed' ||
        reason === 'not_found'
      ) {
        commitPhase(`redeem HTTP ${res.status} reason=${reason ?? 'n/a'} → unavailable`, 'unavailable');
        setRedeemError(null);
        return;
      }

      commitPhase(`redeem HTTP ${res.status} → restore ready`, 'ready');
      setRedeemError(
        friendlyHttp ||
          `Could not save your booth discount (${res.status}).`,
      );
      return;
    }

    commitPhase('redeem unexpected response → restore ready', 'ready');
    setRedeemError(friendlyHttp);
  }

  const pct = campaign?.discountPercent ?? 0;

  function eventQrMainCard() {
    if (phase === 'loading' || phase === 'redeeming') {
      return (
        <LoadingShell
          subtitle={phase === 'redeeming' ? 'Saving your booth gift…' : 'Loading…'}
        />
      );
    }
    if (phase === 'preview_error') {
      return (
        <div className="rounded-3xl border border-orange-400/40 bg-[#1a0f08]/95 p-8 text-center shadow-[0_20px_80px_rgba(251,146,60,0.15)]">
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300">Booth reward</p>
          <h1 className="mt-4 text-2xl font-black text-white">Preview fetch failed</h1>
          <p className="mt-3 text-sm text-gray-300">
            {previewFetchError ?? 'Could not load the booth preview.'}
          </p>
          <Link
            href="/"
            className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-purple-300 px-6 py-3 font-bold text-black hover:bg-white ${interactivePressable}`}
          >
            Visit the shop
          </Link>
        </div>
      );
    }
    if (phase === 'not_started') {
      return (
        <div className="rounded-3xl border border-amber-400/35 bg-[#1a1208]/95 p-8 text-center shadow-[0_20px_80px_rgba(251,191,36,0.15)]">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Booth reward</p>
          <h1 className="mt-4 text-2xl font-black text-white">This booth reward starts soon.</h1>
          <p className="mt-3 text-sm text-gray-400">
            Come back when the event window opens — thanks for visiting Bunny&apos;s Whisper.
          </p>
          <Link
            href="/"
            className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-purple-300 px-6 py-3 font-bold text-black hover:bg-white ${interactivePressable}`}
          >
            Visit the shop
          </Link>
        </div>
      );
    }
    if (phase === 'done') {
      return (
        <div className="relative overflow-hidden rounded-3xl border border-purple-400/40 bg-linear-to-b from-[#1a0f2e] via-[#0d0716] to-[#07030d] p-8 text-center shadow-[0_24px_90px_rgba(168,85,247,0.35)]">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-purple-500/25 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/20 text-3xl shadow-[0_0_40px_rgba(168,85,247,0.45)]">
            ✓
          </div>
          <p className="relative mt-6 text-xs font-black uppercase tracking-[0.35em] text-purple-300">
            Booth gift saved
          </p>
          <h1 className="relative mt-3 text-2xl font-black text-white sm:text-3xl">
            {pct}% off is ready
          </h1>
          <p className="relative mx-auto mt-4 max-w-sm text-sm leading-relaxed text-purple-100/90">
            Open checkout on this device — your booth discount applies automatically.
          </p>
          <div className="relative mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/checkout"
              className={`inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full bg-purple-300 px-6 text-base font-black text-black shadow-[0_12px_40px_rgba(216,180,254,0.35)] hover:bg-white sm:max-w-xs ${interactivePressable}`}
            >
              Go to checkout
            </Link>
            <Link
              href="/"
              className={`inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full border border-purple-400/50 bg-purple-500/10 px-6 text-base font-bold text-purple-100 hover:bg-purple-500/20 sm:max-w-xs ${interactivePressable}`}
            >
              Continue shopping
            </Link>
          </div>
        </div>
      );
    }
    if (phase === 'already') {
      return (
        <div className="rounded-3xl border border-purple-300/35 bg-linear-to-b from-[#120a1c] to-[#0a0612] p-8 text-center shadow-[0_20px_80px_rgba(168,85,247,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-purple-300/90">
            You&apos;re all set
          </p>
          <p className="mx-auto mt-5 max-w-sm text-lg font-semibold leading-snug text-purple-50">
            Your discount is waiting for you in checkout.
          </p>
          <p className="mt-4 text-3xl font-black text-white sm:text-4xl">{pct}% off</p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-400">
            Same device — your booth reward stays linked until you complete a purchase or it expires.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/checkout"
              className={`inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full bg-purple-300 px-6 text-base font-black text-black hover:bg-white sm:max-w-xs ${interactivePressable}`}
            >
              Open checkout
            </Link>
            <Link
              href="/"
              className={`inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full border border-purple-300/55 bg-transparent px-6 text-base font-bold text-purple-100 hover:bg-purple-500/15 sm:max-w-xs ${interactivePressable}`}
            >
              Browse collection
            </Link>
          </div>
        </div>
      );
    }
    if (phase === 'ready') {
      return (
        <div className="rounded-3xl border border-purple-400/35 bg-linear-to-b from-[#120a1f] via-[#0d0716] to-[#07030d] p-8 shadow-[0_24px_90px_rgba(168,85,247,0.25)]">
          <p className="text-center text-xs uppercase tracking-[0.4em] text-purple-300">
            Bunny&apos;s Whisper
          </p>
          <h1 className="mt-4 text-center text-3xl font-black text-white sm:text-4xl">Booth gift unlocked</h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-gray-300">
            Thanks for visiting us — here&apos;s a little something from Bunny&apos;s Whisper.
          </p>

          <button
            type="button"
            onClick={() => void redeem()}
            className={`mt-10 flex w-full min-h-[3.25rem] items-center justify-center rounded-full bg-purple-300 px-6 text-lg font-black text-black shadow-[0_12px_40px_rgba(216,180,254,0.35)] hover:bg-white ${interactivePressable}`}
          >
            Save {pct}% off for checkout
          </button>

          {redeemError ? (
            <p className="mt-4 text-center text-sm text-red-300">{redeemError}</p>
          ) : null}

          <p className="mt-6 text-center text-xs text-gray-500">
            One redemption per visitor account or device.
          </p>
        </div>
      );
    }
    if (phase === 'unavailable') {
      return (
        <div className="rounded-3xl border border-red-400/30 bg-[#160711]/95 p-8 text-center shadow-[0_20px_80px_rgba(248,113,113,0.12)]">
          <p className="text-xs uppercase tracking-[0.35em] text-red-300">Booth reward</p>
          <h1 className="mt-4 text-2xl font-black text-white">
            This booth reward is no longer available.
          </h1>
          <p className="mt-3 text-sm text-gray-400">Thanks for stopping by Bunny&apos;s Whisper.</p>
          <Link
            href="/"
            className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-purple-300 px-6 py-3 font-bold text-black hover:bg-white ${interactivePressable}`}
          >
            Visit the shop
          </Link>
        </div>
      );
    }
    return null;
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-8 text-white sm:py-12">
        <Navbar />
        <section className="mx-auto max-w-lg pt-6">
          <LoadingShell subtitle="Loading…" />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-8 text-white sm:py-12">
      <Navbar />

      <section key={rawCode} className="mx-auto max-w-lg pt-6">
        {eventQrMainCard()}
      </section>
    </main>
  );
}

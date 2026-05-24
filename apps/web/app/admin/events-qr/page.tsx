'use client';

import QRCode from 'qrcode';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import AdminOnly from '@/components/AdminOnly';
import { apiUrl, siteUrl } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { interactivePressable } from '@/lib/interactivePressable';
import EventQrBoothSignModal from '@/components/admin/EventQrBoothSignModal';

type CampaignRow = {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  active: boolean;
  created_at?: string;
  redemption_count: number;
  used_count: number;
  revenue_egp: number;
  discount_given_egp?: number;
};

type AvailabilityMode = 'manual' | 'now_duration' | 'event_duration';

type DurationPresetId = '1h' | '6h' | '12h' | '24h' | '48h' | '7d' | 'custom';

const DURATION_PRESETS: {
  id: Exclude<DurationPresetId, 'custom'>;
  label: string;
  ms: number;
}[] = [
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { id: '12h', label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '48h', label: '48 hours', ms: 48 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

/** Local calendar date + clock time → UTC ISO for API. */
function localDateTimeToUtcIso(dateStr: string, timeStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('-').map((x) => parseInt(x, 10));
  const [y, mo, da] = parts;
  if (!y || !mo || !da) return null;
  const t = timeStr.trim() || '09:00';
  const [hhRaw, mmRaw = '0'] = t.split(':');
  const h = parseInt(hhRaw, 10);
  const min = parseInt(mmRaw, 10);
  const dt = new Date(y, mo - 1, da, Number.isFinite(h) ? h : 9, Number.isFinite(min) ? min : 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function formatPrettyWithTz(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function windowDurationMs(startsAt: string | null, endsAt: string | null): number | null {
  if (!startsAt || !endsAt) return null;
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return b - a;
}

function formatDurationHuman(ms: number): string {
  const h = ms / (60 * 60 * 1000);
  if (h < 48 && h % 24 !== 0) {
    const rounded = Math.round(h * 10) / 10;
    return `${rounded} hour${rounded === 1 ? '' : 's'}`;
  }
  const d = ms / (24 * 60 * 60 * 1000);
  const rd = Math.round(d * 10) / 10;
  return `${rd} day${rd === 1 ? '' : 's'}`;
}

/** Mirrors API timing + cap checks — explains “Active” vs scan failures. */
function adminScanAvailabilityHint(c: CampaignRow): string | null {
  if (!c.active) return null;

  const now = Date.now();
  const parseMs = (iso: string | null): number | null => {
    if (iso == null || !String(iso).trim()) return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  };

  const startMs = parseMs(c.starts_at);
  const endMs = parseMs(c.ends_at);

  if (startMs !== null && now < startMs) {
    return 'Scans will show “starts soon” until this window opens.';
  }
  if (endMs !== null && now > endMs) {
    return 'Window has ended — scans show unavailable. Use mode “Active until manually off” for no auto end, or create a new campaign.';
  }

  const max = c.max_redemptions;
  if (max != null && max > 0 && c.redemption_count >= max) {
    return 'Redemption cap reached — scans show unavailable.';
  }

  return null;
}

function moneyEgyp(n: number) {
  return `EGP ${Number(n || 0).toFixed(2)}`;
}

function formatCreateError(data: unknown): string {
  const rec = data as { message?: unknown; error?: string };
  const m = rec?.message;
  if (typeof m === 'string' && m.trim()) return m;
  if (Array.isArray(m) && m.length > 0) {
    const first = m[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'constraints' in first) {
      const c = (first as { constraints?: Record<string, string> }).constraints;
      const msg = c ? Object.values(c)[0] : undefined;
      if (typeof msg === 'string') return msg;
    }
  }
  return 'Could not create campaign. Check your details and try again.';
}

/** Fallback when `navigator.clipboard` is missing or blocked. */
function copyTextViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function printBoothSignHtml(qrImageDataUrl: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Bunny&apos;s Whisper — Booth gift</title>
  <style>
    @page { margin: 14mm; size: A4 portrait; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, Segoe UI, sans-serif;
      background: #0c0618;
      color: #f5f3ff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at 20% 15%, rgba(168,85,247,0.22), transparent 42%),
        radial-gradient(circle at 85% 25%, rgba(236,72,153,0.14), transparent 38%),
        linear-gradient(165deg, #0c0618, #140a24 48%, #07030d);
    }
    .card {
      width: 100%;
      max-width: 420px;
      border-radius: 20px;
      border: 1px solid rgba(192, 132, 252, 0.45);
      background: rgba(18, 9, 31, 0.96);
      padding: 28px 24px 32px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
      text-align: center;
    }
    .brand {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: rgba(251, 207, 232, 0.92);
    }
    .title {
      margin-top: 14px;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #fff;
    }
    .lead {
      margin-top: 18px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(237, 233, 254, 0.88);
    }
    .thanks {
      margin-top: 14px;
      font-size: 12px;
      font-style: italic;
      line-height: 1.55;
      color: rgba(216, 180, 254, 0.72);
    }
    .qrbox {
      margin: 22px auto 0;
      display: inline-block;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.28);
      background: #fff;
      padding: 14px;
    }
    .qrbox img { display: block; width: 260px; height: 260px; object-fit: contain; }
    .foot {
      margin-top: 22px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(216, 180, 254, 0.92);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="brand">Bunny&apos;s Whisper</div>
      <div class="title">Booth gift</div>
      <p class="lead">Scan to unlock your booth discount.</p>
      <p class="thanks">Thanks for visiting us — here&apos;s a little something from Bunny&apos;s Whisper.</p>
      <div class="qrbox"><img src="${qrImageDataUrl}" alt="QR" /></div>
      <p class="foot">Use this today at checkout.</p>
    </div>
  </div>
  <script>window.onload = function() { window.print(); window.close(); };</script>
</body>
</html>`);
  w.document.close();
}

export default function AdminEventsQrPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [discountPercent, setDiscountPercent] = useState('15');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [durationPreset, setDurationPreset] = useState<DurationPresetId>('24h');
  const [customHours, setCustomHours] = useState('8');
  const [customEndLocal, setCustomEndLocal] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [active, setActive] = useState(true);
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('manual');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQr, setPreviewQr] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);

  const durationMs = useMemo(() => {
    if (durationPreset === 'custom') {
      const h = parseFloat(customHours);
      if (!Number.isFinite(h) || h <= 0) return null;
      return Math.round(h * 60 * 60 * 1000);
    }
    const row = DURATION_PRESETS.find((p) => p.id === durationPreset);
    return row ? row.ms : null;
  }, [durationPreset, customHours]);

  const browserTz = useMemo(
    () =>
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : '',
    [],
  );

  const schedulePreview = useMemo(() => {
    if (availabilityMode === 'manual') {
      return {
        line:
          'While Active, this QR works until you deactivate it — no automatic start/end (stored as null in UTC).',
      };
    }

    if (availabilityMode === 'now_duration') {
      if (durationMs == null) {
        return {
          line: 'Pick how long the booth stays live starting now.',
        };
      }
      const startMs = Date.now();
      const endMs = startMs + durationMs;
      const startsIso = new Date(startMs).toISOString();
      const endsIso = new Date(endMs).toISOString();
      return {
        line: `Starts now (${formatPrettyWithTz(startsIso)}) and ends ${formatPrettyWithTz(endsIso)}.`,
      };
    }

    if (!eventDate.trim()) {
      return {
        line: 'Pick the event date, wall-clock start time, and duration.',
      };
    }

    const startsIso = localDateTimeToUtcIso(eventDate, startTime);
    if (!startsIso) {
      return { line: 'Could not read the event date or start time.' };
    }

    if (durationPreset === 'custom' && customEndLocal.trim()) {
      const end = new Date(customEndLocal);
      if (!Number.isNaN(end.getTime())) {
        return {
          line: `From ${formatPrettyWithTz(startsIso)} until ${formatPrettyWithTz(end.toISOString())}.`,
        };
      }
    }

    if (durationMs == null) {
      return {
        line: 'Choose a duration or set a custom end time.',
      };
    }

    const endsIso = new Date(new Date(startsIso).getTime() + durationMs).toISOString();
    return {
      line: `From ${formatPrettyWithTz(startsIso)} until ${formatPrettyWithTz(endsIso)}.`,
    };
  }, [
    availabilityMode,
    eventDate,
    startTime,
    durationPreset,
    customHours,
    customEndLocal,
    durationMs,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setCampaigns([]);
        return;
      }
      const res = await fetch(apiUrl('/admin/event-qr/campaigns'), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load campaigns.');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Login required.');

      const pct = Number(discountPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        throw new Error('Discount must be between 1 and 100.');
      }

      let startsAt: string | null = null;
      let endsAt: string | null = null;

      if (availabilityMode === 'manual') {
        startsAt = null;
        endsAt = null;
      } else if (availabilityMode === 'now_duration') {
        if (durationMs == null) throw new Error('Choose a duration.');
        const now = Date.now();
        startsAt = new Date(now).toISOString();
        endsAt = new Date(now + durationMs).toISOString();
      } else {
        if (!eventDate.trim()) throw new Error('Event date required.');
        const startsIso = localDateTimeToUtcIso(eventDate, startTime);
        if (!startsIso) throw new Error('Could not read the event date or start time.');
        startsAt = startsIso;

        if (durationPreset === 'custom' && customEndLocal.trim()) {
          const end = new Date(customEndLocal);
          if (Number.isNaN(end.getTime())) throw new Error('Invalid custom end date/time.');
          endsAt = end.toISOString();
          if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
            throw new Error('End must be after the event start.');
          }
        } else {
          if (durationMs == null) throw new Error('Choose a duration or set a custom end time.');
          endsAt = new Date(new Date(startsAt).getTime() + durationMs).toISOString();
        }
      }

      const maxRaw = maxRedemptions.trim();
      const maxParsed = maxRaw ? parseInt(maxRaw, 10) : null;

      const res = await fetch(apiUrl('/admin/event-qr/campaigns'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          discount_percent: pct,
          starts_at: startsAt,
          ends_at: endsAt,
          max_redemptions:
            maxParsed != null && Number.isFinite(maxParsed) && maxParsed > 0
              ? maxParsed
              : null,
          active,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatCreateError(data));
      }

      setName('');
      setDiscountPercent('15');
      setAvailabilityMode('manual');
      setEventDate('');
      setStartTime('10:00');
      setDurationPreset('24h');
      setCustomHours('8');
      setCustomEndLocal('');
      setMaxRedemptions('');
      setActive(true);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(c: CampaignRow, next: boolean) {
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Login required.');
      const res = await fetch(
        apiUrl(`/admin/event-qr/campaigns/${encodeURIComponent(c.id)}/active`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ active: next }),
        },
      );
      const text = await res.text();
      if (!res.ok) {
        let msg = 'Update failed.';
        try {
          const j = text ? JSON.parse(text) : null;
          if (j?.message) msg = typeof j.message === 'string' ? j.message : formatCreateError(j);
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  }

  async function openPreview(code: string) {
    const url = siteUrl(`/event/${encodeURIComponent(code)}`);
    const qr = await QRCode.toDataURL(url, {
      width: 640,
      margin: 2,
      color: { dark: '#1e0638ff', light: '#ffffffff' },
    });
    setPreviewQr(qr);
    setPreviewOpen(true);
  }

  async function copyLink(code: string) {
    const url = siteUrl(`/event/${encodeURIComponent(code)}`);

    const writeText = navigator?.clipboard?.writeText;
    if (typeof writeText === 'function') {
      try {
        await writeText.call(navigator.clipboard, url);
        setManualCopyUrl(null);
        setCopiedCode(code);
        window.setTimeout(() => setCopiedCode(null), 2000);
        return;
      } catch {
        /* try fallback */
      }
    }

    if (copyTextViaExecCommand(url)) {
      setManualCopyUrl(null);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
      return;
    }

    setManualCopyUrl(url);
  }

  return (
    <AdminOnly>
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 text-white sm:px-6 lg:px-10">
        <Navbar />

        <div className="mx-auto mt-8 max-w-6xl">
          <div className="flex flex-col gap-4 border-b border-purple-950/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-purple-400">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Events QR</h1>
              <p className="mt-3 max-w-xl text-sm text-purple-200/80">
                Booth discount QR codes for pop-ups and in-person campaigns — timed windows without awkward
                “from / to” datetime chaos.
              </p>
            </div>
            <Link
              href="/admin/orders"
              className={`inline-flex min-h-11 items-center justify-center rounded-full border border-purple-400/40 px-5 text-sm font-bold text-purple-100 hover:border-purple-300 ${interactivePressable}`}
            >
              Admin orders
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr]">
            <form
              onSubmit={createCampaign}
              className="h-fit rounded-3xl border border-purple-900/70 bg-linear-to-b from-[#12081f]/98 to-[#07030d] p-6 shadow-[0_24px_80px_rgba(168,85,247,0.18)] sm:p-8"
            >
              <div className="flex items-start justify-between gap-3 border-b border-purple-950/80 pb-5">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">New campaign</h2>
                  <p className="mt-1 text-xs text-purple-300/75">
                    Secure code format <span className="font-mono text-purple-200">BW-EVENT-XXXX-XXXX</span>
                  </p>
                </div>
              </div>

              <label className="mt-7 block text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">
                Campaign name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-purple-950/90 bg-[#05070d]/90 px-4 py-3.5 text-white shadow-inner outline-none ring-0 transition focus:border-purple-400/70 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
                placeholder="e.g. Cairo Design Week"
              />

              <label className="mt-6 block text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">
                Discount %
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-purple-950/90 bg-[#05070d]/90 px-4 py-3.5 text-white outline-none transition focus:border-purple-400/70 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
              />

              <div className="mt-8 rounded-2xl border border-purple-950/80 bg-[#080510]/90 p-4 sm:p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-fuchsia-300/90">
                  Availability
                </p>
                <p className="mt-2 text-xs leading-relaxed text-purple-200/65">
                  All times use your current browser timezone and are stored on the server as UTC ISO instants.
                </p>

                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">Mode</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAvailabilityMode('manual');
                      setEventDate('');
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left text-xs font-bold leading-snug transition ${interactivePressable} ${
                      availabilityMode === 'manual'
                        ? 'border-purple-300/60 bg-purple-500/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                        : 'border-purple-950 bg-[#05070d] text-purple-200/90 hover:border-purple-800'
                    }`}
                  >
                    A) Active until manually off
                    <span className="mt-1 block text-[10px] font-normal text-purple-400/80">No auto schedule</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvailabilityMode('now_duration');
                      setEventDate('');
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left text-xs font-bold leading-snug transition ${interactivePressable} ${
                      availabilityMode === 'now_duration'
                        ? 'border-purple-300/60 bg-purple-500/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                        : 'border-purple-950 bg-[#05070d] text-purple-200/90 hover:border-purple-800'
                    }`}
                  >
                    B) Starts now for duration
                    <span className="mt-1 block text-[10px] font-normal text-purple-400/80">From this moment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityMode('event_duration')}
                    className={`rounded-2xl border px-3 py-3 text-left text-xs font-bold leading-snug transition ${interactivePressable} ${
                      availabilityMode === 'event_duration'
                        ? 'border-fuchsia-300/55 bg-fuchsia-500/15 text-fuchsia-50 shadow-[0_0_20px_rgba(217,70,239,0.18)]'
                        : 'border-purple-950 bg-[#05070d] text-purple-200/90 hover:border-purple-800'
                    }`}
                  >
                    C) Event date + duration
                    <span className="mt-1 block text-[10px] font-normal text-purple-400/80">Planned slot</span>
                  </button>
                </div>

                {availabilityMode === 'manual' ? (
                  <p className="mt-5 rounded-xl border border-purple-950/70 bg-[#06040d]/80 px-4 py-3 text-xs leading-relaxed text-purple-200/85">
                    No <span className="font-mono text-purple-300">starts_at</span> /{' '}
                    <span className="font-mono text-purple-300">ends_at</span> — while this campaign is Active,
                    the QR works until you deactivate it.
                  </p>
                ) : null}

                {availabilityMode === 'event_duration' ? (
                  <>
                    <label className="mt-6 block text-sm font-bold text-purple-100">Event date</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-purple-950/90 bg-[#05070d]/95 px-4 py-3 text-white scheme-dark outline-none transition focus:border-purple-400/70"
                    />

                    <label className="mt-5 block text-sm font-bold text-purple-100">
                      Event starts at{' '}
                      <span className="font-normal text-purple-400/80">(your local time)</span>
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-2 w-full max-w-[220px] rounded-xl border border-purple-950/90 bg-[#05070d]/95 px-4 py-3 text-white scheme-dark outline-none transition focus:border-purple-400/70"
                    />
                  </>
                ) : null}

                {availabilityMode === 'now_duration' || availabilityMode === 'event_duration' ? (
                  <>
                    <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">
                      Duration
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DURATION_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDurationPreset(p.id)}
                          className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${interactivePressable} ${
                            durationPreset === p.id
                              ? 'border border-purple-300/70 bg-purple-500/25 text-white shadow-[0_0_24px_rgba(168,85,247,0.25)]'
                              : 'border border-purple-950 bg-[#05070d] text-purple-200/90 hover:border-purple-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDurationPreset('custom')}
                        className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${interactivePressable} ${
                          durationPreset === 'custom'
                            ? 'border border-fuchsia-300/60 bg-fuchsia-500/20 text-fuchsia-50'
                            : 'border border-purple-950 bg-[#05070d] text-purple-200/90 hover:border-purple-800'
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    {durationPreset === 'custom' ? (
                      <div className="mt-5 space-y-4 rounded-xl border border-purple-950/70 bg-[#06040d]/90 p-4">
                        <div>
                          <label className="text-xs font-semibold text-purple-200">Custom length (hours)</label>
                          <input
                            type="number"
                            min={0.25}
                            step={0.25}
                            value={customHours}
                            onChange={(e) => setCustomHours(e.target.value)}
                            className="mt-2 w-full max-w-[200px] rounded-lg border border-purple-950 bg-[#05070d] px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400/70"
                          />
                        </div>
                        {availabilityMode === 'event_duration' ? (
                          <>
                            <div className="relative text-center text-[10px] font-black uppercase tracking-[0.35em] text-purple-500">
                              <span className="relative z-10 bg-[#06040d] px-2">or set end</span>
                              <span className="absolute left-0 right-0 top-1/2 z-0 h-px bg-purple-950/90" />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-purple-200">
                                Custom end <span className="font-normal text-purple-500">(optional)</span>
                              </label>
                              <input
                                type="datetime-local"
                                value={customEndLocal}
                                onChange={(e) => setCustomEndLocal(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-purple-950 bg-[#05070d] px-3 py-2.5 text-sm text-white scheme-dark outline-none focus:border-purple-400/70"
                              />
                              <p className="mt-2 text-[11px] text-purple-400/80">
                                If set, overrides the hour length for the end time.
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              <p className="mt-3 text-[11px] text-purple-400/75">
                {browserTz
                  ? `Your timezone: ${browserTz} — preview times follow this clock; API stores matching UTC.`
                  : 'Preview times use your device clock; the API stores ISO UTC.'}
              </p>

              <div className="mt-4 rounded-2xl border border-purple-950/60 bg-purple-500/6 px-4 py-3 text-sm leading-snug text-purple-100/95">
                <span className="font-semibold text-purple-200">Preview · </span>
                {schedulePreview.line}
              </div>

              <label className="mt-6 block text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">
                Max redemptions <span className="font-normal text-purple-500">(optional)</span>
              </label>
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
                className="mt-2 w-full rounded-xl border border-purple-950/90 bg-[#05070d]/90 px-4 py-3.5 text-white outline-none transition focus:border-purple-400/70"
              />

              <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-purple-950/70 bg-[#05070d]/50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-purple-400"
                />
                <span className="text-sm font-semibold text-purple-100">Active</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className={`mt-8 w-full min-h-12 rounded-full bg-linear-to-r from-purple-300 via-fuchsia-300 to-purple-300 py-3.5 font-black text-black shadow-[0_12px_40px_rgba(168,85,247,0.35)] hover:brightness-110 disabled:opacity-60 ${interactivePressable}`}
              >
                {submitting ? 'Creating…' : 'Create campaign'}
              </button>
            </form>

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-xl font-black text-white">Campaigns</h2>
                <button
                  type="button"
                  onClick={() => load()}
                  className={`self-start text-xs font-bold uppercase tracking-wider text-purple-400 hover:text-purple-200 ${interactivePressable}`}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="mt-8 text-sm text-purple-300/80">Loading…</p>
              ) : campaigns.length === 0 ? (
                <div className="mt-10 rounded-3xl border border-dashed border-purple-700/50 bg-linear-to-b from-[#140a22]/90 to-[#07030d] px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-purple-400">
                    Events QR
                  </p>
                  <p className="mt-4 text-xl font-black text-white">No campaigns yet</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-purple-200/70">
                    Create your first booth campaign — your QR link and printable sign will appear here with live
                    redemption stats.
                  </p>
                </div>
              ) : (
                <ul className="mt-8 grid gap-6 sm:grid-cols-2">
                  {campaigns.map((c) => {
                    const dur = windowDurationMs(c.starts_at, c.ends_at);
                    const maxLabel =
                      c.max_redemptions != null ? String(c.max_redemptions) : '∞';
                    const usedLabel = `${c.redemption_count} / ${maxLabel}`;
                    const scanHint = adminScanAvailabilityHint(c);

                    return (
                      <li
                        key={c.id}
                        className="flex flex-col rounded-3xl border border-purple-900/75 bg-linear-to-b from-[#120b1c]/98 to-[#07030d] p-5 shadow-[0_20px_60px_rgba(168,85,247,0.16)] sm:p-6"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black text-white">{c.name}</p>
                            <p className="mt-1 font-mono text-[11px] text-purple-300/90">{c.code}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              c.active
                                ? 'border border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                                : 'border border-gray-600 bg-gray-900/80 text-gray-400'
                            }`}
                          >
                            {c.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Discount</p>
                            <p className="font-bold text-purple-200">{c.discount_percent}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Redemptions</p>
                            <p className="font-bold text-purple-200">{usedLabel}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Window</p>
                            <p className="text-sm font-semibold leading-snug text-purple-100/95">
                              {c.starts_at && c.ends_at ? (
                                <>
                                  {formatPrettyWithTz(c.starts_at)} → {formatPrettyWithTz(c.ends_at)}
                                  {dur != null ? (
                                    <span className="mt-1 block text-xs font-normal text-purple-400">
                                      Duration · {formatDurationHuman(dur)}
                                    </span>
                                  ) : null}
                                </>
                              ) : c.starts_at || c.ends_at ? (
                                <>
                                  {c.starts_at ? <>Starts {formatPrettyWithTz(c.starts_at)}</> : null}
                                  {c.starts_at && c.ends_at ? <br /> : null}
                                  {c.ends_at ? <>Ends {formatPrettyWithTz(c.ends_at)}</> : null}
                                </>
                              ) : (
                                <span className="text-purple-400">No fixed schedule (Active only)</span>
                              )}
                            </p>
                          </div>
                          {scanHint ? (
                            <div className="col-span-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-100">
                              {scanHint}
                            </div>
                          ) : null}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Used on orders</p>
                            <p className="font-bold text-purple-200">{c.used_count}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Revenue</p>
                            <p className="font-bold text-purple-200">{moneyEgyp(c.revenue_egp)}</p>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2 border-t border-purple-950/70 pt-5">
                          <button
                            type="button"
                            onClick={() => openPreview(c.code)}
                            className={`rounded-full border border-purple-400/50 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-100 ${interactivePressable}`}
                          >
                            Preview QR
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const url = siteUrl(`/event/${encodeURIComponent(c.code)}`);
                              const qr = await QRCode.toDataURL(url, {
                                width: 640,
                                margin: 2,
                                color: { dark: '#1e0638ff', light: '#ffffffff' },
                              });
                              printBoothSignHtml(qr);
                            }}
                            className={`rounded-full border border-fuchsia-400/45 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-100 ${interactivePressable}`}
                          >
                            Print QR
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void copyLink(c.code);
                            }}
                            className={`rounded-full border border-purple-950 bg-[#05070d] px-4 py-2 text-xs font-bold text-gray-200 ${interactivePressable}`}
                          >
                            {copiedCode === c.code ? 'Copied!' : 'Copy link'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(c, !c.active)}
                            className={`rounded-full border px-4 py-2 text-xs font-bold ${
                              c.active
                                ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                                : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                            } ${interactivePressable}`}
                          >
                            {c.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <EventQrBoothSignModal
          open={previewOpen}
          qrImageDataUrl={previewQr}
          onClose={() => setPreviewOpen(false)}
          onPrint={() => previewQr && printBoothSignHtml(previewQr)}
        />

        {manualCopyUrl ? (
          <div
            className="fixed inset-0 z-80 flex items-end justify-center bg-black/70 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-copy-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-purple-900/80 bg-[#0d0716] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <h2 id="manual-copy-title" className="text-lg font-black text-white">
                Copy this link manually
              </h2>
              <p className="mt-2 text-sm text-purple-200/75">
                Clipboard access isn&apos;t available in this browser or context. Select the link below and copy
                it.
              </p>
              <input
                type="text"
                readOnly
                value={manualCopyUrl}
                onFocus={(e) => e.target.select()}
                className="mt-4 w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-3 font-mono text-xs text-purple-100 outline-none focus:border-purple-400/70"
              />
              <button
                type="button"
                onClick={() => setManualCopyUrl(null)}
                className={`mt-5 w-full min-h-11 rounded-full border border-purple-400/50 bg-purple-500/15 py-2.5 text-sm font-bold text-purple-100 ${interactivePressable}`}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </AdminOnly>
  );
}

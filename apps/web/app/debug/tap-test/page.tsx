'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import TapTestClient from '@/components/dev/TapTestClient';

/**
 * Dev-only isolation page (404 in production via layout): no Navbar.
 * Used to tell apart global CSS/layout vs app-component tap issues on real devices.
 */
export default function TapTestPage() {
  const [count, setCount] = useState(0);
  const [toggleOn, setToggleOn] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [selectVal, setSelectVal] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const pushLog = useCallback((line: string) => {
    setLog((prev) =>
      [`${new Date().toISOString().slice(11, 23)} — ${line}`, ...prev].slice(
        0,
        24,
      ),
    );
  }, []);

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-6 pb-40 text-white">
      <h1 className="text-xl font-bold text-purple-200">Tap test (isolated)</h1>
      <p className="mt-2 max-w-lg text-sm text-gray-400">
        No Navbar. Global dev tap panel is disabled on this route. If these
        controls work here but fail elsewhere, the blocker lives in shared layout
        / page chrome / overlays.
      </p>

      <div className="mx-auto mt-8 max-w-lg space-y-6">
        <TapTestClient />

        <section className="space-y-2 rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <button
            type="button"
            className="min-h-12 w-full rounded-lg bg-purple-300 px-4 py-3 font-bold text-black touch-manipulation"
            onClick={() => {
              setCount((c) => {
                const next = c + 1;
                pushLog(`Counter button → ${next}`);
                return next;
              });
            }}
          >
            Increment counter (now: {count})
          </button>
        </section>

        <section className="space-y-2 rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <button
            type="button"
            className="min-h-12 w-full rounded-lg border border-purple-400/50 bg-transparent px-4 py-3 font-bold text-purple-200 touch-manipulation"
            onClick={() => {
              setToggleOn((v) => {
                const next = !v;
                pushLog(`Toggle → ${next ? 'on' : 'off'}`);
                return next;
              });
            }}
          >
            Toggle label
          </button>
          <p className="text-sm text-green-300">
            Toggle is:{' '}
            <strong>{toggleOn ? 'ON (bright path)' : 'OFF (dim path)'}</strong>
          </p>
        </section>

        <section className="space-y-2 rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <label className="block text-sm text-purple-200" htmlFor="tap-test-input">
            Text input
          </label>
          <input
            id="tap-test-input"
            type="text"
            placeholder="Type here"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              pushLog(`input change (${e.target.value.length} chars)`);
            }}
            className="min-h-12 w-full rounded-lg border border-purple-950 bg-[#05070d] px-3 py-2 text-white touch-manipulation"
          />
        </section>

        <section className="space-y-2 rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <label className="block text-sm text-purple-200" htmlFor="tap-test-select">
            Select
          </label>
          <select
            id="tap-test-select"
            value={selectVal}
            onChange={(e) => {
              setSelectVal(e.target.value);
              pushLog(`select → ${e.target.value || '(empty)'}`);
            }}
            className="min-h-12 w-full rounded-lg border border-purple-950 bg-[#05070d] px-3 py-2 text-white touch-manipulation"
          >
            <option value="">Choose…</option>
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </select>
        </section>

        <section className="space-y-2 rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center rounded-lg border border-fuchsia-400/40 font-bold text-fuchsia-200 touch-manipulation"
            onClick={() => pushLog('Link → home (navigation)')}
          >
            Link to home (/)
          </Link>
        </section>

        <section className="space-y-2 rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <div
            role="button"
            tabIndex={0}
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-emerald-600/30 px-4 py-3 font-bold text-emerald-100 touch-manipulation"
            onClick={() => pushLog('div[role=button] onClick')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pushLog('div keyboard activate');
              }
            }}
          >
            Div with onClick (role=button)
          </div>
        </section>

        <section className="rounded-xl border border-purple-900/60 bg-[#0a0612] p-4">
          <p className="mb-2 text-sm font-semibold text-purple-200">
            Session log (last actions)
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-black/40 p-3 text-xs text-gray-300">
            {log.length === 0 ? (
              <span className="text-gray-500">No taps yet.</span>
            ) : (
              <ul className="space-y-1">
                {log.map((line, i) => (
                  <li key={`${line}-${i}`}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

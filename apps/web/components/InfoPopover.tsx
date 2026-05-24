'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type InfoPopoverProps = {
  /** Accessible name for the info trigger (e.g. "Bunny Points help"). */
  label: string;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
};

/**
 * Tap-friendly help popover (mobile-safe). Opens on button click, not hover-only.
 */
export function InfoPopover({
  label,
  children,
  className = '',
  align = 'start',
}: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const alignClass =
    align === 'end' ? 'right-0 sm:left-auto' : 'left-0 sm:right-auto';

  return (
    <span ref={rootRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-full border border-purple-500/40 bg-purple-500/10 text-xs font-black text-purple-200 transition hover:border-purple-300/60 hover:bg-purple-500/20 hover:text-white"
      >
        <span className="sr-only">{label}</span>
        <span aria-hidden>i</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className={`absolute top-full z-50 mt-2 w-[min(calc(100vw-2.5rem),18rem)] rounded-2xl border border-purple-400/30 bg-[#0a0514]/95 p-3.5 text-left text-xs leading-relaxed text-purple-100/95 shadow-[0_16px_48px_rgba(0,0,0,0.55),0_0_32px_rgba(88,28,135,0.35)] backdrop-blur-md sm:text-sm ${alignClass}`}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

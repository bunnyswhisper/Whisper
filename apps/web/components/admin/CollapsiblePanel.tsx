'use client';

import { ReactNode, useState } from 'react';

type CollapsiblePanelProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsiblePanel({
  title,
  defaultOpen = false,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-950 bg-[#05070d]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] sm:px-5 sm:py-4"
        aria-expanded={open}
      >
        <span className="text-sm font-bold text-purple-200 sm:text-base">
          {title}
        </span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-800 text-lg leading-none text-purple-300"
          aria-hidden
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-purple-950 p-4 sm:p-5">{children}</div>
      ) : null}
    </div>
  );
}

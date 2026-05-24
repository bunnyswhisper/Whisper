'use client';

import { interactivePressable } from '@/lib/interactivePressable';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmBtn = danger
    ? `rounded-full border border-red-400 bg-red-500/25 px-6 py-3 font-bold text-red-100 hover:bg-red-400/35 disabled:opacity-50 ${interactivePressable}`
    : `rounded-full border border-purple-300 bg-purple-300/25 px-6 py-3 font-bold text-purple-50 hover:bg-purple-300/40 disabled:opacity-50 ${interactivePressable}`;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-purple-950 bg-[#0a0712] p-6 shadow-[0_0_80px_rgba(0,0,0,0.85)]">
        <h2 id="confirm-modal-title" className="text-xl font-black text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm leading-relaxed text-gray-300">{description}</p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={`rounded-full border border-purple-800 px-6 py-3 font-bold text-purple-200 hover:bg-purple-950 disabled:opacity-50 ${interactivePressable}`}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button type="button" className={confirmBtn} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

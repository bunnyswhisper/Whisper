'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  inferColorHexFromName,
  isValidHexColor,
  normalizeHexColor,
  resolveVariantColorHex,
} from '@/lib/productColor';

type VariantColorFieldProps = {
  colorName: string;
  colorHex: string;
  onColorNameChange: (value: string) => void;
  onColorHexChange: (value: string) => void;
  disabled?: boolean;
};

const inputClass =
  'box-border min-h-11 w-full max-w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_20px_rgba(168,85,247,0.2)]';

const pickButtonClass =
  'min-h-11 w-full shrink-0 rounded-full border border-purple-300/50 bg-purple-500/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-purple-100 transition hover:border-purple-300 hover:bg-purple-500/25 disabled:opacity-50 sm:w-auto';

/** iOS Safari blocks programmatic .click() on off-screen color inputs — use a label overlay. */
const mobileColorInputClass =
  'absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed';

export function VariantColorField({
  colorName,
  colorHex,
  onColorNameChange,
  onColorHexChange,
  disabled = false,
}: VariantColorFieldProps) {
  const pickerId = useId();
  const mobilePickerId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(colorHex);
  const [hexError, setHexError] = useState('');

  const swatchHex = resolveVariantColorHex(colorName, colorHex);

  useEffect(() => {
    const normalized = normalizeHexColor(colorHex);
    setHexDraft(normalized || colorHex || '');
  }, [colorHex]);

  useEffect(() => {
    if (!pickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [pickerOpen]);

  function commitHex(raw: string) {
    const normalized = normalizeHexColor(raw);
    if (!normalized) {
      setHexError('Enter a valid hex code (#RRGGBB).');
      return;
    }
    setHexError('');
    setHexDraft(normalized);
    onColorHexChange(normalized);
  }

  function handleNameBlur() {
    if (isValidHexColor(colorHex)) return;

    const nameKey = colorName.trim().toLowerCase();
    if (!nameKey || nameKey === 'new color') {
      onColorHexChange(inferColorHexFromName(colorName));
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300/90">
        Color
      </p>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="h-11 w-11 shrink-0 rounded-xl border border-white/25 shadow-[0_0_18px_rgba(168,85,247,0.25)]"
            style={{ backgroundColor: swatchHex }}
            title={swatchHex}
            aria-hidden
          />
          <input
            type="text"
            value={colorName}
            disabled={disabled}
            onChange={(e) => onColorNameChange(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Color name"
            className={`${inputClass} min-w-0 flex-1`}
            aria-label="Color name"
          />
        </div>

        <div className="relative hidden min-w-0 shrink-0 sm:block" ref={popoverRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPickerOpen((open) => !open)}
            className={pickButtonClass}
            aria-expanded={pickerOpen}
            aria-controls={pickerId}
          >
            Pick color
          </button>

          {pickerOpen ? (
            <div
              id={pickerId}
              className="absolute left-0 top-full z-50 mt-2 w-[min(100%,16rem)] max-w-[calc(100vw-2rem)] rounded-2xl border border-purple-300/35 bg-[#0a0514] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
              role="dialog"
              aria-label="Color picker"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300">
                Swatch
              </p>

              <div className="mt-3 flex min-w-0 items-center gap-3">
                <input
                  type="color"
                  value={swatchHex}
                  disabled={disabled}
                  onChange={(e) => commitHex(e.target.value)}
                  className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-purple-950 bg-[#05070d] p-0.5"
                  aria-label="Color spectrum"
                />
                <span
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/20"
                  style={{ backgroundColor: swatchHex }}
                />
              </div>

              <label className="mt-4 block text-xs font-semibold text-purple-200">
                Hex code
                <input
                  type="text"
                  value={hexDraft}
                  disabled={disabled}
                  onChange={(e) => {
                    setHexDraft(e.target.value);
                    setHexError('');
                  }}
                  onBlur={() => commitHex(hexDraft)}
                  placeholder="#FFFFFF"
                  className={`${inputClass} mt-1.5 font-mono text-xs`}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>

              {hexError ? (
                <p className="mt-2 text-xs text-red-300">{hexError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs text-gray-500">#</span>
        <input
          type="text"
          value={hexDraft.replace(/^#/, '')}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
            setHexDraft(next ? `#${next}` : '');
            setHexError('');
          }}
          onBlur={() => commitHex(hexDraft)}
          className={`${inputClass} min-w-0 flex-1 font-mono text-xs`}
          placeholder="FFFFFF"
          aria-label="Hex color without hash"
          spellCheck={false}
        />
      </div>

      {hexError ? (
        <p className="-mt-1 text-xs text-red-300">{hexError}</p>
      ) : null}

      {/* Mobile: label-wrapped native input — reliable on iOS Safari / PWA */}
      <label
        htmlFor={mobilePickerId}
        className={`relative flex min-h-11 w-full max-w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-purple-300/50 bg-purple-500/15 px-4 py-2 sm:hidden ${
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-purple-300 hover:bg-purple-500/25'
        }`}
      >
        <input
          id={mobilePickerId}
          type="color"
          value={swatchHex}
          disabled={disabled}
          onChange={(e) => commitHex(e.target.value)}
          className={mobileColorInputClass}
          aria-label="Pick color"
        />
        <span
          className="pointer-events-none text-xs font-bold uppercase tracking-[0.12em] text-purple-100"
          aria-hidden
        >
          Pick color
        </span>
      </label>
    </div>
  );
}

'use client';

type AdminImageColorLinkCardProps = {
  imageUrl: string;
  altText: string;
  colorName: string | null;
  colorHex: string;
  /** color_name is set but no variant uses that color (e.g. after rename). */
  orphanColorLink?: boolean;
  colorOptions: string[];
  inputClass: string;
  saveButtonClass: string;
  selectedColor: string;
  onSelectedColorChange: (value: string) => void;
  onSaveColorLink: () => void | Promise<void>;
  onSetAsCardImage?: () => void | Promise<void>;
  isCardImage?: boolean;
  settingCardImage?: boolean;
  onRemove: () => void;
  saving?: boolean;
};

export function AdminImageColorLinkCard({
  imageUrl,
  altText,
  colorName,
  colorHex,
  orphanColorLink = false,
  colorOptions,
  inputClass,
  saveButtonClass,
  selectedColor,
  onSelectedColorChange,
  onSaveColorLink,
  onSetAsCardImage,
  isCardImage = false,
  settingCardImage = false,
  onRemove,
  saving = false,
}: AdminImageColorLinkCardProps) {
  const linked = Boolean(colorName?.trim());
  const label = colorName?.trim() || '';

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-purple-950 bg-[#0d0716]">
      <img
        src={imageUrl}
        alt={altText}
        className="h-28 w-full object-cover sm:h-32"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 border-t border-purple-950/80 p-3">
        {onSetAsCardImage ? (
          <button
            type="button"
            onClick={() => void onSetAsCardImage()}
            disabled={settingCardImage || isCardImage}
            className={`min-h-10 w-full rounded-full border px-3 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isCardImage
                ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-50 shadow-[0_0_16px_rgba(52,211,153,0.25)]'
                : 'border-amber-300/50 bg-amber-500/15 text-amber-50 hover:border-amber-200 hover:bg-amber-500/25'
            }`}
          >
            {settingCardImage
              ? 'Setting card image…'
              : isCardImage
                ? '★ Product card image'
                : 'Set as product card image'}
          </button>
        ) : null}

        {linked ? (
          <div
            className={`inline-flex max-w-full flex-col gap-1 self-start rounded-xl border px-2.5 py-1.5 ${
              orphanColorLink
                ? 'border-amber-400/45 bg-amber-500/10'
                : 'border-emerald-400/35 bg-emerald-500/10'
            }`}
            title={
              orphanColorLink
                ? `Stored link "${label}" does not match a current color`
                : `Linked to ${label}`
            }
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-white/30 shadow-[0_0_8px_rgba(168,85,247,0.35)]"
                style={{ backgroundColor: colorHex }}
                aria-hidden
              />
              <span
                className={`truncate text-[11px] font-bold ${
                  orphanColorLink ? 'text-amber-100' : 'text-emerald-100'
                }`}
              >
                Linked to {label}
              </span>
            </div>
            {orphanColorLink ? (
              <span className="text-[10px] leading-snug text-amber-200/90">
                Color renamed or missing — choose a current color below and Save
                Color Link, or Save color on the group to sync links.
              </span>
            ) : null}
          </div>
        ) : (
          <div className="inline-flex self-start rounded-full border border-gray-600/45 bg-gray-500/10 px-2.5 py-1">
            <span className="text-[11px] font-semibold text-gray-400">Unlinked</span>
          </div>
        )}

        {colorOptions.length > 0 ? (
          <>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-300/85">
              Assign to color
            </label>
            <select
              value={selectedColor}
              onChange={(e) => onSelectedColorChange(e.target.value)}
              className={`${inputClass} min-h-10 w-full min-w-0 py-2 text-xs`}
              aria-label={
                linked ? `Change color link for ${label}` : 'Link image to color'
              }
            >
              <option value="">Unlinked (no color)</option>
              {colorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void onSaveColorLink()}
              disabled={saving}
              className={`${saveButtonClass} min-h-10 w-full py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {saving ? 'Saving…' : 'Save Color Link'}
            </button>
          </>
        ) : (
          <p className="text-[10px] leading-snug text-gray-500">
            Add variant colors in Stock Variants before linking this image.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="mt-auto min-h-11 w-full border-t border-purple-950/80 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-300 hover:text-black sm:text-sm"
      >
        Remove Image
      </button>
    </article>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductImage } from '@/components/images';
import {
  colorsMatch,
  normalizeHexColor,
  resolveVariantColorHex,
} from '@/lib/productColor';
import { VariantColorField } from '@/components/admin/VariantColorField';
import type { AdminProductImage, AdminVariantRow } from '@/components/admin/ProductColorGroupsEditor';

type AdminColorGroupPanelProps = {
  variantIds: string[];
  seedVariants: AdminVariantRow[];
  seedColor: string;
  seedHex: string;
  images: AdminProductImage[];
  inputClass: string;
  saveRowButtonClass: string;
  addButtonClass: string;
  dangerButtonClass: string;
  draft?: boolean;
  onVariantFieldChange: (
    variantId: string,
    field: keyof AdminVariantRow,
    value: string | number | boolean,
  ) => void;
  onCommitColorMeta: (patch: {
    color: string;
    color_hex: string;
    previousColorName?: string;
  }) => void;
  onSaveVariant: (variant: AdminVariantRow) => void | Promise<void>;
  onSaveColorGroup: (
    variants: AdminVariantRow[],
    previousColorName: string,
  ) => void | Promise<void>;
  onAddSize: (color: string, color_hex: string) => void | Promise<void>;
  onRemoveVariant: (variantId: string) => void | Promise<void>;
  onRemoveColorGroup: (variantIds: string[]) => void | Promise<void>;
};

export function AdminColorGroupPanel({
  variantIds,
  seedVariants,
  seedColor,
  seedHex,
  images,
  inputClass,
  saveRowButtonClass,
  addButtonClass,
  dangerButtonClass,
  draft = false,
  onVariantFieldChange,
  onCommitColorMeta,
  onSaveVariant,
  onSaveColorGroup,
  onAddSize,
  onRemoveVariant,
  onRemoveColorGroup,
}: AdminColorGroupPanelProps) {
  const groupKey = variantIds.slice().sort().join('|');
  const groupKeyRef = useRef(groupKey);
  const [colorName, setColorName] = useState(seedColor);
  const [colorHex, setColorHex] = useState(seedHex);

  useEffect(() => {
    if (groupKeyRef.current === groupKey) return;
    groupKeyRef.current = groupKey;
    setColorName(seedColor);
    setColorHex(seedHex);
  }, [groupKey, seedColor, seedHex]);

  const swatchHex = resolveVariantColorHex(colorName, colorHex);
  const linkedImages = images.filter((image) =>
    colorsMatch(image.color_name || '', colorName),
  );

  const variantInputClass = `${inputClass} box-border w-full max-w-full min-w-0`;

  function variantsWithColorMeta(): AdminVariantRow[] {
    return seedVariants.map((variant) => ({
      ...variant,
      color: colorName,
      color_hex: colorHex,
    }));
  }

  function commitColorMetaToParent(next?: { color?: string; hex?: string }) {
    const color = (next?.color ?? colorName).trim();
    const hex = next?.hex ?? colorHex;
    onCommitColorMeta({
      color,
      color_hex: hex,
      previousColorName: seedColor,
    });
  }

  function handleSaveColor() {
    commitColorMetaToParent();
    void onSaveColorGroup(variantsWithColorMeta(), seedColor);
  }

  function handleDraftColorNameChange(value: string) {
    setColorName(value);
    if (draft) {
      commitColorMetaToParent({ color: value, hex: colorHex });
    }
  }

  function handleDraftColorHexChange(value: string) {
    setColorHex(value);
    if (draft) {
      commitColorMetaToParent({ color: colorName, hex: value });
    }
  }

  return (
    <article className="min-w-0 overflow-x-clip rounded-2xl border border-purple-300/25 bg-[#0a0614] shadow-[0_12px_40px_rgba(168,85,247,0.12)]">
      <header className="overflow-visible border-b border-purple-950/80 bg-[#0d0716]/90 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <VariantColorField
              colorName={colorName}
              colorHex={colorHex}
              onColorNameChange={
                draft ? handleDraftColorNameChange : setColorName
              }
              onColorHexChange={(value) => {
                const normalized = normalizeHexColor(value);
                if (!normalized) return;
                if (draft) {
                  handleDraftColorHexChange(normalized);
                } else {
                  setColorHex(normalized);
                }
              }}
            />
          </div>

          <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {!draft ? (
              <button
                type="button"
                onClick={handleSaveColor}
                className={`${saveRowButtonClass} w-full sm:w-auto`}
              >
                Save color
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void onRemoveColorGroup(variantIds)}
              className={`${dangerButtonClass} w-full sm:w-auto`}
            >
              Remove color
            </button>
          </div>
        </div>

        {linkedImages.length > 0 ? (
          <div className="mt-4 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300/90">
              Linked images
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {linkedImages.map((image) => (
                <div
                  key={image.id}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-purple-950 sm:h-20 sm:w-20"
                >
                  <ProductImage
                    src={image.image_url}
                    alt={image.alt_text || colorName}
                    variant="admin"
                  />
                  <span
                    className="absolute bottom-1 right-1 h-3 w-3 rounded border border-white/30"
                    style={{ backgroundColor: swatchHex }}
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            No images linked to this color yet.
          </p>
        )}
      </header>

      <div className="min-w-0 space-y-2 p-4 sm:p-5">
        <div className="hidden min-w-0 grid-cols-2 gap-3 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300/80 sm:grid">
          <span>Size</span>
          <span>Stock</span>
        </div>

        {seedVariants.map((variant) => (
          <AdminVariantSizeRow
            key={variant.id}
            variant={variant}
            colorName={colorName}
            colorHex={colorHex}
            inputClass={variantInputClass}
            saveRowButtonClass={saveRowButtonClass}
            dangerButtonClass={dangerButtonClass}
            draft={draft}
            onVariantFieldChange={onVariantFieldChange}
            onSaveVariant={onSaveVariant}
            onRemoveVariant={onRemoveVariant}
            onCommitColorMeta={onCommitColorMeta}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            commitColorMetaToParent();
            void onAddSize(colorName, colorHex);
          }}
          className={`${addButtonClass} mt-2 w-full sm:w-auto`}
        >
          Add Size
        </button>
      </div>
    </article>
  );
}

function AdminVariantSizeRow({
  variant,
  colorName,
  colorHex,
  inputClass,
  saveRowButtonClass,
  dangerButtonClass,
  draft,
  onVariantFieldChange,
  onSaveVariant,
  onRemoveVariant,
  onCommitColorMeta,
}: {
  variant: AdminVariantRow;
  colorName: string;
  colorHex: string;
  inputClass: string;
  saveRowButtonClass: string;
  dangerButtonClass: string;
  draft?: boolean;
  onVariantFieldChange: AdminColorGroupPanelProps['onVariantFieldChange'];
  onSaveVariant: AdminColorGroupPanelProps['onSaveVariant'];
  onRemoveVariant: AdminColorGroupPanelProps['onRemoveVariant'];
  onCommitColorMeta: AdminColorGroupPanelProps['onCommitColorMeta'];
}) {
  const variantIdRef = useRef(variant.id);
  const [size, setSize] = useState(variant.size);
  const [stock, setStock] = useState(String(variant.stock_quantity));
  const [isActive, setIsActive] = useState(variant.is_active);

  useEffect(() => {
    variantIdRef.current = variant.id;
    setSize(variant.size);
    setStock(String(variant.stock_quantity));
    setIsActive(variant.is_active);
  }, [variant.id]);

  const low = Number(stock) <= 5 && Number(stock) > 0;
  const out = Number(stock) <= 0;

  return (
    <div
      className={`min-w-0 max-w-full rounded-xl border p-3 sm:p-3.5 ${
        out
          ? 'border-red-400/40 bg-red-500/10'
          : low
            ? 'border-yellow-300/40 bg-yellow-500/10'
            : 'border-purple-950/80 bg-[#05070d]'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3">
        <div className="min-w-0">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-purple-300/70 sm:sr-only">
            Size
          </label>
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            onBlur={() => onVariantFieldChange(variant.id, 'size', size)}
            className={inputClass}
            placeholder="Size"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-purple-300/70 sm:sr-only">
            Stock
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() =>
              onVariantFieldChange(variant.id, 'stock_quantity', stock)
            }
            className={inputClass}
            placeholder="Stock"
          />
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-purple-950/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-purple-100">
          <label className="flex min-w-0 items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                onVariantFieldChange(variant.id, 'is_active', e.target.checked);
              }}
              className="h-4 w-4 shrink-0 accent-purple-400"
            />
            <span>Active</span>
          </label>
          {!draft ? (
            <span className="min-w-0 text-gray-500">
              Reserved: {variant.reserved_quantity || 0}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {!draft ? (
            <button
              type="button"
              onClick={() => {
                onCommitColorMeta({ color: colorName, color_hex: colorHex });
                void onSaveVariant({
                  ...variant,
                  size,
                  stock_quantity: Number(stock),
                  is_active: isActive,
                  color: colorName,
                  color_hex: colorHex,
                });
              }}
              className={`${saveRowButtonClass} inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap px-4 py-2 text-xs sm:w-auto sm:min-h-9 sm:px-3 sm:py-1.5`}
            >
              Save row
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onRemoveVariant(variant.id)}
            className={`${dangerButtonClass} inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap px-4 py-2 text-xs sm:w-auto sm:min-h-9 sm:px-3 sm:py-1.5`}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

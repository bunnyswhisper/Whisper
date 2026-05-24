'use client';

import {
  groupVariantsByColor,
  normalizeHexColor,
  resolveVariantColorHex,
} from '@/lib/productColor';
import { AdminColorGroupPanel } from '@/components/admin/AdminColorGroupPanel';

export type AdminVariantRow = {
  id: string;
  size: string;
  color: string;
  color_hex?: string | null;
  sku?: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  is_active: boolean;
};

export type AdminProductImage = {
  id: string;
  image_url: string;
  alt_text: string | null;
  color_name?: string | null;
};

type ProductColorGroupsEditorProps = {
  variants: AdminVariantRow[];
  images: AdminProductImage[];
  inputClass: string;
  saveRowButtonClass: string;
  addButtonClass: string;
  dangerButtonClass: string;
  onVariantFieldChange: (
    variantId: string,
    field: keyof AdminVariantRow,
    value: string | number | boolean,
  ) => void;
  onColorGroupMetaChange: (
    variantIds: string[],
    patch: { color: string; color_hex: string; previousColorName?: string },
  ) => void;
  onSaveVariant: (variant: AdminVariantRow) => void | Promise<void>;
  onSaveColorGroup: (
    variants: AdminVariantRow[],
    previousColorName: string,
  ) => void | Promise<void>;
  onAddSize: (color: string, color_hex: string) => void | Promise<void>;
  onAddColor: () => void | Promise<void>;
  onRemoveVariant: (variantId: string) => void | Promise<void>;
  onRemoveColorGroup: (variantIds: string[]) => void | Promise<void>;
  onLinkImageToColor?: (imageId: string, colorName: string) => void | Promise<void>;
  unlinkedImages?: AdminProductImage[];
  draft?: boolean;
};

function storedGroupColorHex(
  variants: AdminVariantRow[],
  displayHex: string,
): string {
  for (const variant of variants) {
    const normalized = normalizeHexColor(variant.color_hex || '');
    if (normalized) return normalized;
  }
  return normalizeHexColor(displayHex) || displayHex;
}

export function ProductColorGroupsEditor({
  variants,
  images,
  inputClass,
  saveRowButtonClass,
  addButtonClass,
  dangerButtonClass,
  onVariantFieldChange,
  onColorGroupMetaChange,
  onSaveVariant,
  onSaveColorGroup,
  onAddSize,
  onAddColor,
  onRemoveVariant,
  onRemoveColorGroup,
  onLinkImageToColor,
  unlinkedImages,
  draft = false,
}: ProductColorGroupsEditorProps) {
  const groups = groupVariantsByColor(variants);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-400">
          One color swatch per group — sizes share the same color and hex.
        </p>
        <button type="button" onClick={() => void onAddColor()} className={addButtonClass}>
          Add Color
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-purple-950 bg-[#0d0716] p-4 text-sm text-gray-400">
          No variants yet. Add a color to start.
        </p>
      ) : null}

      {groups.map((group) => {
        const variantIds = group.variants.map((v) => v.id);
        const groupStableKey = variantIds.slice().sort().join('|');
        const displayHex = resolveVariantColorHex(group.color, group.color_hex);
        const seedHex = storedGroupColorHex(group.variants, displayHex);

        return (
          <AdminColorGroupPanel
            key={groupStableKey}
            variantIds={variantIds}
            seedVariants={group.variants}
            seedColor={group.color}
            seedHex={seedHex}
            images={images}
            inputClass={inputClass}
            saveRowButtonClass={saveRowButtonClass}
            addButtonClass={addButtonClass}
            dangerButtonClass={dangerButtonClass}
            draft={draft}
            onVariantFieldChange={onVariantFieldChange}
            onCommitColorMeta={(patch) =>
              onColorGroupMetaChange(variantIds, patch)
            }
            onSaveVariant={onSaveVariant}
            onSaveColorGroup={onSaveColorGroup}
            onAddSize={onAddSize}
            onRemoveVariant={onRemoveVariant}
            onRemoveColorGroup={onRemoveColorGroup}
          />
        );
      })}

      {onLinkImageToColor && unlinkedImages && unlinkedImages.length > 0 ? (
        <p className="text-xs text-gray-500">
          Link images from each image card under Images (Assign to color).
        </p>
      ) : null}
    </div>
  );
}

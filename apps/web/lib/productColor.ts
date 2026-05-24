/** Named-color defaults when color_hex is missing (admin + storefront). */
const NAMED_COLOR_HEX: Record<string, string> = {
  white: '#FFFFFF',
  black: '#111111',
  mint: '#C8E5D2',
  cream: '#EAD7BD',
  beige: '#D6B48C',
  default: '#A855F7',
};

const HEX_PATTERN = /^#[0-9A-F]{6}$/;

/** Normalize #RRGGBB or RRGGBB; returns null if invalid. */
export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;

  return withHash.toUpperCase();
}

export function isValidHexColor(input: string): boolean {
  return normalizeHexColor(input) !== null;
}

export function inferColorHexFromName(colorName: string): string {
  const key = colorName.trim().toLowerCase();
  if (!key) return NAMED_COLOR_HEX.default;
  return NAMED_COLOR_HEX[key] ?? NAMED_COLOR_HEX.default;
}

/** Storefront + admin swatch: DB hex first, then name map, then purple fallback. */
export function resolveVariantColorHex(
  colorName: string,
  colorHex?: string | null,
): string {
  const normalized = colorHex ? normalizeHexColor(colorHex) : null;
  if (normalized) return normalized;
  return inferColorHexFromName(colorName);
}

export function sanitizeColorName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/[<>"'`]/g, '').slice(0, 64);
  return cleaned || null;
}

/** Unique variant color names for image assignment dropdowns. */
export function getProductImageForColor(
  images: {
    image_url: string;
    alt_text?: string | null;
    color_name?: string | null;
  }[],
  selectedColor: string,
  fallbackImage: string,
): string {
  const key = selectedColor.trim().toLowerCase();
  if (!key) return fallbackImage;

  const linked = images.find(
    (image) => image.color_name?.trim().toLowerCase() === key,
  );
  if (linked?.image_url) return linked.image_url;

  const legacy = images.find((image) => {
    const alt = image.alt_text?.toLowerCase() || '';
    const url = image.image_url.toLowerCase();
    return alt.includes(key) || url.includes(key);
  });

  return legacy?.image_url || fallbackImage;
}

export function colorsMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

/** Swatch hex from variant rows for a color (case-insensitive); purple only if none saved. */
export function getVariantColorHexForName(
  variants: { color: string; color_hex?: string | null }[],
  colorName: string,
): string {
  const key = colorName.trim().toLowerCase();
  if (!key) return NAMED_COLOR_HEX.default;

  for (const variant of variants) {
    if (!colorsMatch(variant.color, colorName)) continue;
    const saved = normalizeHexColor(variant.color_hex || '');
    if (saved) return saved;
  }

  return inferColorHexFromName(colorName);
}

export type ProductImageRow = {
  image_url: string;
  alt_text?: string | null;
  color_name?: string | null;
  sort_order?: number;
};

export function sortProductImages<T extends { sort_order?: number }>(
  images: T[],
): T[] {
  return [...images].sort(
    (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99),
  );
}

/** Homepage/catalog card: lowest sort_order wins. */
export function getProductCardImageUrl(
  images: ProductImageRow[],
): string {
  const sorted = sortProductImages(images);
  return sorted[0]?.image_url ?? '';
}

export type ProductGalleryFilterStatus =
  | 'default'
  | 'colorImages'
  | 'noImagesForSelectedColor';

export type ProductGalleryFilterResult = {
  images: ProductImageRow[];
  status: ProductGalleryFilterStatus;
  hasColorImages: boolean;
  noImagesForSelectedColor: boolean;
  /** @deprecated Use noImagesForSelectedColor */
  noImagesForColor: boolean;
};

function noColorGalleryResult(): ProductGalleryFilterResult {
  return {
    images: [],
    status: 'noImagesForSelectedColor',
    hasColorImages: false,
    noImagesForSelectedColor: true,
    noImagesForColor: true,
  };
}

/**
 * PDP gallery: when a color is selected, only show images linked to that color
 * (case-insensitive color_name). Never fall back to card, unlinked, or other colors.
 */
export function resolveGalleryForColor(
  images: ProductImageRow[],
  selectedColor: string,
): ProductGalleryFilterResult {
  if (!images.length) return noColorGalleryResult();

  const key = selectedColor.trim().toLowerCase();
  if (!key) {
    const sorted = sortProductImages(images);
    return {
      images: sorted,
      status: 'default',
      hasColorImages: false,
      noImagesForSelectedColor: false,
      noImagesForColor: false,
    };
  }

  const linkedByName = images.filter((image) =>
    colorsMatch(image.color_name || '', selectedColor),
  );
  if (linkedByName.length > 0) {
    const sorted = sortProductImages(linkedByName);
    return {
      images: sorted,
      status: 'colorImages',
      hasColorImages: true,
      noImagesForSelectedColor: false,
      noImagesForColor: false,
    };
  }

  return noColorGalleryResult();
}

/** First gallery image for a selected color, or null when none (no card/other-color fallback). */
export function getGalleryMainImageForColor(
  images: ProductImageRow[],
  selectedColor: string,
): string | null {
  const result = resolveGalleryForColor(images, selectedColor);
  if (result.noImagesForSelectedColor) return null;
  return result.images[0]?.image_url ?? null;
}

/** @deprecated Prefer resolveGalleryForColor for status-aware gallery UI. */
export function filterGalleryImagesForColor(
  images: ProductImageRow[],
  selectedColor: string,
): ProductImageRow[] {
  return resolveGalleryForColor(images, selectedColor).images;
}

/** True when image.color_name does not match any current variant color. */
export function isOrphanImageColorLink(
  colorName: string | null | undefined,
  variantColorNames: string[],
): boolean {
  const linked = colorName?.trim();
  if (!linked) return false;
  return !variantColorNames.some((name) => colorsMatch(name, linked));
}

export type VariantColorGroup<T extends { color: string; color_hex?: string | null }> =
  {
    colorKey: string;
    color: string;
    color_hex: string;
    variants: T[];
  };

/** Group variant rows by color (one picker per color). */
export function groupVariantsByColor<
  T extends { color: string; color_hex?: string | null },
>(variants: T[]): VariantColorGroup<T>[] {
  const map = new Map<string, T[]>();
  const order: string[] = [];

  for (const variant of variants) {
    const key = variant.color?.trim().toLowerCase() || 'default';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(variant);
  }

  return order.map((colorKey) => {
    const rows = map.get(colorKey)!;
    const lead = rows[0];
    return {
      colorKey,
      color: lead.color,
      color_hex: resolveVariantColorHex(lead.color, lead.color_hex),
      variants: [...rows].sort((a, b) =>
        String((a as { size?: string }).size || '').localeCompare(
          String((b as { size?: string }).size || ''),
        ),
      ),
    };
  });
}

export function imagesForColorGroup(
  images: {
    id?: string;
    image_url: string;
    alt_text?: string | null;
    color_name?: string | null;
  }[],
  colorName: string,
) {
  const key = colorName.trim().toLowerCase();
  return images.filter(
    (image) => image.color_name?.trim().toLowerCase() === key,
  );
}

export function uniqueVariantColorNames(
  variants: { color: string }[],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const variant of variants) {
    const name = variant.color?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** True when at least one image is linked to this color (trim, case-insensitive). */
export function colorHasLinkedImages(
  images: ProductImageRow[],
  colorName: string,
): boolean {
  return images.some((image) =>
    colorsMatch(image.color_name || '', colorName),
  );
}

function displayColorPriorityRank(colorName: string): number {
  const key = colorName.trim().toLowerCase();
  if (key === 'white') return 0;
  if (key === 'black') return 1;
  return 2;
}

/**
 * PDP swatch order: colors with linked images first (White, Black, then others),
 * then colors without images in original variant order.
 */
export function sortProductColorsForDisplay(
  variants: { color: string }[],
  images: ProductImageRow[],
): string[] {
  const names = uniqueVariantColorNames(variants);
  if (!names.length) return [];

  const anyLinked = names.some((name) => colorHasLinkedImages(images, name));
  if (!anyLinked) return names;

  return [...names].sort((a, b) => {
    const aLinked = colorHasLinkedImages(images, a);
    const bLinked = colorHasLinkedImages(images, b);
    if (aLinked !== bLinked) return aLinked ? -1 : 1;

    if (!aLinked && !bLinked) {
      return names.indexOf(a) - names.indexOf(b);
    }

    const priority = displayColorPriorityRank(a) - displayColorPriorityRank(b);
    if (priority !== 0) return priority;

    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

/** First color in display order — default PDP selection. */
export function getDefaultProductColor(
  variants: { color: string }[],
  images: ProductImageRow[],
): string {
  return sortProductColorsForDisplay(variants, images)[0] || '';
}
